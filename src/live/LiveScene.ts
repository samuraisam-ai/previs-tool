import {
  AbstractMesh,
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  Effect,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  RenderTargetTexture,
  Scene,
  ShadowGenerator,
  ShaderMaterial,
  ShadowLight,
  SpotLight,
  TransformNode,
  UniversalCamera,
  Vector3,
  Viewport
} from '@babylonjs/core'
import { getBody } from '../library/cameras'
import { kelvinToSrgb, luminance, RGB, srgbToLinear } from '../library/colour'
import { getLens } from '../library/lenses'
import { focusDistance, horizontalFov, imageWidthMm, keyLux } from '../library/optics'
import { headingDirection, ResolvedLight, resolveLight } from '../library/photometry'
import { CameraItem, CameraProps, LightItem, SceneDoc, SceneItem, SubjectItem } from '../scene/types'
import { Architecture, LAYER } from './Architecture'
import { sceneBounce } from '../scene/store'
import { attachDisplay, CameraPipeline, DisplaySettings } from './CameraPipeline'

const DEG = Math.PI / 180
// Widest cone the shadow map covers; wider sources still light, but only shadow inside this.
const MAX_SHADOW_CONE = 120
// Scopes sample the graded frame this often.
const SCOPE_INTERVAL_MS = 200

interface Entry {
  kind: SceneItem['kind']
  key: string
  root: TransformNode
  head?: TransformNode
  light?: ShadowLight
  shadows?: ShadowGenerator
  emitterMaterial?: ShaderMaterial
  emitterArea?: number
  stand?: Mesh
  casters?: AbstractMesh[]
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
  private subjectMaterial: PBRMaterial
  private markerMaterial: PBRMaterial
  private resizeObserver: ResizeObserver
  private display: DisplaySettings = { exposure: 1, wbGains: [1, 1, 1] }
  private scopeCallback: ((frame: FrameCapture) => void) | null = null
  private lastScopeRead = 0
  private reading = false

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
    this.applyLayers()
    // Slightly glossy skin gives the polarizer something to cut (floors have per-finish sheen).
    this.subjectMaterial = this.createSurface('subject', new Color3(0.72, 0.58, 0.48), 0.55)
    this.markerMaterial = this.createSurface('marker', new Color3(0.04, 0.04, 0.045), 0.6)

    this.engine.runRenderLoop(() => this.scene.render())
    this.engine.onEndFrameObservable.add(() => this.readScopes())
    this.resizeObserver = new ResizeObserver(() => {
      this.engine.resize()
      this.applyViewport()
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
    this.viewingId = entry?.viewCamera ? cameraId : null
    if (entry?.viewCamera && !entry.pipeline) entry.pipeline = new CameraPipeline(this.scene, entry.viewCamera, this.display)
    this.scene.activeCamera = entry?.viewCamera ?? this.orbitCamera
    // Hide the camera body we're looking through so it doesn't block its own view.
    this.entries.forEach((e, id) => {
      if (e.kind === 'camera') e.root.setEnabled(id !== this.viewingId)
    })
    this.applyViewport()
  }

  // Render resolution relative to CSS pixels (1 = draft, 2 = full retina), capped at the display's DPR.
  setQuality(scale: number): void {
    const ratio = Math.min(scale, window.devicePixelRatio || 1)
    this.engine.setHardwareScalingLevel(1 / ratio)
    this.engine.resize()
    this.entries.forEach(entry => entry.pipeline?.invalidate())
  }

  getFps(): number {
    return this.engine.getFps()
  }

  // The recorded image area within the canvas (CSS pixels, top-left origin), e.g. a 16:9 letterbox.
  setImageRect(rect: { x: number; y: number; width: number; height: number }): void {
    this.imageRect = rect
    this.applyViewport()
  }

  // Receive the graded frame a few times a second (for scopes). null stops it.
  onFrame(callback: ((frame: FrameCapture) => void) | null): void {
    this.scopeCallback = callback
  }

  // Orbit view: walls cut at hip height (dollhouse) or full height.
  setCutaway(on: boolean): void {
    this.cutaway = on
    this.applyLayers()
  }

  private applyLayers(): void {
    this.orbitCamera.layerMask = LAYER.COMMON | (this.cutaway ? LAYER.CUT_WALLS : LAYER.FULL_WALLS)
    this.entries.forEach(entry => {
      if (entry.viewCamera) entry.viewCamera.layerMask = LAYER.COMMON | LAYER.FULL_WALLS | LAYER.CEILING
    })
  }

  sync(doc: SceneDoc): void {
    const rebuilt = this.architecture.sync(doc)

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
    ;[this.subjectMaterial, ...this.architecture.polarizable].forEach(m => { m.specularIntensity = specular })

    // Equipment stays readable at any exposure.
    this.markerMaterial.emissiveColor = new Color3(0.035, 0.035, 0.04).scale(key / Math.PI)
    // Ambient = estimated room bounce (tinted by the lights) + a little base fill.
    const bounce = sceneBounce(doc)
    this.ambient.intensity = bounce.lux + doc.ambientLux
    this.ambient.diffuse = new Color3(bounce.colour[0], bounce.colour[1], bounce.colour[2])
    this.ambient.groundColor = this.ambient.diffuse.scale(0.8)

    const seen = new Set<string>()
    doc.items.forEach(item => {
      seen.add(item.id)
      let entry = this.entries.get(item.id)
      const entryKey = item.kind === 'light' ? lightKey(item) : item.kind
      if (entry && entry.key !== entryKey) {
        this.removeEntry(item.id)
        entry = undefined
      }
      if (!entry) {
        entry = this.createEntry(item, entryKey)
        this.entries.set(item.id, entry)
      }
      this.updateEntry(entry, item, doc)
    })

    this.entries.forEach((_entry, id) => {
      if (!seen.has(id)) this.removeEntry(id)
    })

    if (this.viewingId && !this.entries.has(this.viewingId)) this.viewThrough(null)
    this.refreshShadowCasters()
    this.entries.forEach(entry => entry.pipeline?.invalidate())
    if (rebuilt) this.applyLayers()
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

  private readScopes(): void {
    if (!this.scopeCallback || !this.viewingId || this.reading) return
    const now = performance.now()
    if (now - this.lastScopeRead < SCOPE_INTERVAL_MS) return
    this.lastScopeRead = now
    const pipeline = this.entries.get(this.viewingId)?.pipeline
    const graded = pipeline?.readGraded()
    if (graded) {
      this.reading = true
      graded.then(frame => {
        this.reading = false
        this.scopeCallback?.(frame)
      }).catch(() => { this.reading = false })
      return
    }
    const viewport = this.scene.activeCamera?.viewport
    if (!viewport) return
    const w = this.engine.getRenderWidth()
    const h = this.engine.getRenderHeight()
    const x = Math.round(viewport.x * w)
    const y = Math.round(viewport.y * h)
    const width = Math.max(1, Math.round(viewport.width * w))
    const height = Math.max(1, Math.round(viewport.height * h))
    this.reading = true
    this.engine.readPixels(x, y, width, height, true, false).then(pixels => {
      this.reading = false
      this.scopeCallback?.({ data: pixels as Uint8Array, width, height })
    }).catch(() => { this.reading = false })
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
    entry.shadows?.dispose()
    entry.light?.dispose()
    entry.viewCamera?.dispose()
    entry.emitterMaterial?.dispose()
    entry.root.dispose(false, false)
    this.entries.delete(id)
  }

  // Stand-in mannequin: body + head + nose so you can see which way it faces.
  private buildSubject(entry: Entry): void {
    const body = MeshBuilder.CreateCapsule('body', { height: 1, radius: 0.2 }, this.scene)
    const head = MeshBuilder.CreateSphere('head', { diameter: 0.24 }, this.scene)
    const nose = MeshBuilder.CreateBox('nose', { width: 0.05, height: 0.05, depth: 0.08 }, this.scene)
    const parts = [body, head, nose]
    parts.forEach(mesh => {
      mesh.material = this.subjectMaterial
      mesh.receiveShadows = true
      this.unpickable(mesh, entry.root)
    })
    entry.casters = parts
  }

  private buildLight(entry: Entry, item: LightItem): void {
    const resolved = resolveLight(item)
    const head = new TransformNode('head', this.scene)
    head.parent = entry.root
    entry.head = head

    let light: ShadowLight
    let shadows: ShadowGenerator
    if (resolved.omni) {
      light = new PointLight(item.id, Vector3.Zero(), this.scene)
      shadows = new ShadowGenerator(1024, light)
      shadows.usePoissonSampling = true
    } else {
      light = new SpotLight(item.id, Vector3.Zero(), new Vector3(0, -1, 0), Math.PI / 3, 1, this.scene)
      shadows = new ShadowGenerator(2048, light)
      // Contact-hardening shadows: penumbra grows with the source size (softbox vs bare COB).
      shadows.useContactHardeningShadow = true
      shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
      shadows.contactHardeningLightSizeUVRatio = Math.min(Math.max(resolved.sourceSize * 0.12, 0.01), 0.3)
    }
    light.shadowMinZ = 0.05
    light.shadowMaxZ = 25
    shadows.bias = 0.0008
    entry.light = light
    entry.shadows = shadows

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
    viewCamera.layerMask = LAYER.COMMON | LAYER.FULL_WALLS | LAYER.CEILING
    entry.viewCamera = viewCamera
  }

  private updateEntry(entry: Entry, item: SceneItem, doc: SceneDoc): void {
    entry.root.position.set(item.x, 0, item.z)
    entry.root.rotation.y = item.rotationY * DEG
    if (item.kind === 'subject') this.updateSubject(entry, item)
    if (item.kind === 'light') this.updateLight(entry, item)
    if (item.kind === 'camera') this.updateCamera(entry, item, doc)
  }

  private updateSubject(entry: Entry, item: SubjectItem): void {
    const [body, head, nose] = entry.casters as Mesh[]
    const bodyHeight = item.height - 0.26
    body.scaling.y = bodyHeight
    body.position.y = bodyHeight / 2
    head.position.y = item.height - 0.12
    nose.position.set(0, item.height - 0.12, 0.13)
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
    const light = entry.light as ShadowLight
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

  private refreshShadowCasters(): void {
    // Subjects and the architecture (walls, doors) cast shadows, so light falls through doorways
    // and windows the way it would on location.
    const casters: AbstractMesh[] = [...this.architecture.casters]
    this.entries.forEach(entry => {
      if (entry.kind === 'subject' && entry.casters) casters.push(...entry.casters)
    })
    this.entries.forEach(entry => {
      const shadowMap = entry.shadows?.getShadowMap()
      if (!shadowMap) return
      shadowMap.renderList = casters.slice()
      // The scene only changes when the plan does, so shadow maps render once per change rather
      // than every frame (a big saving on integrated GPUs).
      shadowMap.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE
      shadowMap.resetRefreshCounter()
    })
  }
}
