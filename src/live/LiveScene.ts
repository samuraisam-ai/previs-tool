import {
  AbstractMesh,
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  Engine,
  GlowLayer,
  HemisphericLight,
  ImageProcessingConfiguration,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  PointLight,
  Scene,
  ShadowGenerator,
  ShadowLight,
  SpotLight,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3
} from '@babylonjs/core'
import { headingDirection, keyLuxFor, ResolvedLight, resolveLight } from '../library/photometry'
import { CameraItem, horizontalFov, LightItem, Room, SceneDoc, SceneItem, SubjectItem } from '../scene/types'

const DEG = Math.PI / 180
// Widest cone the shadow map covers; wider sources still light, but only shadow inside this.
const MAX_SHADOW_CONE = 120

interface Entry {
  kind: SceneItem['kind']
  key: string
  root: TransformNode
  head?: TransformNode
  light?: ShadowLight
  shadows?: ShadowGenerator
  glowMaterial?: StandardMaterial
  stand?: Mesh
  casters?: AbstractMesh[]
  viewCamera?: UniversalCamera
}

const lightKey = (item: LightItem) => `${item.props.fixtureId}|${item.props.modifierId}|${item.props.orientation}`

// Read-only 3D view of a SceneDoc. The scene is rebuilt/updated from the document via sync();
// nothing in here is pickable — the only interactive thing is the orbit camera.
export class LiveScene {
  private engine: Engine
  public scene: Scene
  private orbitCamera: ArcRotateCamera
  private ambient: HemisphericLight
  private glow: GlowLayer
  private entries = new Map<string, Entry>()
  private roomRoot: TransformNode | null = null
  private roomKey = ''
  private viewingId: string | null = null
  private surfaceMaterial: PBRMaterial
  private subjectMaterial: PBRMaterial
  private markerMaterial: StandardMaterial
  // Emitters and equipment are drawn at fixed brightness, independent of camera exposure.
  private unexposed: ImageProcessingConfiguration
  private resizeObserver: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true)
    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.02, 0.02, 0.03, 1)
    this.scene.skipPointerMovePicking = true

    const processing = this.scene.imageProcessingConfiguration
    processing.toneMappingEnabled = true
    processing.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES

    this.unexposed = new ImageProcessingConfiguration()
    this.unexposed.toneMappingEnabled = false
    this.unexposed.exposure = 1

    this.orbitCamera = new ArcRotateCamera('orbit', -Math.PI / 2, 1.05, 9, new Vector3(0, 1, 0), this.scene)
    this.orbitCamera.lowerRadiusLimit = 1
    this.orbitCamera.upperRadiusLimit = 30
    this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.02
    this.orbitCamera.wheelPrecision = 40
    this.orbitCamera.panningSensibility = 400
    this.orbitCamera.minZ = 0.05
    this.orbitCamera.attachControl(this.canvas, true)

    this.ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene)

    this.glow = new GlowLayer('glow', this.scene, { mainTextureSamples: 4 })
    this.glow.intensity = 0.6

    this.surfaceMaterial = this.createMatte('surface', new Color3(0.5, 0.5, 0.5))
    this.subjectMaterial = this.createMatte('subject', new Color3(0.72, 0.58, 0.48))
    this.markerMaterial = this.createFlat('marker', new Color3(0.13, 0.13, 0.15))

    this.engine.runRenderLoop(() => this.scene.render())
    this.resizeObserver = new ResizeObserver(() => this.engine.resize())
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
    this.scene.activeCamera = entry?.viewCamera ?? this.orbitCamera
    // Hide the camera body we're looking through so it doesn't block its own view.
    this.entries.forEach((e, id) => {
      if (e.kind === 'camera') e.root.setEnabled(id !== this.viewingId)
    })
  }

  sync(doc: SceneDoc): void {
    this.syncRoom(doc.room)
    // Exposure maps the lux that the camera settings expose as middle grey to mid-grey on screen.
    // Babylon's PBR diffuse includes the 1/π of a Lambertian surface, hence the π.
    this.scene.imageProcessingConfiguration.exposure = Math.PI / keyLuxFor(doc.exposure)
    this.ambient.intensity = doc.ambientLux

    const seen = new Set<string>()
    doc.items.forEach(item => {
      seen.add(item.id)
      let entry = this.entries.get(item.id)
      const key = item.kind === 'light' ? lightKey(item) : item.kind
      if (entry && entry.key !== key) {
        this.removeEntry(item.id)
        entry = undefined
      }
      if (!entry) {
        entry = this.createEntry(item, key)
        this.entries.set(item.id, entry)
      }
      this.updateEntry(entry, item)
    })

    this.entries.forEach((_entry, id) => {
      if (!seen.has(id)) this.removeEntry(id)
    })

    if (this.viewingId && !this.entries.has(this.viewingId)) this.viewThrough(null)
    this.refreshShadowCasters()
  }

  private createMatte(name: string, color: Color3): PBRMaterial {
    const material = new PBRMaterial(name, this.scene)
    material.albedoColor = color
    material.metallic = 0
    material.roughness = 0.85
    material.maxSimultaneousLights = 16
    // glTF falloff: physical 1/d² with a controllable inner/outer spot cone (hard projection edges,
    // soft softbox edges). Babylon's "physical" mode would replace every cone with a soft Gaussian.
    material.useGLTFLightFalloff = true
    return material
  }

  private createFlat(name: string, color: Color3): StandardMaterial {
    const material = new StandardMaterial(name, this.scene)
    material.disableLighting = true
    material.emissiveColor = color
    material.imageProcessingConfiguration = this.unexposed
    return material
  }

  private unpickable<T extends AbstractMesh>(mesh: T, parent: TransformNode): T {
    mesh.isPickable = false
    mesh.parent = parent
    return mesh
  }

  private syncRoom(room: Room): void {
    const key = `${room.width}x${room.depth}x${room.height}`
    if (key === this.roomKey) return
    this.roomKey = key
    this.roomRoot?.dispose(false, false)

    const root = new TransformNode('room', this.scene)
    const { width, depth, height } = room

    const floor = MeshBuilder.CreateGround('floor', { width, height: depth }, this.scene)
    floor.material = this.surfaceMaterial
    floor.receiveShadows = true
    this.unpickable(floor, root)

    // Planes face -z by default; each wall is turned to face into the room so that,
    // with back-face culling, you can see in from outside.
    const walls: Array<[string, number, Vector3, number]> = [
      ['wallNorth', width, new Vector3(0, height / 2, depth / 2), 0],
      ['wallSouth', width, new Vector3(0, height / 2, -depth / 2), Math.PI],
      ['wallEast', depth, new Vector3(width / 2, height / 2, 0), Math.PI / 2],
      ['wallWest', depth, new Vector3(-width / 2, height / 2, 0), -Math.PI / 2]
    ]
    walls.forEach(([name, size, position, rotation]) => {
      const wall = MeshBuilder.CreatePlane(name, { width: size, height }, this.scene)
      wall.position = position
      wall.rotation.y = rotation
      wall.material = this.surfaceMaterial
      wall.receiveShadows = true
      this.unpickable(wall, root)
    })

    this.roomRoot = root
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
    entry.shadows?.dispose()
    entry.light?.dispose()
    entry.viewCamera?.dispose()
    entry.glowMaterial?.dispose()
    entry.root.dispose(false, false)
    this.entries.delete(id)
    if (this.viewingId === id) this.viewThrough(null)
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

    entry.glowMaterial = this.createFlat(`${item.id}-glow`, Color3.White())
    this.buildEmitter(entry, resolved)

    if (resolved.emitter.shape !== 'bulb') {
      const stand = MeshBuilder.CreateCylinder('stand', { height: 1, diameter: 0.03 }, this.scene)
      stand.material = this.markerMaterial
      entry.stand = this.unpickable(stand, entry.root)
    }
  }

  // Builds the visible fixture in head space: the emitting face sits at the origin facing +z,
  // housings extend behind it (-z).
  private buildEmitter(entry: Entry, resolved: ResolvedLight): void {
    const head = entry.head as TransformNode
    const glowMaterial = entry.glowMaterial as StandardMaterial
    const { shape, w, h, depth } = resolved.emitter
    const glowing: Mesh[] = []
    const body: Mesh[] = []
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
        break
      }
      case 'sphere': {
        const sphere = MeshBuilder.CreateSphere('lantern', { diameter: w, segments: 16 }, this.scene)
        glowing.push(sphere)
        break
      }
      case 'lens': {
        const barrel = MeshBuilder.CreateCylinder('barrel', { height: depth, diameter: w, tessellation: 24 }, this.scene)
        body.push(alongZ(barrel, depth))
        const face = faceForward(MeshBuilder.CreateDisc('lens', { radius: w * 0.4, tessellation: 24 }, this.scene))
        face.position.z = 0.002
        glowing.push(face)
        break
      }
      case 'cob': {
        const face = faceForward(MeshBuilder.CreateDisc('cob', { radius: 0.03, tessellation: 16 }, this.scene))
        face.position.z = 0.002
        glowing.push(face)
        break
      }
      case 'tube': {
        glowing.push(MeshBuilder.CreateCylinder('tube', { height: w, diameter: 0.035, tessellation: 12 }, this.scene))
        break
      }
      case 'bulb': {
        glowing.push(MeshBuilder.CreateSphere('bulb', { diameter: 0.07, segments: 12 }, this.scene))
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
      mesh.material = glowMaterial
      this.unpickable(mesh, head)
      this.glow.addIncludedOnlyMesh(mesh)
    })
    body.forEach(mesh => {
      mesh.material = this.markerMaterial
      this.unpickable(mesh, head)
    })
  }

  private buildCamera(entry: Entry): void {
    const body = MeshBuilder.CreateBox('camBody', { width: 0.14, height: 0.14, depth: 0.22 }, this.scene)
    const lens = MeshBuilder.CreateCylinder('camLens', { height: 0.12, diameter: 0.08 }, this.scene)
    lens.rotation.x = Math.PI / 2
    lens.position.z = 0.16
    const tripod = MeshBuilder.CreateCylinder('tripod', { height: 1, diameter: 0.03 }, this.scene)
    ;[body, lens, tripod].forEach(mesh => {
      mesh.material = this.markerMaterial
      this.unpickable(mesh, entry.root)
    })
    lens.parent = body

    const viewCamera = new UniversalCamera(`${entry.root.name}-view`, Vector3.Zero(), this.scene)
    viewCamera.fovMode = Camera.FOVMODE_HORIZONTAL_FIXED
    viewCamera.minZ = 0.05
    entry.viewCamera = viewCamera
  }

  private updateEntry(entry: Entry, item: SceneItem): void {
    entry.root.position.set(item.x, 0, item.z)
    entry.root.rotation.y = item.rotationY * DEG
    if (item.kind === 'subject') this.updateSubject(entry, item)
    if (item.kind === 'light') this.updateLight(entry, item)
    if (item.kind === 'camera') this.updateCamera(entry, item)
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

    // Emitter glow follows colour and dimmer, but not camera exposure.
    const max = Math.max(...resolved.colour)
    const level = item.props.dimmer > 0 ? 0.25 + 0.75 * (item.props.dimmer / 100) : 0.05
    ;(entry.glowMaterial as StandardMaterial).emissiveColor = colour.scale(level / max)

    if (entry.stand) {
      const standHeight = Math.max(item.height - 0.1, 0.05)
      entry.stand.scaling.y = standHeight
      entry.stand.position.y = standHeight / 2
      // Keep the stand under the fixture body, behind the face.
      entry.stand.position.z = -Math.min(resolved.emitter.depth, 0.3)
    }
  }

  private updateCamera(entry: Entry, item: CameraItem): void {
    const children = entry.root.getChildMeshes(true)
    const body = children.find(mesh => mesh.name === 'camBody') as Mesh
    const tripod = children.find(mesh => mesh.name === 'tripod') as Mesh
    body.position.y = item.height
    tripod.scaling.y = item.height - 0.07
    tripod.position.y = (item.height - 0.07) / 2

    const viewCamera = entry.viewCamera as UniversalCamera
    viewCamera.position.set(item.x, item.height, item.z)
    viewCamera.rotation.set(0, item.rotationY * DEG, 0)
    viewCamera.fov = horizontalFov(item.props.focalLength)
  }

  private refreshShadowCasters(): void {
    const casters: AbstractMesh[] = []
    this.entries.forEach(entry => {
      if (entry.kind === 'subject' && entry.casters) casters.push(...entry.casters)
    })
    this.entries.forEach(entry => {
      const shadowMap = entry.shadows?.getShadowMap()
      if (shadowMap) shadowMap.renderList = casters.slice()
    })
  }
}
