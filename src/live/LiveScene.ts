import './babylonSideEffects'
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Camera } from '@babylonjs/core/Cameras/camera'
import { UniversalCamera } from '@babylonjs/core/Cameras/universalCamera'
import { Engine } from '@babylonjs/core/Engines/engine'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { SpotLight } from '@babylonjs/core/Lights/spotLight'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Effect } from '@babylonjs/core/Materials/effect'
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Viewport } from '@babylonjs/core/Maths/math.viewport'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { getBody } from '../library/cameras'
import { kelvinToSrgb, lightColour, luminance, RGB, srgbToLinear } from '../library/colour'
import { getLens } from '../library/lenses'
import { focusDistance, horizontalFov, imageWidthMm, keyLux } from '../library/optics'
import { headingDirection, illuminanceAt, ResolvedLight, resolveLight, subjectMeterPoint } from '../library/photometry'
import { CameraItem, CameraProps, LightItem, PropItem, SceneDoc, SceneItem, SubjectItem } from '../scene/types'
import { Architecture, LAYER } from './Architecture'
import { sceneBounce } from '../scene/store'
import { bounceLux, worldLux } from '../scene/world'
import { ownerColour } from '../plan/marks'
import { TapeMarks } from './TapeMarks'
import { Glow, PropsLayer } from './PropsLayer'
import { FigureMaterials, Mannequin } from './Mannequin'
import { solveSubject, subjectProps } from '../subjects/kinematics'
import { storage } from '../setups/storage'
import { attachDisplay, CameraPipeline, DisplaySettings } from './CameraPipeline'
import { LightPool, LightRequest, Slot } from './LightPool'
import { renderState, Tier, TIERS } from './renderState'

// Time per frame spent building props when a big set arrives (the rest continue next frame).
const PROP_BUILD_BUDGET_MS = 28
// While subjects move, shadow maps refresh at most this often (ms).
const SHADOW_MOTION_MS = 150
const DEG = Math.PI / 180
// Widest cone the shadow map covers; wider sources still light, but only shadow inside this.
const MAX_SHADOW_CONE = 120
// While the orbit camera moves, render at draft resolution; restore full quality after this long still.
const MOTION_SETTLE_MS = 250

interface Entry {
  kind: SceneItem['kind']
  key: string
  root: TransformNode
  head?: TransformNode
  omni?: boolean
  emitterMaterial?: ShaderMaterial
  emitterArea?: number
  stand?: Mesh
  casters?: AbstractMesh[]
  figure?: Mannequin
  viewCamera?: UniversalCamera
  pipeline?: CameraPipeline
}

export interface FrameCapture {
  data: Uint8Array
  width: number
  height: number
}

// Emitting surfaces write their luminance straight into the HDR buffer — no lighting, no clamping —
// so they sit at the right brightness relative to lit surfaces and clip like real sources.
Effect.ShadersStore.previsEmitterVertexShader = `
precision highp float;
attribute vec3 position;
uniform mat4 worldViewProjection;
void main(void) { gl_Position = worldViewProjection * vec4(position, 1.0); }
`
Effect.ShadersStore.previsEmitterFragmentShader = `
precision highp float;
uniform vec3 radiance;
void main(void) { gl_FragColor = vec4(radiance, 1.0); }
`

const lightKey = (item: LightItem) => `${item.props.fixtureId}|${item.props.modifierId}|${item.props.orientation}`

// Camera white balance as a per-channel gain: a light at the WB temperature renders neutral.
function whiteBalanceGain(camera: CameraProps | undefined): RGB {
  if (!camera) return [1, 1, 1]
  const white = srgbToLinear(kelvinToSrgb(camera.wb))
  white[1] *= 1 - camera.tint * 0.0025
  const lum = luminance(white)
  return [lum / white[0], lum / white[1], lum / white[2]]
}

// Read-only 3D view of a SceneDoc. The scene is rebuilt/updated from the document via sync();
// nothing in here is pickable — the only interactive things are the orbit camera and the
// settings of the camera being looked through.
export class LiveScene {
  private engine: Engine
  public scene: Scene
  private orbitCamera: ArcRotateCamera
  private ambient: HemisphericLight
  private entries = new Map<string, Entry>()
  private architecture: Architecture
  private cutaway = true
  private viewingId: string | null = null
  private imageRect = { x: 0, y: 0, width: 1, height: 1 }
  private figureMaterials: FigureMaterials
  private markerMaterial: PBRMaterial
  private resizeObserver: ResizeObserver
  private display: DisplaySettings = { exposure: 1, wbGains: [1, 1, 1] }
  private scopeCallback: ((frame: FrameCapture) => void) | null = null
  private lastScopeRead = 0
  private reading = false
  private scopeFrameDirty = false
  private stillRequests: Array<{ resolve: (frame: FrameCapture) => void; reject: (error: Error) => void }> = []
  // Rendering on demand: nothing is drawn unless something changed or the camera is moving.
  private active = true
  private needsFrames = 2
  // Only image-processing settings changed (exposure, WB, focus, T-stop, assists): re-run the
  // post-process chain on the last rendered frame instead of redrawing the scene.
  private needsReprocess = false
  private hasFrame = false
  private awaitingReady = true
  private motionUntil = 0
  private inMotion = false
  private qualityScale = 1.5
  private tier: Tier = TIERS.standard
  private pool: LightPool
  private snapshots = new Map<string, string>()
  // Camera placement/lens only (not exposure settings): what the depth map depends on.
  private cameraGeometry = new Map<string, string>()
  private slots = new Map<string, Slot>()
  private worldKey = ''
  private propItems: PropItem[] = []
  private propGlow: (id: string) => Glow | null = () => null
  private tapeMarks: TapeMarks
  private propsLayer: PropsLayer
  private marksInCameras = false

  constructor(private canvas: HTMLCanvasElement) {
    // adaptToDeviceRatio: render at the display's pixel density; quality is then set by setQuality().
    this.engine = new Engine(this.canvas, true, undefined, true)
    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0, 0, 0, 1)
    this.scene.skipPointerMovePicking = true

    // Materials output scene-linear HDR; exposure, white balance and the tone curve happen in our own
    // display pass after depth of field — the same order as light hitting a sensor.
    const processing = this.scene.imageProcessingConfiguration
    processing.applyByPostProcess = true
    processing.toneMappingEnabled = false
    // Babylon clamps each PBR channel to 30 in this mode. The scene is in real luminance (cd/m²), so a
    // white card under a few hundred lux already exceeds that — the clamp flattened highlights and
    // shifted hues. Our display pass handles highlights properly instead.
    processing.skipFinalColorClamp = true

    this.orbitCamera = new ArcRotateCamera('orbit', -Math.PI / 2, 1.05, 9, new Vector3(0, 1, 0), this.scene)
    this.orbitCamera.lowerRadiusLimit = 1
    this.orbitCamera.upperRadiusLimit = 30
    this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.02
    this.orbitCamera.wheelPrecision = 40
    this.orbitCamera.panningSensibility = 400
    this.orbitCamera.minZ = 0.05
    this.orbitCamera.attachControl(this.canvas, true)
    attachDisplay(this.scene, this.orbitCamera, this.display)

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene)

    this.architecture = new Architecture(this.scene, (name, color, roughness) => this.createSurface(name, color, roughness))
    this.tapeMarks = new TapeMarks(this.scene, LAYER.MARKS)
    this.propsLayer = new PropsLayer(
      this.scene,
      name => this.createSurface(name, Color3.White(), 0.5),
      () => (this.tier.id === 'lite' ? 256 : 512),
      id => storage.getImageUrl(id),
      () => this.requestRender(),
      LAYER.COMMON
    )
    // Walls, floors and ceilings use the same finish materials as props.
    this.architecture.setFinishMaterials(this.propsLayer.materials)
    this.applyLayers()
    // People: shared materials per colour (slightly glossy skin gives the polarizer something to cut).
    this.figureMaterials = new FigureMaterials((name, colour, roughness) => this.createSurface(name, colour, roughness))
    this.markerMaterial = this.createSurface('marker', new Color3(0.04, 0.04, 0.045), 0.6)

    this.pool = new LightPool(this.scene)
    this.applyTier()

    this.engine.runRenderLoop(() => this.frame())
    // Orbiting/zooming: pointer and wheel input start "motion" (draft resolution until still).
    const wake = () => { if (this.scene.activeCamera === this.orbitCamera) this.startMotion() }
    ;['pointerdown', 'pointermove', 'wheel'].forEach(type => this.canvas.addEventListener(type, event => {
      if (type !== 'pointermove' || (event as PointerEvent).buttons) wake()
    }, { passive: true }))
    this.resizeObserver = new ResizeObserver(() => {
      this.engine.resize()
      this.applyViewport()
      this.hasFrame = false
      this.requestRender()
    })
    this.resizeObserver.observe(this.canvas)
  }

  dispose(): void {
    this.resizeObserver.disconnect()
    this.engine.dispose()
  }

  // Switch the active view: null = free orbit camera, otherwise look through a placed camera item.
  viewThrough(cameraId: string | null): void {
    const entry = cameraId ? this.entries.get(cameraId) : undefined
    // Free the depth-of-field pipeline of the camera we're leaving (GPU memory matters on small machines).
    const previous = this.viewingId ? this.entries.get(this.viewingId) : undefined
    if (previous?.pipeline && previous.viewCamera && previous !== entry) {
      previous.pipeline.dispose(previous.viewCamera)
      previous.pipeline = undefined
    }
    this.viewingId = entry?.viewCamera ? cameraId : null
    if (entry?.viewCamera && !entry.pipeline) entry.pipeline = new CameraPipeline(this.scene, entry.viewCamera, this.display, this.tier)
    this.scene.activeCamera = entry?.viewCamera ?? this.orbitCamera
    // Hide the camera body we're looking through so it doesn't block its own view.
    this.entries.forEach((e, id) => {
      if (e.kind === 'camera') e.root.setEnabled(id !== this.viewingId)
    })
    this.applyViewport()
    this.snapshots.clear()
    this.hasFrame = false
    this.awaitingReady = true
    this.requestRender()
  }

  // Re-run only the active camera's post-processes (depth of field, exposure, tone curve, assists)
  // on the scene image already in the first pass's input — about 12 ms instead of a full redraw.
  private reprocess(): void {
    const cam = this.scene.activeCamera
    // A camera's pass list keeps empty slots after a pipeline is swapped (camera change, Performance
    // level); hand Babylon only the live passes, and redraw normally if any isn't ready yet.
    const passes = (cam?._postProcesses?.filter(p => p) ?? []) as NonNullable<NonNullable<typeof cam>['_postProcesses'][number]>[]
    if (!cam || !passes.length || !this.hasFrame || passes.some(p => !p.isReady())) {
      this.scene.render()
      return
    }
    this.engine.beginFrame()
    try {
      this.scene.postProcessManager._finalizeFrame(false, undefined, undefined, passes as never)
    } catch (e) {
      // Never let a stale pass take the app down: fall back to a full frame.
      console.warn('Re-process failed; redrawing', e)
      this.engine.endFrame()
      this.hasFrame = false
      this.scene.render()
      return
    }
    this.engine.endFrame()
  }

  // ── Rendering on demand ─────────────────────────────────────────────────
  requestRender(frames = 2): void {
    this.needsFrames = Math.max(this.needsFrames, frames)
  }

  // Stop drawing entirely while the Live View isn't on screen.
  setActive(on: boolean): void {
    this.active = on
    if (on) this.requestRender()
  }

  private startMotion(): void {
    this.motionUntil = performance.now() + MOTION_SETTLE_MS
    this.requestRender(1)
    if (!this.inMotion) {
      this.inMotion = true
      this.applyScale()
    }
  }

  private lastShadowRefresh = 0
  private shadowRefreshPending = false

  private refreshShadowsNow(): void {
    this.pool.refreshShadows(this.shadowCasters())
    this.lastShadowRefresh = performance.now()
    this.shadowRefreshPending = false
  }

  private refreshShadowsSoon(): void {
    if (performance.now() - this.lastShadowRefresh >= SHADOW_MOTION_MS) this.refreshShadowsNow()
    else this.shadowRefreshPending = true
  }

  private frame(): void {
    if (!this.active) return
    if (this.shadowRefreshPending && performance.now() - this.lastShadowRefresh >= SHADOW_MOTION_MS) {
      this.refreshShadowsNow()
      this.requestRender()
    }
    this.buildPendingProps()
    // Once the set is still, merge props into per-material batches (far fewer draw calls).
    if (this.propsLayer.batchIfIdle()) {
      this.refreshShadowsNow()
      this.requestRender()
    }
    this.drawPending()
  }

  // Continue building a large set a slice at a time (keeps the app responsive).
  private buildPendingProps(): void {
    if (!this.propsLayer.pending) return
    if (this.propsLayer.sync(this.propItems, this.propGlow, performance.now() + PROP_BUILD_BUDGET_MS)) {
      if (!this.propsLayer.pending) this.pool.refreshShadows(this.shadowCasters())
      this.entries.forEach(entry => entry.pipeline?.invalidate())
      this.requestRender()
    }
    this.reportBuilding()
  }

  private reportBuilding(): void {
    const left = this.propsLayer.pending
    if (left !== renderState.building.left) renderState.building = { left, total: left ? Math.max(renderState.building.total, left + this.propsLayer.count) : 0 }
  }

  // Draw whatever is pending (full render, reprocess, or nothing). Public for the benchmark.
  drawPending(): void {
    const cam = this.orbitCamera
    if (this.scene.activeCamera === cam && (cam.inertialAlphaOffset || cam.inertialBetaOffset || cam.inertialRadiusOffset || cam.inertialPanningX || cam.inertialPanningY)) {
      this.startMotion()
    }
    if (this.inMotion && performance.now() > this.motionUntil) {
      this.inMotion = false
      this.applyScale()
      this.requestRender()
    }
    if (this.awaitingReady) {
      // Keep showing the last good frame while new shaders compile (isReady() drives compilation).
      if (!this.scene.isReady()) {
        if (!renderState.preparing) renderState.preparing = true
        return
      }
      this.awaitingReady = false
      renderState.preparing = false
      this.requestRender()
    }
    if (this.needsFrames > 0) {
      this.needsFrames--
      this.needsReprocess = false
      this.scene.render()
      this.hasFrame = true
      this.scopeFrameDirty = true
    } else if (this.needsReprocess) {
      this.needsReprocess = false
      this.reprocess()
      this.scopeFrameDirty = true
    }
    this.readScopes()
    this.readStills()
  }

  // ── Storyboard stills ───────────────────────────────────────────────────
  // The clean graded frame of the camera being looked through, at full render resolution.
  // Waits for the camera to settle (no draft resolution) and re-processes the last frame first.
  captureStill(): Promise<FrameCapture> {
    if (!this.viewingId) return Promise.reject(new Error('Look through a camera to capture a frame.'))
    return new Promise((resolve, reject) => {
      this.stillRequests.push({ resolve, reject })
      this.needsReprocess = true
    })
  }

  private readStills(): void {
    if (!this.stillRequests.length || this.inMotion || this.awaitingReady || !this.hasFrame) return
    const requests = this.stillRequests.splice(0)
    const r = this.imageRect
    const aspect = r && r.height > 0 ? r.width / r.height : 16 / 9
    const still = this.viewingId ? this.entries.get(this.viewingId)?.pipeline?.readStill(aspect) : null
    if (still) requests.forEach(r => r.resolve(still))
    else if (!this.viewingId) requests.forEach(r => r.reject(new Error('Look through a camera to capture a frame.')))
    else {
      // Copy shader still compiling: try again on the next processed frame.
      this.stillRequests.push(...requests)
      this.requestReprocessSoon()
    }
  }

  // Render resolution relative to CSS pixels (1 = draft, 2 = full retina), capped at the display's DPR.
  setQuality(scale: number): void {
    this.qualityScale = scale
    this.applyScale()
  }

  // Quality tier: shadow budget, soft shadows, MSAA, bokeh samples (render scale is set separately).
  setTier(tier: Tier): void {
    if (tier.id === this.tier.id) return
    this.tier = tier
    this.applyTier()
    // Rebuild the viewed camera's pipeline with the tier's MSAA and bokeh settings.
    const viewing = this.viewingId
    this.viewThrough(null)
    this.viewThrough(viewing)
  }

  private applyTier(): void {
    const t = this.tier
    this.pool.configure({ spots: 6, points: 2, shadowSpots: t.shadowSpots, shadowPoints: t.shadowPoints, shadowMapSize: t.shadowMapSize, softShadows: t.softShadows })
    renderState.tier = t.id
    renderState.shadowBudget = t.shadowSpots + t.shadowPoints
    this.slots.clear()
    this.snapshots.clear()
    this.awaitingReady = true
    this.requestRender()
  }

  private applyScale(): void {
    const target = this.inMotion ? Math.min(1, this.qualityScale) : this.qualityScale
    const ratio = Math.min(target, window.devicePixelRatio || 1)
    if (Math.abs(this.engine.getHardwareScalingLevel() - 1 / ratio) < 1e-6) return
    this.engine.setHardwareScalingLevel(1 / ratio)
    this.engine.resize()
    this.hasFrame = false
    this.entries.forEach(entry => entry.pipeline?.invalidate())
    this.requestRender()
  }

  getFps(): number {
    return this.engine.getFps()
  }

  // True while frames are being drawn continuously (the camera is moving).
  isAnimating(): boolean {
    return this.inMotion
  }

  // The recorded image area within the canvas (CSS pixels, top-left origin), e.g. a 16:9 letterbox.
  setImageRect(rect: { x: number; y: number; width: number; height: number }): void {
    this.imageRect = rect
    this.applyViewport()
  }

  // Receive the graded frame a few times a second (for scopes). null stops it.
  onFrame(callback: ((frame: FrameCapture) => void) | null): void {
    this.scopeCallback = callback
    this.scopeFrameDirty = true
    this.requestRender(1)
  }

  // Orbit view: walls cut at hip height (dollhouse) or full height.
  setCutaway(on: boolean): void {
    this.cutaway = on
    this.applyLayers()
    this.requestRender()
  }

  private applyLayers(): void {
    this.orbitCamera.layerMask = LAYER.COMMON | LAYER.MARKS | (this.cutaway ? LAYER.CUT_WALLS : LAYER.FULL_WALLS)
    this.entries.forEach(entry => {
      if (entry.viewCamera) entry.viewCamera.layerMask = this.viewMask()
    })
  }

  private viewMask(): number {
    return LAYER.COMMON | LAYER.FULL_WALLS | LAYER.CEILING | (this.marksInCameras ? LAYER.MARKS : 0)
  }

  // Show the blocking tape marks when looking through a camera (they always show in orbit).
  setMarksInCameras(on: boolean): void {
    this.marksInCameras = on
    this.applyLayers()
    this.requestRender()
  }

  // Draw continuously at motion resolution for a moment (blocking playback).
  holdMotion(): void {
    this.startMotion()
  }

  // Bring the 3D scene in line with the document. Only what changed is touched: unchanged items are
  // skipped, the architecture rebuilds only when it changed, and shadow/depth maps re-render only
  // when geometry or lights moved. `archChanged` = walls/openings/rooms may have changed.
  sync(doc: SceneDoc, archChanged = true): void {
    const rebuilt = archChanged && this.architecture.sync(doc)

    // Exposure, WB and polarizer come from the camera being looked through, or the active camera.
    const exposingId = this.viewingId ?? doc.activeCameraId
    const exposing = doc.items.find((i): i is CameraItem => i.id === exposingId && i.kind === 'camera')
    const settings = exposing?.props
    // Maps the lux the camera exposes as middle grey to mid-grey on screen. Babylon's PBR diffuse
    // includes the 1/π of a Lambertian surface, hence the π.
    const key = settings ? keyLux(settings) : 500
    this.display.exposure = Math.PI / key
    // White balance is applied to the whole image in the display pass (like a camera), so emitters,
    // bounce and ambient are all balanced consistently.
    this.display.wbGains = whiteBalanceGain(settings)

    // Polarizer: cuts specular reflections as the ring turns (0° = none cut, 90° = most cut).
    const pol = settings?.polarizer.fitted ? Math.cos(settings.polarizer.angle * DEG) ** 2 : 1
    const specular = settings?.polarizer.fitted ? 0.15 + 0.85 * pol : 1
    let specularChanged = false
    ;[...this.figureMaterials.all(), ...this.architecture.polarizable].forEach(m => {
      if (m.specularIntensity !== specular) { m.specularIntensity = specular; specularChanged = true }
    })

    // Equipment stays readable at any exposure.
    this.markerMaterial.emissiveColor = new Color3(0.035, 0.035, 0.04).scale(key / Math.PI)
    // Blocking tape on the floor, also readable at any exposure.
    this.tapeMarks.setBrightness((0.5 * key) / Math.PI)
    if (this.tapeMarks.sync(doc.marks ?? [], ownerColour)) this.requestRender()

    let lightsChanged = false
    let subjectsChanged = false
    let camerasChanged = false
    let cameraMoved = false
    const seen = new Set<string>()
    const cameras: CameraItem[] = []
    doc.items.forEach(item => {
      // Set dressing is built by the props layer (merged meshes, shared materials).
      if (item.kind === 'prop') return
      seen.add(item.id)
      let entry = this.entries.get(item.id)
      const entryKey = item.kind === 'light' ? lightKey(item) : item.kind
      if (entry && entry.key !== entryKey) {
        this.removeEntry(item.id)
        entry = undefined
      }
      // A subject looking at someone re-poses when they move.
      const lookAt = item.kind === 'subject' ? subjectProps(item).lookAt : null
      const target = lookAt ? doc.items.find(i => i.id === lookAt) : undefined
      const snapshot = JSON.stringify(item) + (target ? JSON.stringify([target.x, target.z, target.height, target.kind === 'subject' ? target.props : 0]) : '')
      if (!entry) {
        entry = this.createEntry(item, entryKey)
        this.entries.set(item.id, entry)
      } else if (this.snapshots.get(item.id) === snapshot) {
        if (item.kind === 'camera') cameras.push(item)
        return
      }
      this.snapshots.set(item.id, snapshot)
      if (item.kind === 'camera') {
        cameras.push(item)
        camerasChanged = true
        const geometry = JSON.stringify([item.x, item.z, item.height, item.rotationY, item.props.tilt, item.props.lensId, item.props.fps])
        if (this.cameraGeometry.get(item.id) !== geometry) { this.cameraGeometry.set(item.id, geometry); cameraMoved = true }
        return
      }
      if (item.kind === 'light') lightsChanged = true
      if (item.kind === 'subject') subjectsChanged = true
      this.updateEntry(entry, item, doc)
    })
    this.entries.forEach((entry, id) => {
      if (seen.has(id)) return
      if (entry.kind === 'light') lightsChanged = true
      if (entry.kind === 'subject') subjectsChanged = true
      this.removeEntry(id)
      this.snapshots.delete(id)
    })
    // Cameras depend on subjects (autofocus distance), so refresh them when either changed.
    cameras.forEach(cam => {
      const entry = this.entries.get(cam.id)
      if (entry && (camerasChanged || subjectsChanged || !entry.viewCamera?.fov)) this.updateEntry(entry, cam, doc)
    })
    if (this.viewingId && !this.entries.has(this.viewingId)) this.viewThrough(null)

    if (lightsChanged || subjectsChanged || this.slots.size === 0) this.assignLights(doc)
    // Ambient = estimated room bounce (tinted by the lights, scaled by the Bounce control) + light
    // from outside (time of day, its own colour temperature). Blackout removes both: direct light only.
    const worldKey = JSON.stringify(doc.world)
    if (lightsChanged || rebuilt || worldKey !== this.worldKey) {
      this.worldKey = worldKey
      const bounce = sceneBounce(doc)
      const fill = bounceLux(doc.world, bounce.lux)
      const outside = worldLux(doc.world)
      const sky = lightColour('cct', doc.world.kelvin, 0, 0, 0)
      const total = fill + outside
      const mix = (i: number) => (total > 0 ? (bounce.colour[i] * fill + sky[i] * outside) / total : 1)
      this.ambient.intensity = total
      this.ambient.diffuse = new Color3(mix(0), mix(1), mix(2))
      this.ambient.groundColor = this.ambient.diffuse.scale(0.8)
    }
    // Lamps with a lit practical bulb glow in the bulb's colour, by its dimmer.
    const bulbs = new Map<string, LightItem>()
    doc.items.forEach(i => { if (i.kind === 'light' && i.attachedTo) bulbs.set(i.attachedTo, i) })
    this.propItems = doc.items.filter((i): i is PropItem => i.kind === 'prop')
    this.propGlow = id => {
      const bulb = bulbs.get(id)
      if (!bulb || bulb.props.dimmer <= 0) return null
      const c = lightColour(bulb.props.mode, bulb.props.cct, bulb.props.gm, bulb.props.hue, bulb.props.sat)
      return { colour: [+c[0].toFixed(3), +c[1].toFixed(3), +c[2].toFixed(3)], level: Math.round(bulb.props.dimmer) / 100 * 1.6 }
    }
    const propsChanged = this.propsLayer.sync(this.propItems, this.propGlow, performance.now() + PROP_BUILD_BUDGET_MS)
    this.reportBuilding()
    this.propsLayer.materials.setBrightness((0.8 * key) / Math.PI)
    if (propsChanged) this.requestRender()
    // Shadow maps re-draw every caster (a furnished house is hundreds of meshes), so a moving subject
    // (blocking playback, dragging) refreshes them at most every SHADOW_MOTION_MS; edits that rebuild
    // the set refresh at once.
    if (rebuilt || propsChanged) this.refreshShadowsNow()
    else if (subjectsChanged) this.refreshShadowsSoon()
    else if (lightsChanged) this.pool.refreshShadows(null)
    // Depth (for depth of field) only changes when something moved, not when exposure/WB/ISO change.
    if (rebuilt || subjectsChanged || lightsChanged || cameraMoved || propsChanged) this.entries.forEach(entry => entry.pipeline?.invalidate())
    if (rebuilt) this.applyLayers()
    const sceneChanged = rebuilt || lightsChanged || subjectsChanged || cameraMoved || specularChanged || !this.hasFrame
    if (sceneChanged) {
      this.awaitingReady = true
      this.requestRender()
    } else {
      this.needsReprocess = true
    }
  }

  // Hand pool lights to fixtures. The fixtures that matter most to the shot (brightest on the
  // subjects) get the shadowed slots; the rest still light the scene without shadows.
  private assignLights(doc: SceneDoc): void {
    const lights = doc.items.filter((i): i is LightItem => i.kind === 'light')
    const subjects = doc.items.filter((i): i is SubjectItem => i.kind === 'subject')
    const scored = lights.map(item => {
      const resolved = resolveLight(item)
      const onSubjects = subjects.reduce((m, s) => Math.max(m, illuminanceAt(item, subjectMeterPoint(s))), 0)
      return { item, resolved, score: subjects.length ? onSubjects : resolved.candela }
    }).sort((a, b) => b.score - a.score)
    const budget = this.pool.budget
    let spots = budget.spots
    let points = budget.points
    const requests: LightRequest[] = scored.map(({ item, resolved }) => {
      const type = resolved.omni ? 'point' : 'spot'
      const shadow = type === 'spot' ? spots-- > 0 : points-- > 0
      return { id: item.id, type, shadow }
    })
    this.slots = this.pool.assign(requests)
    scored.forEach(({ item, resolved }) => {
      const slot = this.slots.get(item.id)
      if (slot) this.applyLight(slot, item, resolved)
    })
    const shadowed = scored.filter(({ item }) => this.slots.get(item.id)?.shadows).map(({ item }) => item.id)
    if (JSON.stringify(shadowed) !== JSON.stringify(renderState.shadowed)) renderState.shadowed = shadowed
  }

  private applyLight(slot: Slot, item: LightItem, resolved: ResolvedLight): void {
    const verticalTube = resolved.emitter.shape === 'tube' && item.props.orientation === 'vertical'
    const tilt = verticalTube ? 0 : item.props.tilt
    const [r, g, b] = resolved.colour
    const colour = new Color3(r, g, b)
    const light = slot.light
    light.position.set(item.x, item.height, item.z)
    light.intensity = resolved.candela
    light.diffuse = colour
    light.specular = colour
    if (light instanceof SpotLight) {
      const [dx, dy, dz] = headingDirection(item.rotationY, tilt)
      light.direction = new Vector3(dx, dy, dz)
      light.angle = resolved.coneAngle * DEG
      light.innerAngle = resolved.innerAngle * DEG
      light.shadowAngleScale = Math.min(1, MAX_SHADOW_CONE / resolved.coneAngle)
    }
    // Contact-hardening shadows: penumbra grows with the source size (softbox vs bare COB).
    if (slot.shadows?.useContactHardeningShadow) {
      slot.shadows.contactHardeningLightSizeUVRatio = Math.min(Math.max(resolved.sourceSize * 0.12, 0.01), 0.3)
    }
  }

  private applyViewport(): void {
    this.entries.forEach(entry => entry.pipeline?.invalidate())
    const width = this.canvas.clientWidth || 1
    const height = this.canvas.clientHeight || 1
    const r = this.imageRect
    // Babylon viewports are normalised with a bottom-left origin.
    const viewport = new Viewport(r.x / width, 1 - (r.y + r.height) / height, r.width / width, r.height / height)
    this.entries.forEach(entry => {
      if (entry.viewCamera) entry.viewCamera.viewport = viewport
    })
  }

  // Scopes read the latest rendered frame (only after a new frame, at the tier's rate).
  private readScopes(): void {
    if (!this.scopeCallback || !this.viewingId || this.reading || !this.scopeFrameDirty) return
    const now = performance.now()
    if (now - this.lastScopeRead < this.tier.scopeIntervalMs) return
    this.scopeFrameDirty = false
    this.lastScopeRead = now
    const pipeline = this.entries.get(this.viewingId)?.pipeline
    const graded = pipeline?.readGraded()
    // Not ready yet (e.g. the downsample shader is compiling): try again after the next frame.
    if (!graded) {
      this.scopeFrameDirty = true
      this.requestReprocessSoon()
      return
    }
    this.reading = true
    graded.then(frame => {
      this.reading = false
      this.scopeCallback?.(frame)
    }).catch(() => { this.reading = false })
  }

  private requestReprocessSoon(): void {
    setTimeout(() => { this.needsReprocess = true }, 50)
  }

  private createSurface(name: string, color: Color3, roughness: number): PBRMaterial {
    const material = new PBRMaterial(name, this.scene)
    material.albedoColor = color
    material.metallic = 0
    material.roughness = roughness
    material.maxSimultaneousLights = 16
    // glTF falloff: physical 1/d² with a controllable inner/outer spot cone (hard projection edges,
    // soft softbox edges). Babylon's "physical" mode would replace every cone with a soft Gaussian.
    material.useGLTFLightFalloff = true
    return material
  }

  private unpickable<T extends AbstractMesh>(mesh: T, parent: TransformNode): T {
    mesh.isPickable = false
    mesh.parent = parent
    return mesh
  }

  private createEntry(item: SceneItem, key: string): Entry {
    const root = new TransformNode(item.id, this.scene)
    const entry: Entry = { kind: item.kind, key, root }
    if (item.kind === 'subject') this.buildSubject(entry)
    if (item.kind === 'light') this.buildLight(entry, item)
    if (item.kind === 'camera') this.buildCamera(entry)
    return entry
  }

  private removeEntry(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    if (this.viewingId === id) this.viewThrough(null)
    if (entry.pipeline && entry.viewCamera) entry.pipeline.dispose(entry.viewCamera)
    entry.viewCamera?.dispose()
    entry.emitterMaterial?.dispose()
    entry.figure?.dispose()
    entry.root.dispose(false, false)
    this.entries.delete(id)
  }

  // A posable mannequin (see Mannequin.ts and src/subjects/).
  private buildSubject(entry: Entry): void {
    entry.figure = new Mannequin(this.scene, this.figureMaterials, entry.root)
    entry.casters = entry.figure.meshes
  }

  private buildLight(entry: Entry, item: LightItem): void {
    const resolved = resolveLight(item)
    const head = new TransformNode('head', this.scene)
    head.parent = entry.root
    entry.head = head

    // The actual light comes from the pool (see assignLights); this is the fixture's body.
    entry.omni = resolved.omni

    // Emitting surfaces are HDR: they glow at their real luminance, so they clip in frame like real
    // sources and turn into bokeh when out of focus.
    const emitter = new ShaderMaterial(`${item.id}-emitter`, this.scene, 'previsEmitter', {
      attributes: ['position'],
      uniforms: ['worldViewProjection', 'radiance']
    })
    emitter.backFaceCulling = false
    entry.emitterMaterial = emitter
    entry.emitterArea = this.buildEmitter(entry, resolved)

    if (resolved.emitter.shape !== 'bulb') {
      const stand = MeshBuilder.CreateCylinder('stand', { height: 1, diameter: 0.03 }, this.scene)
      stand.material = this.markerMaterial
      entry.stand = this.unpickable(stand, entry.root)
    }
  }

  // Builds the visible fixture in head space: the emitting face sits at the origin facing +z,
  // housings extend behind it (-z). Returns the emitting area (m²) seen face-on.
  private buildEmitter(entry: Entry, resolved: ResolvedLight): number {
    const head = entry.head as TransformNode
    const emitterMaterial = entry.emitterMaterial as ShaderMaterial
    const { shape, w, h, depth } = resolved.emitter
    const glowing: Mesh[] = []
    const body: Mesh[] = []
    let area = 0.01
    const faceForward = (mesh: Mesh) => { mesh.rotation.y = Math.PI; return mesh }
    const alongZ = (mesh: Mesh, length: number) => {
      mesh.rotation.x = Math.PI / 2
      mesh.position.z = -length / 2
      return mesh
    }

    switch (shape) {
      case 'rect': {
        const face = faceForward(MeshBuilder.CreatePlane('face', { width: w, height: h }, this.scene))
        face.position.z = 0.005
        glowing.push(face)
        const box = MeshBuilder.CreateBox('housing', { width: w, height: h, depth }, this.scene)
        box.position.z = -depth / 2
        body.push(box)
        area = w * h
        break
      }
      case 'octa':
      case 'dish':
      case 'reflector': {
        const tessellation = shape === 'octa' ? 8 : 32
        const shell = MeshBuilder.CreateCylinder('shell', { height: depth, diameterTop: w, diameterBottom: Math.min(0.15, w), tessellation, cap: Mesh.NO_CAP, sideOrientation: Mesh.DOUBLESIDE }, this.scene)
        body.push(alongZ(shell, depth))
        const face = faceForward(MeshBuilder.CreateDisc('face', { radius: w / 2 - 0.005, tessellation }, this.scene))
        face.position.z = -0.01
        glowing.push(face)
        area = Math.PI * (w / 2) ** 2
        break
      }
      case 'sphere': {
        glowing.push(MeshBuilder.CreateSphere('lantern', { diameter: w, segments: 16 }, this.scene))
        area = Math.PI * (w / 2) ** 2
        break
      }
      case 'lens': {
        const barrel = MeshBuilder.CreateCylinder('barrel', { height: depth, diameter: w, tessellation: 24 }, this.scene)
        body.push(alongZ(barrel, depth))
        const face = faceForward(MeshBuilder.CreateDisc('lens', { radius: w * 0.4, tessellation: 24 }, this.scene))
        face.position.z = 0.002
        glowing.push(face)
        area = Math.PI * (w * 0.4) ** 2
        break
      }
      case 'cob': {
        const face = faceForward(MeshBuilder.CreateDisc('cob', { radius: 0.03, tessellation: 16 }, this.scene))
        face.position.z = 0.002
        glowing.push(face)
        area = Math.PI * 0.03 ** 2
        break
      }
      case 'tube': {
        glowing.push(MeshBuilder.CreateCylinder('tube', { height: w, diameter: 0.035, tessellation: 12 }, this.scene))
        area = w * 0.035
        break
      }
      case 'bulb': {
        glowing.push(MeshBuilder.CreateSphere('bulb', { diameter: 0.07, segments: 12 }, this.scene))
        area = Math.PI * 0.035 ** 2
        break
      }
    }

    // COB fixtures get their head body behind the modifier.
    if (resolved.fixture.shape.type === 'cob') {
      const size = resolved.fixture.shape.size
      const cobBody = MeshBuilder.CreateBox('fixture', { width: size * 0.8, height: size * 0.8, depth: size }, this.scene)
      cobBody.position.z = -(shape === 'sphere' ? w / 2 : depth) - size / 2
      body.push(cobBody)
    }

    glowing.forEach(mesh => {
      mesh.material = emitterMaterial
      this.unpickable(mesh, head)
    })
    body.forEach(mesh => {
      mesh.material = this.markerMaterial
      this.unpickable(mesh, head)
    })
    return area
  }

  private buildCamera(entry: Entry): void {
    const rig = new TransformNode('rig', this.scene)
    rig.parent = entry.root
    const body = MeshBuilder.CreateBox('camBody', { width: 0.13, height: 0.09, depth: 0.1 }, this.scene)
    const lens = MeshBuilder.CreateCylinder('camLens', { height: 0.16, diameter: 0.11 }, this.scene)
    lens.rotation.x = Math.PI / 2
    lens.position.z = 0.13
    ;[body, lens].forEach(mesh => {
      mesh.material = this.markerMaterial
      this.unpickable(mesh, rig)
    })
    const tripod = MeshBuilder.CreateCylinder('tripod', { height: 1, diameter: 0.03 }, this.scene)
    tripod.material = this.markerMaterial
    entry.stand = this.unpickable(tripod, entry.root)
    entry.head = rig

    const viewCamera = new UniversalCamera(`${entry.root.name}-view`, Vector3.Zero(), this.scene)
    viewCamera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED
    viewCamera.minZ = 0.05
    viewCamera.maxZ = 200
    viewCamera.layerMask = this.viewMask()
    entry.viewCamera = viewCamera
  }

  private updateEntry(entry: Entry, item: SceneItem, doc: SceneDoc): void {
    entry.root.position.set(item.x, 0, item.z)
    entry.root.rotation.y = item.rotationY * DEG
    if (item.kind === 'subject') this.updateSubject(entry, item, doc)
    if (item.kind === 'light') this.updateLight(entry, item)
    if (item.kind === 'camera') this.updateCamera(entry, item, doc)
  }

  private updateSubject(entry: Entry, item: SubjectItem, doc: SceneDoc): void {
    const figure = entry.figure as Mannequin
    figure.setColours(subjectProps(item))
    figure.pose(solveSubject(item, doc.items))
  }

  private updateLight(entry: Entry, item: LightItem): void {
    const resolved = resolveLight(item)
    const verticalTube = resolved.emitter.shape === 'tube' && item.props.orientation === 'vertical'
    const tilt = verticalTube ? 0 : item.props.tilt

    const head = entry.head as TransformNode
    head.position.y = item.height
    head.rotation.x = tilt * DEG
    if (resolved.emitter.shape === 'tube') {
      const tube = head.getChildMeshes(true)[0]
      tube.rotation.z = verticalTube ? 0 : Math.PI / 2
    }

    const [r, g, b] = resolved.colour
    const colour = new Color3(r, g, b)

    // Emitting face luminance (cd/m²) = intensity / area — the same units the lit surfaces render in.
    const emitter = entry.emitterMaterial as ShaderMaterial
    // Capped inside half-float range: anything this bright clips to white at any exposure anyway.
    const peak = Math.max(colour.r, colour.g, colour.b, 1e-3)
    const luminanceCdM2 = Math.min(resolved.candela / (entry.emitterArea || 0.01), 50000 / peak)
    emitter.setColor3('radiance', colour.scale(luminanceCdM2))

    if (entry.stand) {
      const standHeight = Math.max(item.height - 0.1, 0.05)
      entry.stand.scaling.y = standHeight
      entry.stand.position.y = standHeight / 2
      // Keep the stand under the fixture body, behind the face.
      entry.stand.position.z = -Math.min(resolved.emitter.depth, 0.3)
    }
  }

  private updateCamera(entry: Entry, item: CameraItem, doc: SceneDoc): void {
    const p = item.props
    const rig = entry.head as TransformNode
    rig.position.y = item.height
    rig.rotation.x = p.tilt * DEG
    const tripod = entry.stand as Mesh
    tripod.scaling.y = item.height - 0.05
    tripod.position.y = (item.height - 0.05) / 2

    const viewCamera = entry.viewCamera as UniversalCamera
    viewCamera.position.set(item.x, item.height, item.z)
    viewCamera.rotation.set(p.tilt * DEG, item.rotationY * DEG, 0)
    viewCamera.fov = horizontalFov(p)

    if (entry.pipeline) {
      const body = getBody(p.bodyId)
      const profile = body.profiles.find(pr => pr.id === p.profile) ?? body.profiles[0]
      // Noise grows with gain above the nearest base ISO (S-Log3 has a second, high base at 12800).
      const base = profile.baseIsos.length ? profile.baseIsos.filter(b => b <= p.iso).pop() ?? profile.baseIsos[0] : 800
      const gain = Math.max(p.iso / base, 0.5)
      const format = body.format
      Object.assign(entry.pipeline.settings, {
        imageAspect: format.width / format.height,
        focusM: focusDistance(item, doc),
        focalMm: getLens(p.lensId).focalLength,
        fNumber: p.tStop,
        imageWidthMm: imageWidthMm(p),
        zebras: p.display.zebras,
        zebraLevel: p.display.zebraLevel,
        falseColour: p.display.falseColour,
        noiseAmp: Math.min(0.012 * Math.sqrt(gain), 0.15)
      })
    }
  }

  // Subjects and the architecture (walls, doors) cast shadows, so light falls through doorways and
  // windows the way it would on location.
  private shadowCasters(): AbstractMesh[] {
    const casters: AbstractMesh[] = [...this.architecture.casters, ...this.propsLayer.casters(this.tier.id !== 'lite')]
    this.entries.forEach(entry => {
      if (entry.kind === 'subject' && entry.casters) casters.push(...entry.casters)
    })
    return casters
  }
}
