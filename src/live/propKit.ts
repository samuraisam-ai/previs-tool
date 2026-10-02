import { CreateBoxVertexData } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinderVertexData } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreatePlaneVertexData } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { CreateRibbonVertexData } from '@babylonjs/core/Meshes/Builders/ribbonBuilder'
import { CreateSphereVertexData } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorusVertexData } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { Scene } from '@babylonjs/core/scene'
import { triangulate } from '../plan/geometry'
import { Kit, PartOpts, V3 } from '../props/types'

// Builds catalogue props from simple shapes. Parts are generated as raw vertex data (no scene
// meshes), transformed into prop-local space, given real-world UVs (1 unit = 1 m, so a pattern's
// scale is the same on every part), and merged so each finish slot becomes a single mesh.

const DEG = Math.PI / 180

export interface BuiltSlot {
  slot: string
  mesh: Mesh
  small: boolean // details: skipped as shadow casters on the Lite tier
  fit: boolean // keeps 0–1 UVs (artwork, screens, mirrors)
}

export class BabylonKit implements Kit {
  private parts = new Map<string, VertexData[]>()
  private seedCounter = 0

  constructor(private scene: Scene) {}

  private add(slot: string, data: VertexData, at: V3, opts: PartOpts = {}): void {
    const s = opts.scale ?? [1, 1, 1]
    const r = opts.rot ?? [0, 0, 0]
    const m = Matrix.Compose(new Vector3(s[0], s[1], s[2]), Quaternion.RotationYawPitchRoll(r[1] * DEG, r[0] * DEG, r[2] * DEG), new Vector3(at[0], at[1], at[2]))
    data.transform(m)
    if (!opts.fit) boxProjectUVs(data)
    const key = `${slot}${opts.fit ? '|fit' : ''}${opts.small ? '|small' : ''}`
    const list = this.parts.get(key)
    if (list) list.push(data)
    else this.parts.set(key, [data])
  }

  box(slot: string, size: V3, at: V3, opts?: PartOpts): void {
    this.add(slot, CreateBoxVertexData({ width: size[0], height: size[1], depth: size[2] }), at, opts)
  }

  soft(slot: string, size: V3, at: V3, radius = 0.03, opts?: PartOpts): void {
    this.add(slot, roundedBox(size, radius), at, opts)
  }

  cylinder(slot: string, dims: { d?: number; dTop?: number; dBottom?: number; h: number; sides?: number }, at: V3, opts?: PartOpts): void {
    this.add(slot, CreateCylinderVertexData({
      diameterTop: dims.dTop ?? dims.d ?? 0.1, diameterBottom: dims.dBottom ?? dims.d ?? 0.1, height: dims.h, tessellation: dims.sides ?? 20
    }), at, opts)
  }

  sphere(slot: string, d: V3, at: V3, opts: PartOpts & { segments?: number } = {}): void {
    this.add(slot, CreateSphereVertexData({ diameterX: d[0], diameterY: d[1], diameterZ: d[2], segments: opts.segments ?? 12 }), at, opts)
  }

  lathe(slot: string, profile: Array<[number, number]>, at: V3, opts: PartOpts & { sides?: number } = {}): void {
    const sides = opts.sides ?? 24
    // One path per angle step: the profile swept around the y axis.
    const paths: Vector3[][] = []
    for (let i = 0; i <= sides; i++) {
      const a = (i / sides) * Math.PI * 2
      const c = Math.cos(a)
      const s = Math.sin(a)
      paths.push(profile.map(([rad, y]) => new Vector3(rad * c, y, rad * s)))
    }
    this.add(slot, CreateRibbonVertexData({ pathArray: paths, sideOrientation: Mesh.DOUBLESIDE }), at, opts)
  }

  tube(slot: string, path: V3[], r: number, opts: PartOpts & { sides?: number } = {}): void {
    const sides = opts.sides ?? 8
    const pts = path.map(p => new Vector3(p[0], p[1], p[2]))
    // A ring of points around each path point, perpendicular to the local direction.
    const rings: Vector3[][] = pts.map((p, i) => {
      const prev = pts[Math.max(0, i - 1)]
      const next = pts[Math.min(pts.length - 1, i + 1)]
      const t = next.subtract(prev).normalize()
      const ref = Math.abs(t.y) < 0.9 ? Vector3.Up() : Vector3.Right()
      const n = Vector3.Cross(t, ref).normalize()
      const b = Vector3.Cross(t, n).normalize()
      const ring: Vector3[] = []
      for (let k = 0; k <= sides; k++) {
        const a = (k / sides) * Math.PI * 2
        ring.push(p.add(n.scale(Math.cos(a) * r)).add(b.scale(Math.sin(a) * r)))
      }
      return ring
    })
    this.add(slot, CreateRibbonVertexData({ pathArray: rings, sideOrientation: Mesh.DOUBLESIDE }), [0, 0, 0], opts)
  }

  torus(slot: string, dims: { d: number; thickness: number }, at: V3, opts?: PartOpts): void {
    this.add(slot, CreateTorusVertexData({ diameter: dims.d, thickness: dims.thickness, tessellation: 32 }), at, opts)
  }

  prism(slot: string, outline: Array<[number, number]>, depth: number, at: V3, opts?: PartOpts): void {
    this.add(slot, extruded(outline, depth), at, opts)
  }

  plane(slot: string, size: { w: number; h: number }, at: V3, opts: PartOpts & { doubleSided?: boolean } = {}): void {
    const data = CreatePlaneVertexData({ width: size.w, height: size.h, sideOrientation: opts.doubleSided ? Mesh.DOUBLESIDE : Mesh.DEFAULTSIDE })
    // Planes face −z by default; turn them to face the prop's front (+z).
    data.transform(Matrix.RotationY(Math.PI))
    this.add(slot, data, at, opts)
  }

  foliage(slot: string, dims: { w: number; h: number; d: number }, at: V3, opts: PartOpts & { count?: number; leaf?: number; seed?: number } = {}): void {
    let seed = (opts.seed ?? 7) + this.seedCounter++
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    const count = opts.count ?? 14
    const leaf = opts.leaf ?? 0.18
    for (let i = 0; i < count; i++) {
      const data = CreatePlaneVertexData({ width: leaf, height: leaf * 1.6, sideOrientation: Mesh.DOUBLESIDE })
      this.add(slot, data, [at[0] + (rand() - 0.5) * dims.w, at[1] + (rand() - 0.5) * dims.h, at[2] + (rand() - 0.5) * dims.d], {
        small: opts.small, rot: [(rand() - 0.5) * 92, rand() * 360, (rand() - 0.5) * 69]
      })
    }
  }

  // One mesh per slot (plus flags), from the merged vertex data.
  finish(name: string): BuiltSlot[] {
    const out: BuiltSlot[] = []
    this.parts.forEach((list, key) => {
      const [slot, ...flags] = key.split('|')
      const data = list[0]
      if (list.length > 1) data.merge(list.slice(1), true)
      const mesh = new Mesh(`${name}-${key}`, this.scene)
      data.applyToMesh(mesh, false)
      out.push({ slot, mesh, small: flags.includes('small'), fit: flags.includes('fit') })
    })
    this.parts.clear()
    return out
  }
}

// UVs from the dominant normal axis, in metres: patterns keep real-world scale on every face.
function boxProjectUVs(data: VertexData): void {
  const pos = data.positions
  const nor = data.normals
  if (!pos || !nor) return
  const uv = new Float32Array((pos.length / 3) * 2)
  for (let i = 0, j = 0; i < pos.length; i += 3, j += 2) {
    const ax = Math.abs(nor[i])
    const ay = Math.abs(nor[i + 1])
    const az = Math.abs(nor[i + 2])
    if (ay >= ax && ay >= az) { uv[j] = pos[i]; uv[j + 1] = pos[i + 2] } else if (ax >= az) { uv[j] = pos[i + 2]; uv[j + 1] = pos[i + 1] } else { uv[j] = pos[i]; uv[j + 1] = pos[i + 1] }
  }
  data.uvs = uv
}

function fromArrays(positions: number[], indices: number[]): VertexData {
  const normals: number[] = []
  VertexData.ComputeNormals(positions, indices, normals)
  const data = new VertexData()
  data.positions = positions
  data.indices = indices
  data.normals = normals
  data.uvs = new Array((positions.length / 3) * 2).fill(0)
  return data
}

// An outline (x, y) extruded along z, with flat-shaded sides and triangulated caps.
function extruded(outline: Array<[number, number]>, depth: number): VertexData {
  const tri = triangulate(outline.map(([x, y]) => ({ x, z: y })))
  const positions: number[] = []
  const indices: number[] = []
  const z0 = -depth / 2
  const z1 = depth / 2
  const cap = (z: number, flip: boolean) => {
    const base = positions.length / 3
    outline.forEach(([x, y]) => positions.push(x, y, z))
    for (let i = 0; i < tri.length; i += 3) {
      if (flip) indices.push(base + tri[i], base + tri[i + 2], base + tri[i + 1])
      else indices.push(base + tri[i], base + tri[i + 1], base + tri[i + 2])
    }
  }
  cap(z1, false)
  cap(z0, true)
  for (let i = 0; i < outline.length; i++) {
    const [ax, ay] = outline[i]
    const [bx, by] = outline[(i + 1) % outline.length]
    const base = positions.length / 3
    positions.push(ax, ay, z0, bx, by, z0, bx, by, z1, ax, ay, z1)
    indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
  }
  return fromArrays(positions, indices)
}

// A box with rounded edges and corners (cushions, mattresses, upholstery). Each point of a
// lat/long sphere is pushed onto an inner box and then out by the radius along its direction.
function roundedBox(size: V3, radius: number): VertexData {
  const r = Math.max(0.002, Math.min(radius, size[0] / 2 - 0.001, size[1] / 2 - 0.001, size[2] / 2 - 0.001))
  const e = [size[0] / 2 - r, size[1] / 2 - r, size[2] / 2 - r]
  const lat = 14
  const lon = 20
  const positions: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= lat; i++) {
    const phi = (i / lat - 0.5) * Math.PI
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
  return fromArrays(positions, indices)
}
