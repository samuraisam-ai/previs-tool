import { makeRoom, makeWall, newId, removeItem, scene } from '../scene/store'
import { Opening, OpeningKind, PropItem, Pt, RoomArea, SceneItem, Wall } from '../scene/types'
import { editor, setSelection } from './editor'
import { commit } from './history'
import {
  add, Bounds, boundsOf, dist, pointInPolygon, pointOnWall, projectOnWall, rotatePt, round3, roundPt, same,
  scalePt, sub, uncoveredParts, wallCuts, wallLength
} from './geometry'

// Everything the Floor Plan can do to the scene document: add, delete, move, rotate, scale,
// duplicate. Kept free of UI so panels, tools and keyboard shortcuts share it.

export type Entity =
  | { kind: 'wall'; obj: Wall }
  | { kind: 'opening'; obj: Opening }
  | { kind: 'room'; obj: RoomArea }
  | { kind: 'item'; obj: SceneItem }

export function getEntity(id: string | null): Entity | null {
  if (!id) return null
  const wall = scene.walls.find(w => w.id === id)
  if (wall) return { kind: 'wall', obj: wall }
  const opening = scene.openings.find(o => o.id === id)
  if (opening) return { kind: 'opening', obj: opening }
  const room = scene.rooms.find(r => r.id === id)
  if (room) return { kind: 'room', obj: room }
  const item = scene.items.find(i => i.id === id)
  if (item) return { kind: 'item', obj: item }
  return null
}

export const getWall = (id: string) => scene.walls.find(w => w.id === id)

// Discrete actions are their own undo step: capture pending edits first, then the result.
function record<T>(action: () => T): T {
  commit()
  const result = action()
  commit()
  return result
}

// ── Adding ────────────────────────────────────────────────────────────────────
const DEFAULT_WALL_LENGTH = 3

export function addWallAt(p: Pt): Wall {
  return record(() => addWallNow(p))
}

function addWallNow(p: Pt): Wall {
  const wall = makeWall(roundPt(p), roundPt(add(p, { x: DEFAULT_WALL_LENGTH, z: 0 })))
  scene.walls.push(wall)
  setSelection([wall.id])
  return wall
}

// A rectangular room: four walls (skipping any already there, so neighbours share walls) + floor.
export function addRoomRect(a: Pt, b: Pt): RoomArea | null {
  return record(() => addRoomNow(a, b))
}

function addRoomNow(a: Pt, b: Pt): RoomArea | null {
  const minX = Math.min(a.x, b.x)
  const maxX = Math.max(a.x, b.x)
  const minZ = Math.min(a.z, b.z)
  const maxZ = Math.max(a.z, b.z)
  if (maxX - minX < 0.3 || maxZ - minZ < 0.3) return null
  const corners: Pt[] = [{ x: minX, z: minZ }, { x: maxX, z: minZ }, { x: maxX, z: maxZ }, { x: minX, z: maxZ }].map(roundPt)
  corners.forEach((p, i) => {
    uncoveredParts(p, corners[(i + 1) % 4], scene.walls).forEach(([s, e]) => scene.walls.push(makeWall(s, e)))
  })
  const room = makeRoom(`Room ${scene.rooms.length + 1}`, corners)
  scene.rooms.push(room)
  setSelection([room.id])
  return room
}

const OPENING_DEFAULTS: Record<OpeningKind, { width: number; height: number; sill: number }> = {
  'door': { width: 0.9, height: 2.1, sill: 0 },
  'double-door': { width: 1.6, height: 2.1, sill: 0 },
  'sliding-door': { width: 1.8, height: 2.1, sill: 0 },
  'opening': { width: 0.9, height: 2.1, sill: 0 },
  'window': { width: 1.2, height: 1.2, sill: 0.9 }
}

export function openingDefaults(kind: OpeningKind) {
  return OPENING_DEFAULTS[kind]
}

// Can an opening of `width` sit centred at `offset` on the wall without overlapping others?
export function openingFits(wall: Wall, offset: number, width: number, ignoreId?: string): boolean {
  const L = wallLength(wall)
  if (offset - width / 2 < 0.02 || offset + width / 2 > L - 0.02) return false
  // Includes openings cut through from overlapping walls.
  return !wallCuts(wall, scene.walls, scene.openings).some(c => c.openingId !== ignoreId &&
    Math.abs(c.offset - offset) < (c.width + width) / 2 + 0.02)
}

export function clampOffset(wall: Wall, offset: number, width: number): number {
  const L = wallLength(wall)
  return round3(Math.min(Math.max(offset, width / 2 + 0.02), Math.max(L - width / 2 - 0.02, width / 2 + 0.02)))
}

export function addOpening(kind: OpeningKind, wallId: string, offset: number): Opening | null {
  return record(() => addOpeningNow(kind, wallId, offset))
}

function addOpeningNow(kind: OpeningKind, wallId: string, offset: number): Opening | null {
  const wall = getWall(wallId)
  if (!wall) return null
  const d = OPENING_DEFAULTS[kind]
  const at = clampOffset(wall, offset, d.width)
  if (!openingFits(wall, at, d.width)) return null
  const opening: Opening = {
    id: newId(kind === 'window' ? 'window' : 'door'), wallId, kind, offset: at, width: d.width, height: d.height,
    sill: d.sill, hinge: 'left', swing: 'in', openAngle: 0, openTo: kind === 'sliding-door' ? 90 : 90
  }
  scene.openings.push(opening)
  setSelection([opening.id])
  return opening
}

export function toggleDoor(opening: Opening): void {
  if (opening.kind === 'window' || opening.kind === 'opening') return
  opening.openAngle = opening.openAngle > 0 ? 0 : opening.openTo || 90
}

// ── Deleting ──────────────────────────────────────────────────────────────────
export function deleteIds(ids: string[]): void {
  record(() => deleteNow(ids))
}

function deleteNow(ids: string[]): void {
  const set = new Set(ids)
  // A deleted room takes its walls with it, except walls it shares with a room that stays.
  const remaining = scene.rooms.filter(r => !set.has(r.id))
  scene.rooms.filter(r => set.has(r.id)).forEach(room => {
    scene.walls.forEach(w => {
      const bounds = (pts: Pt[]) => onBoundary(w.a, pts) && onBoundary(w.b, pts)
      if (bounds(room.points) && !remaining.some(r => bounds(r.points))) set.add(w.id)
    })
  })
  scene.walls.forEach(w => { if (set.has(w.id)) scene.openings.forEach(o => { if (o.wallId === w.id) set.add(o.id) }) })
  // A lamp takes its practical bulb with it.
  scene.items.forEach(i => { if (i.kind === 'light' && i.attachedTo && set.has(i.attachedTo)) set.add(i.id) })
  const keep = <T extends { id: string }>(list: T[]) => {
    for (let i = list.length - 1; i >= 0; i--) if (set.has(list[i].id)) list.splice(i, 1)
  }
  keep(scene.walls)
  keep(scene.openings)
  keep(scene.rooms)
  scene.items.filter(i => set.has(i.id)).forEach(i => removeItem(i.id))
  setSelection(editor.selection.filter(id => !set.has(id)))
}

// Walls running along a room's outline.
export function roomWalls(room: RoomArea): Wall[] {
  return scene.walls.filter(w => onBoundary(w.a, room.points) && onBoundary(w.b, room.points))
}

// ── Selection geometry ────────────────────────────────────────────────────────
function onBoundary(p: Pt, points: Pt[]): boolean {
  return points.some((a, i) => {
    const b = points[(i + 1) % points.length]
    const w = { id: '', a, b, thickness: 0, height: 0 }
    const pr = projectOnWall(w, p)
    return pr.along > -0.02 && pr.along < wallLength(w) + 0.02 && Math.abs(pr.offset) < 0.03
  })
}

// Moving a room carries its walls and anything standing in it.
export function expandSelection(ids: string[]): string[] {
  const out = new Set(ids)
  ids.forEach(id => {
    const room = scene.rooms.find(r => r.id === id)
    if (!room) return
    scene.walls.forEach(w => { if (onBoundary(w.a, room.points) && onBoundary(w.b, room.points)) out.add(w.id) })
    scene.items.forEach(i => { if (pointInPolygon({ x: i.x, z: i.z }, room.points)) out.add(i.id) })
  })
  return Array.from(out)
}

export function selectionPoints(ids: string[]): Pt[] {
  const pts: Pt[] = []
  ids.forEach(id => {
    const e = getEntity(id)
    if (!e) return
    if (e.kind === 'wall') pts.push(e.obj.a, e.obj.b)
    else if (e.kind === 'room') pts.push(...e.obj.points)
    else if (e.kind === 'item') {
      if (e.obj.kind === 'prop') pts.push(...propCorners(e.obj))
      else pts.push({ x: e.obj.x, z: e.obj.z })
    } else {
      const wall = getWall(e.obj.wallId)
      if (wall) pts.push(pointOnWall(wall, e.obj.offset))
    }
  })
  return pts
}

// A prop's footprint corners on the plan (heading 0 = +z, clockwise).
export function propCorners(item: PropItem): Pt[] {
  const r = (item.rotationY * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  const { w, d } = item.props
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => ({
    x: item.x + x * c + z * s, z: item.z - x * s + z * c
  }))
}

export function selectionBounds(ids: string[]): Bounds | null {
  return boundsOf(selectionPoints(ids))
}

// ── Transforms ────────────────────────────────────────────────────────────────
// A transform is captured at the start of a drag (original geometry) and re-applied from those
// originals on every move, so repeated moves never accumulate error.
export interface TransformSession {
  ids: string[]
  walls: Map<string, { a: Pt; b: Pt; len: number }>
  rooms: Map<string, Pt[]>
  items: Map<string, { x: number; z: number; r: number; w?: number; d?: number }>
  openings: Map<string, { offset: number }>
  // Unselected geometry connected to moved corners: it stretches instead of tearing apart.
  stretchWalls: Array<{ wall: Wall; end: 'a' | 'b'; orig: Pt }>
  stretchRooms: Array<{ room: RoomArea; index: number; orig: Pt }>
}

export function beginTransform(ids: string[]): TransformSession {
  // Practical bulbs travel with their lamp.
  const lamps = new Set(ids)
  ids = [...ids, ...scene.items.filter(i => i.kind === 'light' && i.attachedTo && lamps.has(i.attachedTo) && !lamps.has(i.id)).map(i => i.id)]
  const session: TransformSession = {
    ids, walls: new Map(), rooms: new Map(), items: new Map(), openings: new Map(), stretchWalls: [], stretchRooms: []
  }
  const moved: Pt[] = []
  ids.forEach(id => {
    const e = getEntity(id)
    if (!e) return
    if (e.kind === 'wall') {
      session.walls.set(id, { a: { ...e.obj.a }, b: { ...e.obj.b }, len: wallLength(e.obj) })
      // A detached end moves alone: it doesn't pull the corner it touches.
      if (!e.obj.detached?.a) moved.push(e.obj.a)
      if (!e.obj.detached?.b) moved.push(e.obj.b)
    } else if (e.kind === 'room') {
      session.rooms.set(id, e.obj.points.map(p => ({ ...p })))
    } else if (e.kind === 'item') {
      session.items.set(id, e.obj.kind === 'prop'
        ? { x: e.obj.x, z: e.obj.z, r: e.obj.rotationY, w: e.obj.props.w, d: e.obj.props.d }
        : { x: e.obj.x, z: e.obj.z, r: e.obj.rotationY })
    } else {
      session.openings.set(id, { offset: e.obj.offset })
    }
  })
  scene.walls.forEach(w => {
    if (session.walls.has(w.id)) return
    ;(['a', 'b'] as const).forEach(end => {
      if (!w.detached?.[end] && moved.some(p => same(p, w[end]))) session.stretchWalls.push({ wall: w, end, orig: { ...w[end] } })
    })
  })
  scene.rooms.forEach(r => {
    if (session.rooms.has(r.id)) return
    r.points.forEach((p, index) => {
      if (moved.some(m => same(m, p))) session.stretchRooms.push({ room: r, index, orig: { ...p } })
    })
  })
  return session
}

// Apply `map` (plan point → plan point) to everything in the session; items also turn by `turn`°.
export function applyTransform(session: TransformSession, map: (p: Pt) => Pt, turn = 0, scale?: { sx: number; sz: number }): void {
  session.walls.forEach((orig, id) => {
    const w = getWall(id)
    if (!w) return
    w.a = roundPt(map(orig.a))
    w.b = roundPt(map(orig.b))
    // Openings keep their relative position along a resized wall.
    const ratio = orig.len ? wallLength(w) / orig.len : 1
    scene.openings.forEach(o => {
      if (o.wallId !== id) return
      const base = session.openings.get(o.id)?.offset
      if (base === undefined) session.openings.set(o.id, { offset: o.offset })
      o.offset = round3(clampOffset(w, (session.openings.get(o.id) as { offset: number }).offset * ratio, o.width))
    })
  })
  session.rooms.forEach((orig, id) => {
    const r = scene.rooms.find(x => x.id === id)
    if (r) r.points = orig.map(p => roundPt(map(p)))
  })
  session.items.forEach((orig, id) => {
    const item = scene.items.find(i => i.id === id)
    if (!item) return
    const p = map({ x: orig.x, z: orig.z })
    item.x = round3(p.x)
    item.z = round3(p.z)
    item.rotationY = Math.round(((orig.r + turn) % 360 + 360) % 360)
    // Scaling a selection resizes props too (their local axes, so a turned prop swaps x/z).
    if (scale && item.kind === 'prop' && orig.w !== undefined && orig.d !== undefined) {
      const r = (item.rotationY * Math.PI) / 180
      const across = Math.abs(Math.cos(r)) >= Math.abs(Math.sin(r))
      item.props.w = round3(Math.max(0.02, orig.w * (across ? scale.sx : scale.sz)))
      item.props.d = round3(Math.max(0.01, orig.d * (across ? scale.sz : scale.sx)))
    }
  })
  session.stretchWalls.forEach(({ wall, end, orig }) => { wall[end] = roundPt(map(orig)) })
  session.stretchRooms.forEach(({ room, index, orig }) => { room.points[index] = roundPt(map(orig)) })
}

export const translate = (d: Pt) => (p: Pt) => add(p, d)
export const rotateAbout = (pivot: Pt, deg: number) => (p: Pt) => rotatePt(p, pivot, deg)
export const scaleAbout = (pivot: Pt, sx: number, sz: number) => (p: Pt) => scalePt(p, pivot, sx, sz)

// Slide openings (selected on their own) along their walls by a plan-space delta.
export function slideOpenings(session: TransformSession, delta: Pt): void {
  session.openings.forEach((orig, id) => {
    const o = scene.openings.find(x => x.id === id)
    const w = o && getWall(o.wallId)
    if (!o || !w || session.walls.has(w.id)) return
    const along = projectOnWall(w, add(pointOnWall(w, orig.offset), delta)).along
    const target = clampOffset(w, along, o.width)
    if (openingFits(w, target, o.width, o.id)) o.offset = target
  })
}

// Move a single wall end (its connected corners follow).
export function beginEndpointDrag(wall: Wall, end: 'a' | 'b'): TransformSession {
  const session: TransformSession = {
    ids: [], walls: new Map(), rooms: new Map(), items: new Map(), openings: new Map(), stretchWalls: [], stretchRooms: []
  }
  const orig = { ...wall[end] }
  if (wall.detached?.[end]) {
    session.stretchWalls.push({ wall, end, orig })
    return session
  }
  scene.walls.forEach(w => (['a', 'b'] as const).forEach(e => {
    if ((w === wall || !w.detached?.[e]) && same(w[e], orig)) session.stretchWalls.push({ wall: w, end: e, orig: { ...w[e] } })
  }))
  scene.rooms.forEach(r => r.points.forEach((p, index) => {
    if (same(p, orig)) session.stretchRooms.push({ room: r, index, orig: { ...p } })
  }))
  return session
}

export function moveEndpoint(session: TransformSession, to: Pt): void {
  session.stretchWalls.forEach(({ wall, end }) => { wall[end] = roundPt(to) })
  session.stretchRooms.forEach(({ room, index }) => { room.points[index] = roundPt(to) })
  scene.openings.forEach(o => {
    const w = getWall(o.wallId)
    if (w && session.stretchWalls.some(s => s.wall === w)) o.offset = clampOffset(w, o.offset, o.width)
  })
}

// ── Corner links ──────────────────────────────────────────────────────────────
// What a wall end is joined to: other wall ends at the same point (not detached) and room corners.
export function cornerLinks(wall: Wall, end: 'a' | 'b'): { walls: number; rooms: number } {
  const p = wall[end]
  let walls = 0
  scene.walls.forEach(w => (['a', 'b'] as const).forEach(e => {
    if (w !== wall && !w.detached?.[e] && same(w[e], p)) walls++
  }))
  const rooms = scene.rooms.filter(r => r.points.some(q => same(q, p))).length
  return { walls, rooms }
}

export function detachCorner(wall: Wall, end: 'a' | 'b'): void {
  record(() => { wall.detached = { ...wall.detached, [end]: true } })
}

// Re-link an end: snap it onto the nearest wall end or room corner within `reach` metres.
// Returns false (and changes nothing) when nothing is in reach.
export function attachCorner(wall: Wall, end: 'a' | 'b', reach = 0.3): boolean {
  const p = wall[end]
  let best = null as Pt | null
  let bestD = reach
  const consider = (q: Pt) => {
    const d = dist(p, q)
    if (d <= bestD) { best = q; bestD = d }
  }
  scene.walls.forEach(w => { if (w !== wall) (['a', 'b'] as const).forEach(e => consider(w[e])) })
  scene.rooms.forEach(r => r.points.forEach(consider))
  if (!best) return false
  const target = roundPt(best as Pt)
  record(() => {
    const flags = { ...wall.detached }
    delete flags[end]
    wall.detached = flags.a || flags.b ? flags : undefined
    wall[end] = target
    scene.openings.forEach(o => { if (o.wallId === wall.id) o.offset = clampOffset(wall, o.offset, o.width) })
  })
  return true
}

// ── Exact dimensions ──────────────────────────────────────────────────────────
export function setWallLength(wall: Wall, length: number, anchor: 'start' | 'centre' | 'end'): void {
  const L = wallLength(wall)
  if (length < 0.05 || !L) return
  const d = { x: (wall.b.x - wall.a.x) / L, z: (wall.b.z - wall.a.z) / L }
  const centre = { x: (wall.a.x + wall.b.x) / 2, z: (wall.a.z + wall.b.z) / 2 }
  const start = anchor === 'start' ? wall.a : anchor === 'end' ? sub(wall.b, { x: d.x * length, z: d.z * length }) : sub(centre, { x: d.x * length / 2, z: d.z * length / 2 })
  const a = roundPt(start)
  const b = roundPt(add(start, { x: d.x * length, z: d.z * length }))
  if (!same(a, wall.a)) moveEndpoint(beginEndpointDrag(wall, 'a'), a)
  if (!same(b, wall.b)) moveEndpoint(beginEndpointDrag(wall, 'b'), b)
}

// Angle in plan degrees (0 = +x, counter-clockwise with +z up), keeping the start point.
export function setWallAngle(wall: Wall, deg: number): void {
  const L = wallLength(wall)
  const r = (deg * Math.PI) / 180
  moveEndpoint(beginEndpointDrag(wall, 'b'), roundPt({ x: wall.a.x + Math.cos(r) * L, z: wall.a.z + Math.sin(r) * L }))
}

export function setWallStart(wall: Wall, to: Pt): void {
  const session = beginTransform([wall.id])
  applyTransform(session, translate(sub(to, wall.a)))
}

// Resize a selection's bounding box to width × depth (metres), from its minimum corner.
export function resizeSelection(ids: string[], width: number, depth: number): void {
  const b = selectionBounds(ids)
  if (!b) return
  const w0 = b.maxX - b.minX
  const d0 = b.maxZ - b.minZ
  const sx = w0 > 0.01 && width > 0.05 ? width / w0 : 1
  const sz = d0 > 0.01 && depth > 0.05 ? depth / d0 : 1
  applyTransform(beginTransform(ids), scaleAbout({ x: b.minX, z: b.minZ }, sx, sz))
}

export function rotateSelection(ids: string[], deg: number): void {
  const b = selectionBounds(ids)
  if (!b) return
  const pivot = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }
  applyTransform(beginTransform(ids), rotateAbout(pivot, deg), deg)
}

export function nudgeSelection(ids: string[], delta: Pt): void {
  const session = beginTransform(ids)
  applyTransform(session, translate(delta))
  slideOpenings(session, delta)
}

// ── Duplicate / copy / paste ──────────────────────────────────────────────────
interface Clip {
  walls: Wall[]
  openings: Opening[]
  rooms: RoomArea[]
  items: SceneItem[]
}

let clipboard: Clip | null = null

function collect(ids: string[]): Clip {
  const set = new Set(ids)
  const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v))
  const walls = scene.walls.filter(w => set.has(w.id)).map(clone)
  const wallIds = new Set(walls.map(w => w.id))
  return {
    walls,
    openings: scene.openings.filter(o => set.has(o.id) || wallIds.has(o.wallId)).map(clone),
    rooms: scene.rooms.filter(r => set.has(r.id)).map(clone),
    items: scene.items.filter(i => set.has(i.id)).map(clone)
  }
}

function paste(clip: Clip, offset: Pt): void {
  const idMap = new Map<string, string>()
  const shift = (p: Pt) => roundPt(add(p, offset))
  const added: string[] = []
  clip.walls.forEach(w => {
    const id = newId('wall')
    idMap.set(w.id, id)
    scene.walls.push({ ...w, id, a: shift(w.a), b: shift(w.b) })
    added.push(id)
  })
  clip.openings.forEach(o => {
    const wallId = idMap.get(o.wallId) ?? o.wallId
    const wall = getWall(wallId)
    if (!wall) return
    let at = o.offset
    // An opening duplicated on its original wall slides along to the next free spot.
    if (!idMap.has(o.wallId)) at = clampOffset(wall, o.offset + o.width + 0.1, o.width)
    if (!openingFits(wall, at, o.width)) return
    const id = newId(o.kind === 'window' ? 'window' : 'door')
    scene.openings.push({ ...o, id, wallId, offset: at })
    added.push(id)
  })
  clip.rooms.forEach(r => {
    const id = newId('room')
    scene.rooms.push({ ...r, id, name: `${r.name} copy`, points: r.points.map(shift) })
    added.push(id)
  })
  clip.items.forEach(i => {
    const id = newId(i.kind)
    const p = shift({ x: i.x, z: i.z })
    scene.items.push({ ...i, id, x: p.x, z: p.z, name: `${i.name} copy` } as SceneItem)
    added.push(id)
  })
  setSelection(added)
}

export function duplicateSelection(ids: string[]): void {
  record(() => paste(collect(expandSelection(ids)), { x: 0.5, z: -0.5 }))
}

export function copySelection(ids: string[]): void {
  clipboard = collect(expandSelection(ids))
}

export function pasteClipboard(): void {
  const clip = clipboard
  if (clip) record(() => paste(clip, { x: 0.5, z: -0.5 }))
}

export function nearestWall(p: Pt, maxDist: number): { wall: Wall; along: number } | null {
  let best: { wall: Wall; along: number; d: number } | null = null
  scene.walls.forEach(w => {
    const pr = projectOnWall(w, p)
    if (pr.along < 0 || pr.along > wallLength(w)) return
    const d = Math.abs(pr.offset)
    if (d <= Math.max(maxDist, w.thickness / 2) && (!best || d < best.d)) best = { wall: w, along: pr.along, d }
  })
  return best
}

// Every wall endpoint and midpoint, for object snapping.
export function snapCandidates(exclude?: Set<string>): Pt[] {
  const pts: Pt[] = []
  scene.walls.forEach(w => {
    if (exclude?.has(w.id)) return
    pts.push(w.a, w.b, { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 })
  })
  scene.rooms.forEach(r => { if (!exclude?.has(r.id)) pts.push(...r.points) })
  return pts
}

export function nearestPoint(p: Pt, candidates: Pt[], within: number): Pt | null {
  let best: Pt | null = null
  let bd = within
  candidates.forEach(c => {
    const d = dist(p, c)
    if (d < bd) { bd = d; best = c }
  })
  return best
}
