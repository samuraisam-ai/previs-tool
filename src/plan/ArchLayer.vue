<template>
  <g class="arch">
    <!-- Rooms -->
    <g v-for="room in rooms" :key="room.id" :class="['room', { selected: isSelected(room.id) }]" :data-id="room.id">
      <polygon :points="room.poly" />
    </g>

    <!-- Walls (solid pieces between openings) -->
    <g v-for="wall in walls" :key="wall.id" :class="['wall', { selected: isSelected(wall.id) }]" :data-id="wall.id">
      <polygon v-for="(piece, i) in wall.pieces" :key="i" :points="piece" />
    </g>

    <!-- Doors, windows, openings -->
    <g v-for="o in openings" :key="o.id" :class="['opening', o.kind, { selected: isSelected(o.id) }]" :data-id="o.id">
      <polygon class="hit" :points="o.hit" />
      <polyline v-for="(line, i) in o.lines" :key="'l' + i" :points="line" class="line" />
      <polyline v-for="(line, i) in o.arcs" :key="'a' + i" :points="line" class="swing" />
    </g>

    <!-- Room labels and wall dimensions (on top, not clickable) -->
    <g class="labels" pointer-events="none">
      <g v-for="room in rooms" :key="'t' + room.id" :transform="`translate(${room.label.x} ${-room.label.z})`">
        <text class="room-name" :font-size="13 * px" text-anchor="middle">{{ room.name }}</text>
        <text class="room-area" :font-size="11 * px" :y="15 * px" text-anchor="middle">{{ room.area }} m²</text>
      </g>
      <text
        v-for="wall in walls"
        :key="'d' + wall.id"
        class="dim"
        :font-size="10.5 * px"
        text-anchor="middle"
        dominant-baseline="middle"
        :transform="`translate(${wall.dim.x} ${-wall.dim.z}) rotate(${wall.dim.angle})`"
      >{{ wall.dim.text }}</text>
    </g>
  </g>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { scene } from '../scene/store'
import { Opening, Pt, Wall } from '../scene/types'
import { isSelected } from './editor'
import {
  add, pointInPolygon, polygonArea, polygonCentroid, same, scale, wallCuts, wallDir, wallLength, wallNormal
} from './geometry'

const svgPts = (pts: Pt[]) => pts.map(p => `${p.x},${-p.z}`).join(' ')

// Solid x-ranges of a wall once its openings are cut out (x measured from wall.a).
function solidRanges(w: Wall, extA: number, extB: number): Array<[number, number]> {
  const L = wallLength(w)
  const cuts = wallCuts(w, scene.walls, scene.openings).map(c => [c.offset - c.width / 2, c.offset + c.width / 2])
  const out: Array<[number, number]> = []
  let cursor = -extA
  cuts.forEach(([s, e]) => {
    if (s > cursor + 0.001) out.push([cursor, s])
    cursor = Math.max(cursor, e)
  })
  if (L + extB > cursor + 0.001) out.push([cursor, L + extB])
  return out
}

function arcPoints(centre: Pt, from: Pt, to: Pt, r: number, steps = 14): Pt[] {
  const a0 = Math.atan2(from.z, from.x)
  let a1 = Math.atan2(to.z, to.x)
  let d = a1 - a0
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  a1 = a0 + d
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = a0 + (d * i) / steps
    return { x: centre.x + Math.cos(a) * r, z: centre.z + Math.sin(a) * r }
  })
}

export default defineComponent({
  name: 'ArchLayer',
  props: {
    px: { type: Number, required: true }
  },
  setup(props) {
    const connected = (w: Wall, p: Pt) => scene.walls.some(o => o.id !== w.id && (same(o.a, p, 0.02) || same(o.b, p, 0.02)))

    const rooms = computed(() => scene.rooms.map(r => ({
      id: r.id,
      name: r.name,
      poly: svgPts(r.points),
      label: polygonCentroid(r.points),
      area: Math.abs(polygonArea(r.points)).toFixed(2)
    })))

    const walls = computed(() => scene.walls.map(w => {
      const d = wallDir(w)
      const n = wallNormal(w)
      const t = w.thickness
      const extA = connected(w, w.a) ? t / 2 : 0
      const extB = connected(w, w.b) ? t / 2 : 0
      const at = (x: number, side: number) => add(add(w.a, scale(d, x)), scale(n, (side * t) / 2))
      const pieces = solidRanges(w, extA, extB).map(([x0, x1]) => svgPts([at(x0, -1), at(x1, -1), at(x1, 1), at(x0, 1)]))
      // Dimension on the outside of the wall (away from any room it bounds).
      const L = wallLength(w)
      const mid = add(w.a, scale(d, L / 2))
      const probe = add(mid, scale(n, t / 2 + 0.3))
      const outside = scene.rooms.some(r => pointInPolygon(probe, r.points)) ? -1 : 1
      const dimPt = add(mid, scale(n, outside * (t / 2 + 12 * props.px)))
      let angle = (-Math.atan2(d.z, d.x) * 180) / Math.PI
      if (angle > 90) angle -= 180
      if (angle < -90) angle += 180
      return { id: w.id, pieces, dim: { x: dimPt.x, z: dimPt.z, angle, text: `${L.toFixed(2)} m` } }
    }))

    const openings = computed(() => scene.openings.map(o => {
      const w = scene.walls.find(x => x.id === o.wallId)
      if (!w) return null
      return { id: o.id, kind: o.kind, ...symbol(o, w) }
    }).filter((o): o is NonNullable<typeof o> => o !== null))

    function symbol(o: Opening, w: Wall) {
      const d = wallDir(w)
      const n = wallNormal(w)
      const t = w.thickness
      const x0 = o.offset - o.width / 2
      const x1 = o.offset + o.width / 2
      const along = (x: number, side = 0) => add(add(w.a, scale(d, x)), scale(n, side))
      const hit = svgPts([along(x0, -t / 2 - 0.1), along(x1, -t / 2 - 0.1), along(x1, t / 2 + 0.1), along(x0, t / 2 + 0.1)])
      const lines: string[] = []
      const arcs: string[] = []
      // Jambs.
      lines.push(svgPts([along(x0, -t / 2), along(x0, t / 2)]), svgPts([along(x1, -t / 2), along(x1, t / 2)]))
      const s = o.swing === 'in' ? 1 : -1
      if (o.kind === 'window') {
        lines.push(svgPts([along(x0, -t / 6), along(x1, -t / 6)]), svgPts([along(x0, t / 6), along(x1, t / 6)]))
      } else if (o.kind === 'sliding-door') {
        const slide = (Math.min(o.openAngle, 90) / 90) * o.width * 0.95
        const dir = o.hinge === 'left' ? -1 : 1
        lines.push(svgPts([along(x0, s * t / 4), along(x1, s * t / 4)]))
        lines.push(svgPts([along(x0 + dir * slide, -s * t / 4), along(x1 + dir * slide, -s * t / 4)]))
      } else if (o.kind === 'door' || o.kind === 'double-door') {
        const leaves = o.kind === 'double-door'
          ? [{ hx: x0, dir: 1, w: o.width / 2 }, { hx: x1, dir: -1, w: o.width / 2 }]
          : [{ hx: o.hinge === 'left' ? x0 : x1, dir: o.hinge === 'left' ? 1 : -1, w: o.width }]
        leaves.forEach(leaf => {
          const hinge = along(leaf.hx, (s * t) / 2)
          const closed = scale(d, leaf.dir)
          const theta = (Math.min(Math.max(o.openAngle, 0), 180) * Math.PI) / 180
          const leafDir = add(scale(closed, Math.cos(theta)), scale(n, s * Math.sin(theta)))
          lines.push(svgPts([hinge, add(hinge, scale(leafDir, leaf.w))]))
          const full = (Math.max(o.openTo, 90) * Math.PI) / 180
          const openDir = add(scale(closed, Math.cos(full)), scale(n, s * Math.sin(full)))
          arcs.push(svgPts(arcPoints(hinge, closed, openDir, leaf.w)))
        })
      }
      return { hit, lines, arcs }
    }

    return { rooms, walls, openings, isSelected }
  }
})
</script>

<style scoped>
.room polygon { fill: rgba(255, 255, 255, 0.035); stroke: none; cursor: pointer; }
.room.selected polygon { fill: rgba(255, 181, 71, 0.1); }
.wall polygon { fill: #c9ccd4; stroke: #c9ccd4; stroke-width: 0.5px; vector-effect: non-scaling-stroke; cursor: pointer; }
.wall.selected polygon { fill: var(--accent); stroke: var(--accent); }
.opening .hit { fill: transparent; cursor: pointer; }
.opening .line { fill: none; stroke: #e6e7ea; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.opening .swing { fill: none; stroke: #8b8f99; stroke-width: 1px; stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
.opening.window .line { stroke: #7fb2ff; }
.opening.selected .line, .opening.selected .swing { stroke: var(--accent); }
.room-name { fill: #d7d9de; font-weight: 600; }
.room-area { fill: var(--muted); }
.dim { fill: #9aa0ad; font-variant-numeric: tabular-nums; }
</style>
