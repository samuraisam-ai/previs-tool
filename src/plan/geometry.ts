import { Pt, Wall } from '../scene/types'

// Plan-space geometry (metres, x/z). Tolerances are in metres.
export const EPS = 0.005

export const pt = (x: number, z: number): Pt => ({ x, z })
export const add = (a: Pt, b: Pt): Pt => ({ x: a.x + b.x, z: a.z + b.z })
export const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, z: a.z - b.z })
export const scale = (a: Pt, s: number): Pt => ({ x: a.x * s, z: a.z * s })
export const dot = (a: Pt, b: Pt) => a.x * b.x + a.z * b.z
export const len = (a: Pt) => Math.hypot(a.x, a.z)
export const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.z - b.z)
export const same = (a: Pt, b: Pt, tol = EPS) => dist(a, b) <= tol
export const round3 = (v: number) => Math.round(v * 1000) / 1000
export const roundPt = (p: Pt): Pt => ({ x: round3(p.x), z: round3(p.z) })

export const wallLength = (w: Wall) => dist(w.a, w.b)
export const wallDir = (w: Wall): Pt => {
  const l = wallLength(w) || 1
  return { x: (w.b.x - w.a.x) / l, z: (w.b.z - w.a.z) / l }
}
// Left-hand normal in plan space (looking from a to b).
export const wallNormal = (w: Wall): Pt => {
  const d = wallDir(w)
  return { x: -d.z, z: d.x }
}
// Plan angle of a wall in degrees (0 = +x, counter-clockwise when viewed with +z up).
export const wallAngle = (w: Wall) => (Math.atan2(w.b.z - w.a.z, w.b.x - w.a.x) * 180) / Math.PI

// Distance along the wall of the projection of p, and the perpendicular distance.
export function projectOnWall(w: Wall, p: Pt): { t: number; along: number; offset: number } {
  const L = wallLength(w)
  const d = wallDir(w)
  const v = sub(p, w.a)
  const along = dot(v, d)
  const n = wallNormal(w)
  return { t: L ? along / L : 0, along, offset: dot(v, n) }
}

export function pointOnWall(w: Wall, along: number): Pt {
  return add(w.a, scale(wallDir(w), along))
}

export function snapToGrid(p: Pt, size: number): Pt {
  return { x: round3(Math.round(p.x / size) * size), z: round3(Math.round(p.z / size) * size) }
}

// Snap the direction from `origin` to `p` to multiples of `stepDeg`, keeping the length.
export function snapAngle(origin: Pt, p: Pt, stepDeg: number): Pt {
  const v = sub(p, origin)
  const L = len(v)
  if (L < EPS) return p
  const a = Math.atan2(v.z, v.x)
  const step = (stepDeg * Math.PI) / 180
  const snapped = Math.round(a / step) * step
  return { x: origin.x + Math.cos(snapped) * L, z: origin.z + Math.sin(snapped) * L }
}

export function rotatePt(p: Pt, pivot: Pt, deg: number): Pt {
  const r = (deg * Math.PI) / 180
  const v = sub(p, pivot)
  // Plan rotation: positive = clockwise on screen (screen y = −z), matching item rotationY.
  const c = Math.cos(r)
  const s = Math.sin(r)
  return { x: pivot.x + v.x * c + v.z * s, z: pivot.z - v.x * s + v.z * c }
}

export function scalePt(p: Pt, pivot: Pt, sx: number, sz: number): Pt {
  return { x: pivot.x + (p.x - pivot.x) * sx, z: pivot.z + (p.z - pivot.z) * sz }
}

// ── Polygons ────────────────────────────────────────────────────────────────
export function polygonArea(points: Pt[]): number {
  let a = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[(i + 1) % points.length]
    a += p.x * q.z - q.x * p.z
  }
  return a / 2
}

export function polygonCentroid(points: Pt[]): Pt {
  const A = polygonArea(points)
  if (Math.abs(A) < 1e-9) {
    const n = points.length || 1
    return { x: points.reduce((s, p) => s + p.x, 0) / n, z: points.reduce((s, p) => s + p.z, 0) / n }
  }
  let cx = 0
  let cz = 0
  for (let i = 0; i < points.length; i++) {
    const p = points[i]
    const q = points[(i + 1) % points.length]
    const f = p.x * q.z - q.x * p.z
    cx += (p.x + q.x) * f
    cz += (p.z + q.z) * f
  }
  return { x: cx / (6 * A), z: cz / (6 * A) }
}

export function pointInPolygon(p: Pt, points: Pt[]): boolean {
  let inside = false
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i]
    const b = points[j]
    if ((a.z > p.z) !== (b.z > p.z) && p.x < ((b.x - a.x) * (p.z - a.z)) / (b.z - a.z) + a.x) inside = !inside
  }
  return inside
}

export function polygonPerimeter(points: Pt[]): number {
  return points.reduce((s, p, i) => s + dist(p, points[(i + 1) % points.length]), 0)
}

// Ear-clipping triangulation of a simple polygon. Returns index triples.
export function triangulate(points: Pt[]): number[] {
  const n = points.length
  if (n < 3) return []
  const ccw = polygonArea(points) > 0
  const idx = Array.from({ length: n }, (_, i) => i)
  const out: number[] = []
  const cross = (a: Pt, b: Pt, c: Pt) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x)
  const inTri = (p: Pt, a: Pt, b: Pt, c: Pt) => {
    const d1 = cross(a, b, p)
    const d2 = cross(b, c, p)
    const d3 = cross(c, a, p)
    return ccw ? d1 >= 0 && d2 >= 0 && d3 >= 0 : d1 <= 0 && d2 <= 0 && d3 <= 0
  }
  let guard = 0
  while (idx.length > 3 && guard++ < 1000) {
    let clipped = false
    for (let i = 0; i < idx.length; i++) {
      const i0 = idx[(i + idx.length - 1) % idx.length]
      const i1 = idx[i]
      const i2 = idx[(i + 1) % idx.length]
      const a = points[i0]
      const b = points[i1]
      const c = points[i2]
      const convex = ccw ? cross(a, b, c) > 1e-12 : cross(a, b, c) < -1e-12
      if (!convex) continue
      if (idx.some(k => k !== i0 && k !== i1 && k !== i2 && inTri(points[k], a, b, c))) continue
      out.push(i0, i1, i2)
      idx.splice(i, 1)
      clipped = true
      break
    }
    if (!clipped) break
  }
  if (idx.length === 3) out.push(idx[0], idx[1], idx[2])
  return out
}

// ── Collinear overlap ───────────────────────────────────────────────────────
// Parts of segment [a, b] not already covered by existing collinear walls. Used so rooms drawn
// against each other share one wall instead of doubling it.
export function uncoveredParts(a: Pt, b: Pt, walls: Wall[]): Array<[Pt, Pt]> {
  const L = dist(a, b)
  if (L < EPS) return []
  const d = scale(sub(b, a), 1 / L)
  const n = { x: -d.z, z: d.x }
  const covered: Array<[number, number]> = []
  walls.forEach(w => {
    const wa = sub(w.a, a)
    const wb = sub(w.b, a)
    // Collinear: both ends on the line (within tolerance) and parallel.
    if (Math.abs(dot(wa, n)) > 0.02 || Math.abs(dot(wb, n)) > 0.02) return
    const t0 = Math.min(dot(wa, d), dot(wb, d))
    const t1 = Math.max(dot(wa, d), dot(wb, d))
    const s = Math.max(0, t0)
    const e = Math.min(L, t1)
    if (e - s > EPS) covered.push([s, e])
  })
  covered.sort((p, q) => p[0] - q[0])
  const parts: Array<[Pt, Pt]> = []
  let cursor = 0
  covered.forEach(([s, e]) => {
    if (s - cursor > 0.05) parts.push([add(a, scale(d, cursor)), add(a, scale(d, s))])
    cursor = Math.max(cursor, e)
  })
  if (L - cursor > 0.05) parts.push([add(a, scale(d, cursor)), b])
  return parts.map(([p, q]) => [roundPt(p), roundPt(q)])
}

export interface Bounds {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export function boundsOf(points: Pt[]): Bounds | null {
  if (!points.length) return null
  return points.reduce<Bounds>((b, p) => ({
    minX: Math.min(b.minX, p.x), maxX: Math.max(b.maxX, p.x), minZ: Math.min(b.minZ, p.z), maxZ: Math.max(b.maxZ, p.z)
  }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
}
