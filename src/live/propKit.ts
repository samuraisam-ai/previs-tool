import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Scene } from '@babylonjs/core/scene'
import { Kit, PartOpts, V3 } from '../props/types'

// Builds catalogue props from simple shapes. Every part is baked into prop-local space and given
// real-world UVs (1 unit = 1 m) so a pattern's scale means the same thing on every part, then the
// parts of each finish slot are merged into one mesh (one draw call per slot).

const DEG = Math.PI / 180

export interface BuiltSlot {
  slot: string
  mesh: Mesh // regular parts (cast shadows)
  small: boolean // details: skipped as shadow casters on the Lite tier
  fit: boolean // keeps 0–1 UVs (artwork, screens, mirrors)
}

export class BabylonKit implements Kit {
  private parts = new Map<string, Mesh[]>()

  constructor(private scene: Scene) {}

  private add(slot: string, mesh: Mesh, at: V3, opts: PartOpts = {}): void {
    if (opts.scale) mesh.scaling.set(opts.scale[0], opts.scale[1], opts.scale[2])
    if (opts.rot) mesh.rotation.set(opts.rot[0] * DEG, opts.rot[1] * DEG, opts.rot[2] * DEG)
    mesh.position.set(at[0], at[1], at[2])
    mesh.bakeCurrentTransformIntoVertices()
    if (!opts.fit) boxProjectUVs(mesh)
    const key = `${slot}${opts.fit ? '|fit' : ''}${opts.small ? '|small' : ''}`
    const list = this.parts.get(key) ?? []
    list.push(mesh)
    this.parts.set(key, list)
  }

  box(slot: string, size: V3, at: V3, opts?: PartOpts): void {
    this.add(slot, MeshBuilder.CreateBox('p', { width: size[0], height: size[1], depth: size[2] }, this.scene), at, opts)
  }

  soft(slot: string, size: V3, at: V3, radius = 0.03, opts?: PartOpts): void {
    this.add(slot, roundedBox(this.scene, size, radius), at, opts)
  }

  cylinder(slot: string, dims: { d?: number; dTop?: number; dBottom?: number; h: number; sides?: number }, at: V3, opts?: PartOpts): void {
    const mesh = MeshBuilder.CreateCylinder('p', {
      diameterTop: dims.dTop ?? dims.d ?? 0.1, diameterBottom: dims.dBottom ?? dims.d ?? 0.1, height: dims.h, tessellation: dims.sides ?? 20
    }, this.scene)
    this.add(slot, mesh, at, opts)
  }

  sphere(slot: string, d: V3, at: V3, opts: PartOpts & { segments?: number } = {}): void {
    const mesh = MeshBuilder.CreateSphere('p', { diameterX: d[0], diameterY: d[1], diameterZ: d[2], segments: opts.segments ?? 12 }, this.scene)
    this.add(slot, mesh, at, opts)
  }

  lathe(slot: string, profile: Array<[number, number]>, at: V3, opts: PartOpts & { sides?: number } = {}): void {
    const mesh = MeshBuilder.CreateLathe('p', {
      shape: profile.map(([r, y]) => new Vector3(r, y, 0)), tessellation: opts.sides ?? 24, sideOrientation: Mesh.DOUBLESIDE
    }, this.scene)
    this.add(slot, mesh, at, opts)
  }

  tube(slot: string, path: V3[], r: number, opts: PartOpts & { sides?: number } = {}): void {
    const mesh = MeshBuilder.CreateTube('p', { path: path.map(p => new Vector3(p[0], p[1], p[2])), radius: r, tessellation: opts.sides ?? 8, cap: Mesh.CAP_ALL }, this.scene)
    this.add(slot, mesh, [0, 0, 0], opts)
  }

  torus(slot: string, dims: { d: number; thickness: number }, at: V3, opts?: PartOpts): void {
    this.add(slot, MeshBuilder.CreateTorus('p', { diameter: dims.d, thickness: dims.thickness, tessellation: 32 }, this.scene), at, opts)
  }

  plane(slot: string, size: { w: number; h: number }, at: V3, opts: PartOpts & { doubleSided?: boolean } = {}): void {
    const mesh = MeshBuilder.CreatePlane('p', { width: size.w, height: size.h, sideOrientation: opts.doubleSided ? Mesh.DOUBLESIDE : Mesh.DEFAULTSIDE }, this.scene)
    // Planes face −z by default; turn them to face the prop's front (+z).
    mesh.rotation.y = Math.PI
    mesh.bakeCurrentTransformIntoVertices()
    this.add(slot, mesh, at, opts)
  }

  foliage(slot: string, dims: { w: number; h: number; d: number }, at: V3, opts: PartOpts & { count?: number; leaf?: number; seed?: number } = {}): void {
    let seed = opts.seed ?? 7
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    const count = opts.count ?? 14
    const leaf = opts.leaf ?? 0.18
    for (let i = 0; i < count; i++) {
      const m = MeshBuilder.CreatePlane('p', { width: leaf, height: leaf * 1.6, sideOrientation: Mesh.DOUBLESIDE }, this.scene)
      m.rotation.set((rand() - 0.5) * 1.6, rand() * Math.PI * 2, (rand() - 0.5) * 1.2)
      m.position.set(at[0] + (rand() - 0.5) * dims.w, at[1] + (rand() - 0.5) * dims.h, at[2] + (rand() - 0.5) * dims.d)
      m.bakeCurrentTransformIntoVertices()
      boxProjectUVs(m)
      const key = `${slot}${opts.small ? '|small' : ''}`
      const list = this.parts.get(key) ?? []
      list.push(m)
      this.parts.set(key, list)
    }
  }

  // Merge each slot's parts into one mesh. The kit's temporary meshes are consumed.
  finish(name: string): BuiltSlot[] {
    const out: BuiltSlot[] = []
    this.parts.forEach((meshes, key) => {
      const [slot, ...flags] = key.split('|')
      const merged = meshes.length === 1 ? meshes[0] : Mesh.MergeMeshes(meshes, true, true, undefined, false, false)
      if (!merged) return
      merged.name = `${name}-${key}`
      out.push({ slot, mesh: merged, small: flags.includes('small'), fit: flags.includes('fit') })
    })
    this.parts.clear()
    return out
  }
}

// UVs from the dominant normal axis, in metres: patterns keep real-world scale on every face.
function boxProjectUVs(mesh: Mesh): void {
  const pos = mesh.getVerticesData(VertexBuffer.PositionKind)
  const nor = mesh.getVerticesData(VertexBuffer.NormalKind)
  if (!pos || !nor) return
  const uv = new Float32Array((pos.length / 3) * 2)
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const ax = Math.abs(nor[i])
    const ay = Math.abs(nor[i + 1])
    const az = Math.abs(nor[i + 2])
    if (ay >= ax && ay >= az) { uv[j] = pos[i]; uv[j + 1] = pos[i + 2] } else if (ax >= az) { uv[j] = pos[i + 2]; uv[j + 1] = pos[i + 1] } else { uv[j] = pos[i]; uv[j + 1] = pos[i + 1] }
  }
  mesh.setVerticesData(VertexBuffer.UVKind, uv, false)
}

// A box with rounded edges and corners (cushions, mattresses, upholstery). Each point of a
// lat/long sphere is pushed onto an inner box and then out by the radius along its direction.
function roundedBox(scene: Scene, size: V3, radius: number): Mesh {
  const r = Math.max(0.002, Math.min(radius, size[0] / 2 - 0.001, size[1] / 2 - 0.001, size[2] / 2 - 0.001))
  const e = [size[0] / 2 - r, size[1] / 2 - r, size[2] / 2 - r]
  const lat = 14
  const lon = 20
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= lat; i++) {
    // Bunch rings near the equator and poles' edges so flat faces stay flat.
    const v = i / lat
    const phi = (v - 0.5) * Math.PI
    for (let k = 0; k <= lon; k++) {
      const theta = (k / lon) * Math.PI * 2
      const n = [Math.cos(phi) * Math.cos(theta), Math.sin(phi), Math.cos(phi) * Math.sin(theta)]
      const q = n.map((c, a) => Math.sign(c) * Math.min(Math.abs(c) * 1e3, e[a]))
      positions.push(q[0] + n[0] * r, q[1] + n[1] * r, q[2] + n[2] * r)
    }
  }
  for (let i = 0; i < lat; i++) {
    for (let k = 0; k < lon; k++) {
      const a = i * (lon + 1) + k
      const b = a + lon + 1
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  const normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.normals = normals
  const mesh = new Mesh('p', scene)
  data.applyToMesh(mesh)
  return mesh
}
