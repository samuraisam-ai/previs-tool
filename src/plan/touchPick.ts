import { scene } from '../scene/store'
import { Pt, SceneItem } from '../scene/types'
import { dist, dot, pointInPolygon, polygonArea, projectOnWall, sub } from './geometry'
import { getEntity, getWall, nearestWall, propCorners } from './ops'

// Fingers are imprecise, so on touch a tap is read by distance rather than by the exact shape under
// the finger. In order: the item already selected, the nearest subject, camera or light, the nearest
// prop (one the finger is on beats one it's near, and the smallest wins when things overlap, e.g. a
// frame on a sideboard), a door or window, a wall, and only then the room. `reach` is in plan metres
// (a fixed size on screen).

const ICON_RADIUS = 0.25 // the hit circle of the subject, camera and light icons

function segmentDistance(p: Pt, a: Pt, b: Pt): number {
  const ab = sub(b, a)
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / (dot(ab, ab) || 1)))
  return dist(p, { x: a.x + ab.x * t, z: a.z + ab.z * t })
}

function itemDistance(item: SceneItem, p: Pt): { d: number; area: number } {
  if (item.kind !== 'prop') return { d: Math.max(0, dist(p, item) - ICON_RADIUS), area: Math.PI * ICON_RADIUS * ICON_RADIUS }
  const corners = propCorners(item)
  const area = Math.abs(polygonArea(corners))
  if (pointInPolygon(p, corners)) return { d: 0, area }
  return { d: Math.min(...corners.map((c, i) => segmentDistance(p, c, corners[(i + 1) % corners.length]))), area }
}

// Cast, cameras and lights come first: they're small, drawn on top, and what a tap near them means,
// even when the fingertip lands on the fridge beside the camera.
function nearestItem(p: Pt, reach: number): string | null {
  let icon: { id: string; d: number } | null = null
  let prop: { id: string; d: number; area: number } | null = null
  for (const item of scene.items) {
    // Practical bulbs aren't picked on their own; they travel with their lamp.
    if (item.kind === 'light' && item.attachedTo) continue
    const { d, area } = itemDistance(item, p)
    if (d > reach) continue
    if (item.kind !== 'prop') { if (!icon || d < icon.d) icon = { id: item.id, d } }
    else if (!prop || d < prop.d || (d === prop.d && area < prop.area)) prop = { id: item.id, d, area }
  }
  return icon?.id ?? prop?.id ?? null
}

function nearestOpening(p: Pt, reach: number): string | null {
  let best: { id: string; d: number } | null = null
  for (const o of scene.openings) {
    const wall = getWall(o.wallId)
    if (!wall) continue
    const pr = projectOnWall(wall, p)
    const along = Math.max(0, Math.abs(pr.along - o.offset) - o.width / 2)
    const d = Math.hypot(along, Math.max(0, Math.abs(pr.offset) - wall.thickness / 2))
    if (d <= reach && (!best || d < best.d)) best = { id: o.id, d }
  }
  return best?.id ?? null
}

export function touchPick(p: Pt, reach: number, selection: string[], underFinger: string | null): string | null {
  const held = selection.length === 1 ? getEntity(selection[0]) : null
  if (held?.kind === 'item' && itemDistance(held.obj, p).d <= reach) return held.obj.id
  const item = nearestItem(p, reach)
  if (item) return item
  const opening = nearestOpening(p, reach)
  if (opening) return opening
  const under = getEntity(underFinger)
  if (under && under.kind !== 'room') return underFinger
  const wall = nearestWall(p, reach)
  if (wall) return wall.wall.id
  return underFinger
}
