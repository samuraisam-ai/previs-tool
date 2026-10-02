import { pointInPolygon, projectOnWall, round3, wallDir, wallLength } from '../plan/geometry'
import { propCorners } from '../plan/ops'
import { scene } from '../scene/store'
import { PropItem } from '../scene/types'
import { getDef } from './catalog'
import { paramsOf } from './create'
import { syncPractical } from './practical'

// Where props settle when placed or moved:
// - wall props (art, mirrors, cabinets, sconces, curtains) snap flat onto the nearest wall face,
//   facing into the room;
// - surface props (lamps, vases, books, kettles) sit on top of whatever prop is under them;
// - ceiling props (pendants, hanging plants) hang from the ceiling of the room they're in.
// Holding Alt (free) skips all of this.

const WALL_REACH = 0.6

export function snapToWall(item: PropItem): boolean {
  type Hit = { s: number; at: { x: number; z: number }; n: { x: number; z: number }; t: number; d: number }
  let best = null as Hit | null
  scene.walls.forEach(w => {
    const pr = projectOnWall(w, item)
    if (pr.along < 0 || pr.along > wallLength(w)) return
    const dist = Math.abs(pr.offset)
    if (dist > WALL_REACH + w.thickness / 2 || (best !== null && dist >= best.d)) return
    const dir = wallDir(w)
    const n = { x: -dir.z, z: dir.x }
    best = { s: pr.offset >= 0 ? 1 : -1, at: { x: w.a.x + dir.x * pr.along, z: w.a.z + dir.z * pr.along }, n, t: w.thickness, d: dist }
  })
  if (!best) return false
  const b: Hit = best
  const out = b.t / 2 + item.props.d / 2 + 0.002
  item.x = round3(b.at.x + b.n.x * b.s * out)
  item.z = round3(b.at.z + b.n.z * b.s * out)
  // Front (+z local) faces away from the wall, into the room.
  item.rotationY = Math.round(((Math.atan2(b.n.x * b.s, b.n.z * b.s) * 180) / Math.PI + 360) % 360)
  return true
}

// Height of the highest prop top under a point (0 when on the floor).
export function surfaceUnder(item: PropItem): number {
  let top = 0
  scene.items.forEach(other => {
    if (other.kind !== 'prop' || other.id === item.id) return
    const def = getDef(other.props.catalogId)
    if (!def?.surfaceTop) return
    if (!pointInPolygon(item, propCorners(other))) return
    top = Math.max(top, other.props.elevation + def.surfaceTop(paramsOf(other.props)))
  })
  return round3(top)
}

export function ceilingAbove(item: PropItem): number | null {
  const room = scene.rooms.find(r => r.ceiling && pointInPolygon(item, r.points))
  return room ? room.ceilingHeight : null
}

// Settle one prop according to its mount. `placing`: first placement (sets default heights).
export function settleProp(item: PropItem, placing = false): void {
  const def = getDef(item.props.catalogId)
  if (!def) return
  if (def.mount === 'wall') snapToWall(item)
  else if (def.mount === 'surface') item.props.elevation = surfaceUnder(item)
  else if (def.mount === 'ceiling' && placing) {
    const ceiling = ceilingAbove(item)
    if (ceiling !== null) item.props.elevation = round3(Math.max(0, ceiling - item.props.h))
  }
  syncPractical(item)
}

export function settleProps(ids: string[], placing = false): void {
  ids.forEach(id => {
    const item = scene.items.find(i => i.id === id)
    if (item?.kind === 'prop') settleProp(item, placing)
  })
}
