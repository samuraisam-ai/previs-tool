import {
  AbstractMesh,
  ArcRotateCamera,
  Camera,
  Color3,
  Color4,
  Engine,
  HemisphericLight,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  ShadowGenerator,
  SpotLight,
  StandardMaterial,
  TransformNode,
  UniversalCamera,
  Vector3
} from '@babylonjs/core'
import { CameraItem, horizontalFov, LightItem, Room, SceneDoc, SceneItem, SubjectItem } from '../scene/types'

const DEG = Math.PI / 180

// Unit vector for a plan heading (0 = +z, clockwise from above) tilted down by `tilt` degrees.
function headingDirection(rotationY: number, tilt = 0): Vector3 {
  const h = rotationY * DEG
  const t = tilt * DEG
  return new Vector3(Math.sin(h) * Math.cos(t), -Math.sin(t), Math.cos(h) * Math.cos(t))
}

interface Entry {
  kind: SceneItem['kind']
  root: TransformNode
  light?: SpotLight
  lightBody?: Mesh
  shadows?: ShadowGenerator
  casters?: AbstractMesh[]
  viewCamera?: UniversalCamera
}

// Read-only 3D view of a SceneDoc. The scene is rebuilt/updated from the document via sync();
// nothing in here is pickable — the only interactive thing is the orbit camera.
export class LiveScene {
  private engine: Engine
  public scene: Scene
  private orbitCamera: ArcRotateCamera
  private entries = new Map<string, Entry>()
  private roomRoot: TransformNode | null = null
  private roomKey = ''
  private viewingId: string | null = null
  private surfaceMaterial: PBRMaterial
  private subjectMaterial: PBRMaterial
  private resizeObserver: ResizeObserver

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true)
    this.scene = new Scene(this.engine)
    this.scene.clearColor = new Color4(0.02, 0.02, 0.03, 1)
    this.scene.skipPointerMovePicking = true

    this.orbitCamera = new ArcRotateCamera('orbit', -Math.PI / 2, 1.05, 9, new Vector3(0, 1, 0), this.scene)
    this.orbitCamera.lowerRadiusLimit = 1
    this.orbitCamera.upperRadiusLimit = 30
    this.orbitCamera.upperBetaLimit = Math.PI / 2 - 0.02
    this.orbitCamera.wheelPrecision = 40
    this.orbitCamera.panningSensibility = 400
    this.orbitCamera.minZ = 0.05
    this.orbitCamera.attachControl(this.canvas, true)

    // A touch of ambient so unlit areas read as dark, not black.
    const ambient = new HemisphericLight('ambient', new Vector3(0, 1, 0), this.scene)
    ambient.intensity = 0.04

    this.surfaceMaterial = this.createMatte('surface', new Color3(0.55, 0.55, 0.55))
    this.subjectMaterial = this.createMatte('subject', new Color3(0.75, 0.62, 0.52))

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

    const seen = new Set<string>()
    doc.items.forEach(item => {
      seen.add(item.id)
      let entry = this.entries.get(item.id)
      if (entry && entry.kind !== item.kind) {
        this.removeEntry(item.id)
        entry = undefined
      }
      if (!entry) {
        entry = this.createEntry(item)
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
    material.maxSimultaneousLights = 8
    return material
  }

  private unpickable(mesh: AbstractMesh, parent: TransformNode): AbstractMesh {
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

  private createEntry(item: SceneItem): Entry {
    const root = new TransformNode(item.id, this.scene)
    const entry: Entry = { kind: item.kind, root }
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
    entry.root.dispose(false, true)
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
    const light = new SpotLight(item.id, Vector3.Zero(), new Vector3(0, -1, 0), Math.PI / 3, 2, this.scene)
    light.shadowMinZ = 0.1
    light.shadowMaxZ = 20

    const shadows = new ShadowGenerator(1024, light)
    shadows.usePercentageCloserFiltering = true
    shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
    shadows.bias = 0.0005

    // Visual only: a glowing head on a stand. Not a shadow caster so it never blocks its own beam.
    const bodyMaterial = new StandardMaterial(`${item.id}-mat`, this.scene)
    bodyMaterial.disableLighting = true
    const lightBody = MeshBuilder.CreateCylinder('lightHead', { height: 0.25, diameterTop: 0.14, diameterBottom: 0.28 }, this.scene)
    lightBody.material = bodyMaterial
    this.unpickable(lightBody, entry.root)

    const stand = MeshBuilder.CreateCylinder('stand', { height: 1, diameter: 0.03 }, this.scene)
    stand.material = this.surfaceMaterial
    this.unpickable(stand, entry.root)

    entry.light = light
    entry.lightBody = lightBody
    entry.shadows = shadows
  }

  private buildCamera(entry: Entry): void {
    const body = MeshBuilder.CreateBox('camBody', { width: 0.14, height: 0.14, depth: 0.22 }, this.scene)
    const lens = MeshBuilder.CreateCylinder('camLens', { height: 0.12, diameter: 0.08 }, this.scene)
    lens.rotation.x = Math.PI / 2
    lens.position.z = 0.16
    const tripod = MeshBuilder.CreateCylinder('tripod', { height: 1, diameter: 0.03 }, this.scene)
    const material = new StandardMaterial('camMat', this.scene)
    material.diffuseColor = new Color3(0.15, 0.15, 0.17)
    material.emissiveColor = new Color3(0.08, 0.08, 0.1)
    ;[body, lens, tripod].forEach(mesh => {
      mesh.material = material
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
    const light = entry.light as SpotLight
    const { intensity, color, angle, tilt } = item.props
    light.position.set(item.x, item.height, item.z)
    light.direction = headingDirection(item.rotationY, tilt)
    light.angle = angle * DEG
    light.intensity = intensity
    light.diffuse = Color3.FromHexString(color)
    light.specular = light.diffuse

    const head = entry.lightBody as Mesh
    head.position.y = item.height
    head.rotation.x = Math.PI / 2 + tilt * DEG
    ;(head.material as StandardMaterial).emissiveColor = light.diffuse

    const stand = entry.root.getChildMeshes(true).find(mesh => mesh.name === 'stand') as Mesh
    stand.scaling.y = item.height
    stand.position.y = item.height / 2
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
