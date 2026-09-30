import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { same, triangulate, wallLength } from '../plan/geometry'
import { FloorFinish, Opening, SceneDoc, Wall } from '../scene/types'

// Builds the 3D architecture (walls with openings, doors, windows, floors, ceilings) from the plan.
// Everything is simple boxes/polygons, rebuilt whenever the architecture changes.

// Layer masks: the orbit view sees cut-down walls and no ceilings (a dollhouse you can look into);
// placed cameras see full-height walls and ceilings.
export const LAYER = {
  COMMON: 0x0fffffff,
  FULL_WALLS: 0x10000000,
  CUT_WALLS: 0x20000000,
  CEILING: 0x40000000
}
export const CUT_HEIGHT = 1.2

const FINISHES: Record<FloorFinish, { color: Color3; roughness: number }> = {
  wood: { color: new Color3(0.36, 0.23, 0.14), roughness: 0.45 },
  concrete: { color: new Color3(0.42, 0.42, 0.41), roughness: 0.6 },
  tile: { color: new Color3(0.68, 0.67, 0.64), roughness: 0.3 },
  carpet: { color: new Color3(0.3, 0.28, 0.26), roughness: 0.9 }
}

type SurfaceFactory = (name: string, color: Color3, roughness: number) => PBRMaterial

interface Piece { x0: number; x1: number; y0: number; y1: number }

export class Architecture {
  private root: TransformNode | null = null
  private key = ''
  casters: AbstractMesh[] = []
  readonly wallMaterial: PBRMaterial
  readonly floorMaterials: Record<FloorFinish, PBRMaterial>
  private ceilingMaterial: PBRMaterial
  private doorMaterial: PBRMaterial
  private frameMaterial: PBRMaterial
  private glassMaterial: PBRMaterial
  private groundMaterial: PBRMaterial
  private ground: Mesh

  constructor(private scene: Scene, surface: SurfaceFactory) {
    this.wallMaterial = surface('walls', new Color3(0.55, 0.55, 0.54), 0.85)
    this.wallMaterial.backFaceCulling = false
    this.floorMaterials = {
      wood: surface('floor-wood', FINISHES.wood.color, FINISHES.wood.roughness),
      concrete: surface('floor-concrete', FINISHES.concrete.color, FINISHES.concrete.roughness),
      tile: surface('floor-tile', FINISHES.tile.color, FINISHES.tile.roughness),
      carpet: surface('floor-carpet', FINISHES.carpet.color, FINISHES.carpet.roughness)
    }
    this.ceilingMaterial = surface('ceiling', new Color3(0.7, 0.7, 0.69), 0.9)
    // Floors and ceilings are single flat polygons with explicit normals; draw both faces.
    ;[this.ceilingMaterial, ...Object.values(this.floorMaterials)].forEach(m => { m.backFaceCulling = false })
    this.doorMaterial = surface('door', new Color3(0.4, 0.3, 0.22), 0.55)
    this.frameMaterial = surface('frame', new Color3(0.75, 0.75, 0.73), 0.5)
    this.glassMaterial = surface('glass', new Color3(0.8, 0.85, 0.9), 0.05)
    this.glassMaterial.alpha = 0.12
    this.groundMaterial = surface('ground', new Color3(0.06, 0.06, 0.065), 0.95)
    this.ground = MeshBuilder.CreateGround('ground', { width: 400, height: 400 }, scene)
    this.ground.position.y = -0.005
    this.ground.material = this.groundMaterial
    this.ground.isPickable = false
    this.ground.receiveShadows = true
  }

  // Surfaces whose sheen a polarizer can cut.
  get polarizable(): PBRMaterial[] {
    return [this.wallMaterial, ...Object.values(this.floorMaterials), this.doorMaterial, this.frameMaterial]
  }

  // Rebuild if the architecture changed. Returns true when meshes were replaced.
  sync(doc: SceneDoc): boolean {
    const key = JSON.stringify([doc.walls, doc.openings, doc.rooms])
    if (key === this.key) return false
    this.key = key
    this.root?.dispose(false, false)
    this.casters = []
    this.root = new TransformNode('architecture', this.scene)
    doc.walls.forEach(w => this.buildWall(w, doc))
    this.mergeBoxes()
    doc.rooms.forEach(r => {
      if (r.points.length < 3) return
      this.buildPolygon(`floor-${r.id}`, r.points, 0.002, true, this.floorMaterials[r.floor], LAYER.COMMON)
      if (r.ceiling) this.buildPolygon(`ceiling-${r.id}`, r.points, r.ceilingHeight, false, this.ceilingMaterial, LAYER.CEILING)
    })
    return true
  }

  // Merge the many wall/frame/door boxes into one mesh per material + view layer + caster role:
  // far fewer draw calls once whole houses are built. Transforms are baked in.
  private mergeBoxes(): void {
    const root = this.root as TransformNode
    const groups = new Map<string, Mesh[]>()
    const casterSet = new Set(this.casters)
    root.getChildMeshes(false).forEach(m => {
      if (!(m instanceof Mesh) || !m.material) return
      const key = `${m.material.uniqueId}|${m.layerMask}|${casterSet.has(m) ? 1 : 0}`
      const list = groups.get(key) ?? []
      list.push(m)
      groups.set(key, list)
    })
    groups.forEach((meshes, key) => {
      if (meshes.length < 2) return
      const merged = Mesh.MergeMeshes(meshes, true, true, undefined, false, false)
      if (!merged) return
      const caster = key.endsWith('|1')
      merged.name = `arch-merged-${key}`
      merged.layerMask = Number(key.split('|')[1])
      this.casters = this.casters.filter(c => !meshes.includes(c as Mesh))
      this.mesh(merged, root, merged.layerMask, caster)
    })
  }

  private mesh<T extends AbstractMesh>(mesh: T, parent: TransformNode, mask: number, caster: boolean): T {
    mesh.parent = parent
    mesh.isPickable = false
    mesh.layerMask = mask
    mesh.receiveShadows = true
    if (caster) this.casters.push(mesh)
    return mesh
  }

  private buildWall(w: Wall, doc: SceneDoc): void {
    const L = wallLength(w)
    if (L < 0.01) return
    const t = w.thickness
    const H = w.height
    const node = new TransformNode(w.id, this.scene)
    node.parent = this.root
    node.position.set(w.a.x, 0, w.a.z)
    // Local +x runs a → b; local +z is the wall's left-hand normal.
    node.rotation.y = Math.atan2(-(w.b.z - w.a.z), w.b.x - w.a.x)

    // Extend ends that meet another wall by half a thickness so corners close.
    const connected = (p: typeof w.a) => doc.walls.some(o => o.id !== w.id && (same(o.a, p, 0.02) || same(o.b, p, 0.02)))
    const extA = connected(w.a) ? t / 2 : 0
    const extB = connected(w.b) ? t / 2 : 0

    const openings = doc.openings.filter(o => o.wallId === w.id).sort((p, q) => p.offset - q.offset)
    const pieces: Piece[] = []
    let cursor = -extA
    openings.forEach(o => {
      const x0 = Math.max(o.offset - o.width / 2, 0)
      const x1 = Math.min(o.offset + o.width / 2, L)
      if (x0 > cursor + 0.001) pieces.push({ x0: cursor, x1: x0, y0: 0, y1: H })
      const top = Math.min(o.sill + o.height, H)
      if (top < H - 0.001) pieces.push({ x0, x1, y0: top, y1: H })
      if (o.sill > 0.001) pieces.push({ x0, x1, y0: 0, y1: Math.min(o.sill, H) })
      cursor = Math.max(cursor, x1)
      this.buildOpening(o, t, node)
    })
    if (L + extB > cursor + 0.001) pieces.push({ x0: cursor, x1: L + extB, y0: 0, y1: H })

    const box = (p: Piece, name: string, mask: number, caster: boolean) => {
      const m = MeshBuilder.CreateBox(name, { width: p.x1 - p.x0, height: p.y1 - p.y0, depth: t }, this.scene)
      m.position.set((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2, 0)
      m.material = this.wallMaterial
      this.mesh(m, node, mask, caster)
    }
    pieces.forEach((p, i) => {
      box(p, `${w.id}-${i}`, LAYER.FULL_WALLS, true)
      // Dollhouse version for the orbit view.
      if (p.y0 < CUT_HEIGHT) box({ ...p, y1: Math.min(p.y1, CUT_HEIGHT) }, `${w.id}-cut-${i}`, LAYER.CUT_WALLS, false)
    })
  }

  private buildOpening(o: Opening, t: number, wall: TransformNode): void {
    const x0 = o.offset - o.width / 2
    const x1 = o.offset + o.width / 2
    const top = o.sill + o.height
    const frameW = 0.05
    const framed = o.kind !== 'opening'
    const part = (name: string, w: number, h: number, d: number, x: number, y: number, z: number, material: PBRMaterial, caster = true) => {
      const m = MeshBuilder.CreateBox(`${o.id}-${name}`, { width: w, height: h, depth: d }, this.scene)
      m.position.set(x, y, z)
      m.material = material
      return this.mesh(m, wall, LAYER.COMMON, caster)
    }
    if (framed) {
      part('jambL', frameW, o.height, t + 0.02, x0 + frameW / 2, o.sill + o.height / 2, 0, this.frameMaterial)
      part('jambR', frameW, o.height, t + 0.02, x1 - frameW / 2, o.sill + o.height / 2, 0, this.frameMaterial)
      part('head', o.width, frameW, t + 0.02, o.offset, top - frameW / 2, 0, this.frameMaterial)
    }
    if (o.kind === 'window') {
      part('sillFrame', o.width, frameW, t + 0.04, o.offset, o.sill + frameW / 2, 0, this.frameMaterial)
      part('glass', o.width - frameW * 2, o.height - frameW * 2, 0.01, o.offset, o.sill + o.height / 2, 0, this.glassMaterial, false)
      return
    }
    if (o.kind === 'opening') return

    const side = o.swing === 'in' ? 1 : -1
    const angle = (Math.min(Math.max(o.openAngle, 0), 180) * Math.PI) / 180
    const leafT = 0.04
    const inner = o.width - frameW * 2
    if (o.kind === 'sliding-door') {
      const slide = (Math.min(o.openAngle, 90) / 90) * inner * 0.95
      part('leaf', inner, o.height - frameW, leafT, o.offset + (o.hinge === 'left' ? -slide : slide), (o.height - frameW) / 2, side * (t / 2 + leafT), this.doorMaterial)
      return
    }
    const leaves: Array<{ hingeX: number; dir: 1 | -1; width: number }> = o.kind === 'double-door'
      ? [{ hingeX: x0 + frameW, dir: 1, width: inner / 2 }, { hingeX: x1 - frameW, dir: -1, width: inner / 2 }]
      : [{ hingeX: o.hinge === 'left' ? x0 + frameW : x1 - frameW, dir: o.hinge === 'left' ? 1 : -1, width: inner }]
    leaves.forEach((leaf, i) => {
      const pivot = new TransformNode(`${o.id}-pivot-${i}`, this.scene)
      pivot.parent = wall
      pivot.position.set(leaf.hingeX, 0, side * (t / 2 - leafT / 2))
      // Swing toward the chosen side: a leaf extending +x turns toward +z with a negative y rotation.
      pivot.rotation.y = -leaf.dir * side * angle
      const m = MeshBuilder.CreateBox(`${o.id}-leaf-${i}`, { width: leaf.width, height: o.height - frameW, depth: leafT }, this.scene)
      m.position.set((leaf.dir * leaf.width) / 2, (o.height - frameW) / 2, 0)
      m.material = this.doorMaterial
      this.mesh(m, pivot, LAYER.COMMON, true)
    })
  }

  private buildPolygon(name: string, points: SceneDoc['rooms'][number]['points'], y: number, up: boolean, material: PBRMaterial, mask: number): void {
    const indices = triangulate(points)
    if (!indices.length) return
    const positions = points.flatMap(p => [p.x, y, p.z])
    // Make the triangles face up (floors) or down (ceilings).
    const tri = (i: number) => {
      const a = points[indices[i]]
      const b = points[indices[i + 1]]
      const c = points[indices[i + 2]]
      return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
    }
    // Babylon is left-handed: a triangle wound clockwise seen from above faces up.
    const facesUp = tri(0) < 0
    if (facesUp !== up) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
    // Flat polygons: the normal is straight up (floors) or down (ceilings).
    const normals = points.flatMap(() => [0, up ? 1 : -1, 0])
    const data = new VertexData()
    data.positions = positions
    data.indices = indices
    data.normals = normals
    const mesh = new Mesh(name, this.scene)
    data.applyToMesh(mesh)
    mesh.material = material
    this.mesh(mesh, this.root as TransformNode, mask, false)
  }
}
