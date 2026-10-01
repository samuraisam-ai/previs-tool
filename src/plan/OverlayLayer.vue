<template>
  <g class="overlay">
    <!-- Selection box: scale handles and rotate knob -->
    <g v-if="box" class="box">
      <rect class="frame" :x="box.x" :y="box.y" :width="box.w" :height="box.h" pointer-events="none" />
      <line class="stem" :x1="box.x + box.w / 2" :y1="box.y" :x2="box.x + box.w / 2" :y2="box.y - 22 * px" pointer-events="none" />
      <circle class="rotate" :cx="box.x + box.w / 2" :cy="box.y - 26 * px" :r="6 * px" data-handle="rotate" />
      <rect
        v-for="h in box.handles"
        :key="h.id"
        class="scale"
        :x="h.x - 4.5 * px"
        :y="h.y - 4.5 * px"
        :width="9 * px"
        :height="9 * px"
        :data-handle="`scale-${h.id}`"
        :style="{ cursor: h.cursor }"
      />
    </g>

    <!-- Single wall: drag ends to lengthen/re-angle, side handle to thicken -->
    <g v-if="wallHandles" class="wall-handles">
      <line class="guide" :x1="wallHandles.mid.x" :y1="-wallHandles.mid.z" :x2="wallHandles.thick.x" :y2="-wallHandles.thick.z" pointer-events="none" />
      <circle :class="['end', { linked: wallHandles.linkedA, detached: wallHandles.detachedA }]" :cx="wallHandles.a.x" :cy="-wallHandles.a.z" :r="6 * px" data-handle="wall-a" />
      <circle :class="['end', { linked: wallHandles.linkedB, detached: wallHandles.detachedB }]" :cx="wallHandles.b.x" :cy="-wallHandles.b.z" :r="6 * px" data-handle="wall-b" />
      <rect
        class="thick"
        :x="wallHandles.thick.x - 5 * px"
        :y="-wallHandles.thick.z - 5 * px"
        :width="10 * px"
        :height="10 * px"
        :transform="`rotate(${wallHandles.angle} ${wallHandles.thick.x} ${-wallHandles.thick.z})`"
        data-handle="wall-thick"
      />
    </g>

    <!-- Room tool rectangle -->
    <g v-if="editor.draft" pointer-events="none">
      <rect class="draft" :x="Math.min(editor.draft.a.x, editor.draft.b.x)" :y="-Math.max(editor.draft.a.z, editor.draft.b.z)"
        :width="Math.abs(editor.draft.b.x - editor.draft.a.x)" :height="Math.abs(editor.draft.b.z - editor.draft.a.z)" />
    </g>

    <!-- Opening preview on the hovered wall -->
    <polygon v-if="preview" :class="['preview', { bad: !preview.fits }]" :points="preview.points" pointer-events="none" />

    <!-- Tape measure -->
    <g v-if="editor.measure" class="measure" pointer-events="none">
      <line :x1="editor.measure.a.x" :y1="-editor.measure.a.z" :x2="editor.measure.b.x" :y2="-editor.measure.b.z" />
      <circle :cx="editor.measure.a.x" :cy="-editor.measure.a.z" :r="3 * px" />
      <circle :cx="editor.measure.b.x" :cy="-editor.measure.b.z" :r="3 * px" />
    </g>

    <!-- Marquee -->
    <rect v-if="marquee" class="marquee" :x="marquee.x" :y="marquee.y" :width="marquee.w" :height="marquee.h" pointer-events="none" />

    <!-- Snap target and live readout -->
    <circle v-if="editor.snapPoint" class="snap" :cx="editor.snapPoint.x" :cy="-editor.snapPoint.z" :r="5 * px" pointer-events="none" />
    <g v-if="hudText" pointer-events="none" :transform="`translate(${hudText.x} ${hudText.y})`">
      <rect class="hud-bg" :x="-2 * px" :y="-13 * px" :width="hudText.w" :height="18 * px" :rx="3 * px" />
      <text class="hud" :x="4 * px" :font-size="11.5 * px">{{ hudText.text }}</text>
    </g>
  </g>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import { scene } from '../scene/store'
import { editor } from './editor'
import { add, dist, pointOnWall, scale, wallDir, wallNormal } from './geometry'
import { cornerLinks, getEntity, selectionBounds } from './ops'

export default defineComponent({
  name: 'OverlayLayer',
  props: {
    px: { type: Number, required: true },
    marquee: { type: Object as PropType<{ x: number; y: number; w: number; h: number } | null>, default: null }
  },
  setup(props) {
    // The transform box shows for rooms and multi-selections (single walls, openings and items have
    // their own handles).
    const box = computed(() => {
      const sel = editor.selection
      if (!sel.length) return null
      const single = sel.length === 1 ? getEntity(sel[0]) : null
      if (single && single.kind !== 'room') return null
      const b = selectionBounds(sel)
      if (!b) return null
      const pad = 8 * props.px
      const x = b.minX - pad
      const y = -b.maxZ - pad
      const w = b.maxX - b.minX + pad * 2
      const h = b.maxZ - b.minZ + pad * 2
      const handles = [
        { id: 'nw', x, y, cursor: 'nwse-resize' }, { id: 'n', x: x + w / 2, y, cursor: 'ns-resize' },
        { id: 'ne', x: x + w, y, cursor: 'nesw-resize' }, { id: 'e', x: x + w, y: y + h / 2, cursor: 'ew-resize' },
        { id: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' }, { id: 's', x: x + w / 2, y: y + h, cursor: 'ns-resize' },
        { id: 'sw', x, y: y + h, cursor: 'nesw-resize' }, { id: 'w', x, y: y + h / 2, cursor: 'ew-resize' }
      ]
      return { x, y, w, h, handles }
    })

    const wallHandles = computed(() => {
      if (editor.selection.length !== 1) return null
      const e = getEntity(editor.selection[0])
      if (!e || e.kind !== 'wall') return null
      const w = e.obj
      const n = wallNormal(w)
      const d = wallDir(w)
      const mid = { x: (w.a.x + w.b.x) / 2, z: (w.a.z + w.b.z) / 2 }
      const thick = add(mid, scale(n, w.thickness / 2 + 16 * props.px))
      const linked = (end: 'a' | 'b') => { const l = cornerLinks(w, end); return !w.detached?.[end] && l.walls + l.rooms > 0 }
      return {
        a: w.a, b: w.b, mid, thick, angle: (-Math.atan2(d.z, d.x) * 180) / Math.PI,
        linkedA: linked('a'), linkedB: linked('b'), detachedA: !!w.detached?.a, detachedB: !!w.detached?.b
      }
    })

    const preview = computed(() => {
      const p = editor.openingPreview
      if (!p) return null
      const w = scene.walls.find(x => x.id === p.wallId)
      if (!w) return null
      const widths = { door: 0.9, 'double-door': 1.6, 'sliding-door': 1.8, opening: 0.9, window: 1.2 }
      const half = widths[p.kind] / 2
      const n = wallNormal(w)
      const t = w.thickness / 2 + 0.05
      const c0 = pointOnWall(w, p.offset - half)
      const c1 = pointOnWall(w, p.offset + half)
      const pts = [add(c0, scale(n, -t)), add(c1, scale(n, -t)), add(c1, scale(n, t)), add(c0, scale(n, t))]
      return { fits: p.fits, points: pts.map(q => `${q.x},${-q.z}`).join(' ') }
    })

    const hudText = computed(() => {
      const m = editor.measure
      if (m) {
        const text = `${dist(m.a, m.b).toFixed(2)} m`
        return { x: (m.a.x + m.b.x) / 2 + 8 * props.px, y: -(m.a.z + m.b.z) / 2 - 8 * props.px, text, w: (text.length * 7 + 10) * props.px }
      }
      if (!editor.hud) return null
      const text = editor.hud.text
      return { x: editor.hud.at.x + 14 * props.px, y: -editor.hud.at.z - 14 * props.px, text, w: (text.length * 7 + 10) * props.px }
    })

    return { editor, box, wallHandles, preview, hudText }
  }
})
</script>

<style scoped>
.frame { fill: none; stroke: var(--accent); stroke-width: 1px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
.stem { stroke: var(--accent); stroke-width: 1px; vector-effect: non-scaling-stroke; }
.rotate { fill: var(--accent); cursor: grab; }
.scale { fill: #15161a; stroke: var(--accent); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.wall-handles .end { fill: #15161a; stroke: var(--accent); stroke-width: 2px; vector-effect: non-scaling-stroke; cursor: move; }
.wall-handles .end.linked { fill: var(--accent); }
.wall-handles .end.detached { stroke-dasharray: 3 2; }
.wall-handles .thick { fill: var(--accent); cursor: ns-resize; }
.wall-handles .guide { stroke: var(--accent); stroke-width: 1px; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
.draft { fill: rgba(255, 181, 71, 0.08); stroke: var(--accent); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.preview { fill: rgba(143, 220, 143, 0.35); stroke: #8fdc8f; stroke-width: 1px; vector-effect: non-scaling-stroke; }
.preview.bad { fill: rgba(255, 98, 89, 0.3); stroke: #ff6259; }
.measure line { stroke: #7fb2ff; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.measure circle { fill: #7fb2ff; }
.marquee { fill: rgba(127, 178, 255, 0.08); stroke: #7fb2ff; stroke-width: 1px; stroke-dasharray: 3 2; vector-effect: non-scaling-stroke; }
.snap { fill: none; stroke: #8fdc8f; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.hud-bg { fill: rgba(12, 12, 16, 0.85); }
.hud { fill: #fff; font-variant-numeric: tabular-nums; }
</style>
