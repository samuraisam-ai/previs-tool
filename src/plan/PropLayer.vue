<template>
  <g :class="['props', { dragging: editor.dragging }]">
    <g
      v-for="p in props"
      :key="p.id"
      :class="['prop', { selected: isSelected(p.id) }]"
      :data-id="p.id"
      :transform="`translate(${p.x} ${-p.z}) rotate(${p.rotationY})`"
    >
      <rect class="hit" :x="-p.w / 2" :y="-p.d / 2" :width="p.w" :height="p.d" />
      <template v-for="(s, i) in p.shapes" :key="i">
        <rect
          v-if="s.t === 'rect'"
          :class="s.cls || 'body'"
          :x="s.x - s.w / 2"
          :y="-s.z - s.d / 2"
          :width="s.w"
          :height="s.d"
          :rx="s.r || 0"
          :transform="s.rot ? `rotate(${s.rot} ${s.x} ${-s.z})` : undefined"
          :style="fill(p, s)"
        />
        <circle v-else-if="s.t === 'circle'" :class="s.cls || 'body'" :cx="s.x" :cy="-s.z" :r="s.r" :style="fill(p, s)" />
        <ellipse v-else-if="s.t === 'ellipse'" :class="s.cls || 'body'" :cx="s.x" :cy="-s.z" :rx="s.rx" :ry="s.rz" :style="fill(p, s)" />
        <polyline
          v-else-if="s.t === 'path' && !s.closed"
          :class="s.cls || 'line'"
          :points="s.pts.map(q => `${q[0]},${-q[1]}`).join(' ')"
        />
        <polygon v-else :class="s.cls || 'body'" :points="s.pts.map(q => `${q[0]},${-q[1]}`).join(' ')" :style="fill(p, s)" />
      </template>
      <!-- One clean outline of the footprint (selected, or faint on hover) instead of re-stroking every part. -->
      <circle v-if="p.round" class="outline" :r="Math.max(p.w, p.d) / 2" />
      <rect v-else class="outline" :x="-p.w / 2" :y="-p.d / 2" :width="p.w" :height="p.d" />
      <text v-if="isSelected(p.id) || showLabels" class="label" :font-size="10 * px" :stroke-width="3 * px" text-anchor="middle" :dy="3 * px" :transform="`rotate(${-p.rotationY})`">{{ p.name }}</text>
    </g>
  </g>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { getDef } from '../props/catalog'
import { paramsOf } from '../props/create'
import { shade } from '../props/finish'
import { PlanShape } from '../props/types'
import { scene } from '../scene/store'
import { PropItem } from '../scene/types'
import { playback, posed } from './blocking'
import { editor, isSelected } from './editor'

// Round things (round tables, pots, plants) get a circular outline: their outer shape is a circle
// filling the footprint.
const isRound = (shapes: PlanShape[], w: number, d: number) =>
  shapes.some(s => s.t === 'circle' && Math.abs(s.x) < 0.01 && Math.abs(s.z) < 0.01 && s.r * 2 >= Math.max(w, d) * 0.95)

interface DrawnProp {
  id: string
  name: string
  x: number
  z: number
  rotationY: number
  w: number
  d: number
  shapes: PlanShape[]
  round: boolean
  colours: { [slot: string]: string }
  main: string
}

export default defineComponent({
  name: 'PropLayer',
  props: {
    px: { type: Number, required: true },
    showLabels: { type: Boolean, default: false }
  },
  setup() {
    const props = computed<DrawnProp[]>(() => scene.items
      .filter((i): i is PropItem => i.kind === 'prop')
      .map(item => (playback.active ? posed(item) : item))
      .map(item => {
        const def = getDef(item.props.catalogId)
        const colours: { [slot: string]: string } = {}
        Object.entries(item.props.finishes).forEach(([slot, f]) => { colours[slot] = f.colour })
        let shapes: PlanShape[] = []
        try { shapes = def ? def.plan(paramsOf(item.props)) : [] } catch { shapes = [] }
        if (!shapes.length) shapes = [{ t: 'rect', x: 0, z: 0, w: item.props.w, d: item.props.d, cls: 'body' }]
        const first = def?.slots[0]?.id
        return {
          id: item.id, name: item.name, x: item.x, z: item.z, rotationY: item.rotationY, w: item.props.w, d: item.props.d,
          shapes, colours, round: isRound(shapes, item.props.w, item.props.d), main: (first && colours[first]) || '#8b8f99'
        }
      }))
    // Tinted with the prop's own colours so the plan reads like a coloured set plan.
    const fill = (p: DrawnProp, s: PlanShape) => {
      const c = (s.tint && p.colours[s.tint]) || p.main
      if (s.cls === 'soft') return { fill: shade(c, 0.15), fillOpacity: 0.8 }
      if (!s.cls || s.cls === 'body') return { fill: c, fillOpacity: 0.55 }
      return {}
    }
    return { props, fill, isSelected, editor }
  }
})
</script>

<style scoped>
.hit { fill: transparent; cursor: move; }
.body { stroke: #c9ccd4; stroke-width: 1px; vector-effect: non-scaling-stroke; }
.soft { stroke: rgba(230, 231, 234, 0.55); stroke-width: 0.75px; vector-effect: non-scaling-stroke; }
.line { fill: none; stroke: rgba(230, 231, 234, 0.6); stroke-width: 0.75px; vector-effect: non-scaling-stroke; }
.glass { fill: none; stroke: #7fb2ff; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.hidden { fill: none; stroke: rgba(230, 231, 234, 0.45); stroke-width: 1px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
.outline { fill: none; stroke: none; pointer-events: none; vector-effect: non-scaling-stroke; }
.prop:hover .outline { stroke: rgba(255, 255, 255, 0.45); stroke-width: 1px; }
.prop.selected .outline { stroke: var(--accent); stroke-width: 2px; fill: var(--accent); fill-opacity: 0.08; }
/* While moving something, the rest of the set steps back so the moved item reads clearly. */
.props.dragging .prop:not(.selected) { opacity: 0.45; }
.label { fill: #e6e7ea; font-weight: 500; paint-order: stroke; stroke: rgba(15, 16, 19, 0.85); pointer-events: none; }
/* (The halo width is set in screen pixels via px: a CSS "3px" here is 3 plan units — metres — and
   painted a dark blob over the selected prop.) */
</style>
