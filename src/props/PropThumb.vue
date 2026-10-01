<template>
  <svg :viewBox="viewBox" class="thumb" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
    <template v-for="(s, i) in shapes" :key="i">
      <rect v-if="s.t === 'rect'" :class="s.cls || 'body'" :x="s.x - s.w / 2" :y="-s.z - s.d / 2" :width="s.w" :height="s.d" :rx="s.r || 0"
        :transform="s.rot ? `rotate(${s.rot} ${s.x} ${-s.z})` : undefined" :style="fill(s)" />
      <circle v-else-if="s.t === 'circle'" :class="s.cls || 'body'" :cx="s.x" :cy="-s.z" :r="s.r" :style="fill(s)" />
      <ellipse v-else-if="s.t === 'ellipse'" :class="s.cls || 'body'" :cx="s.x" :cy="-s.z" :rx="s.rx" :ry="s.rz" :style="fill(s)" />
      <polyline v-else-if="s.t === 'path' && !s.closed" :class="s.cls || 'line'" :points="s.pts.map(q => `${q[0]},${-q[1]}`).join(' ')" />
      <polygon v-else :class="s.cls || 'body'" :points="s.pts.map(q => `${q[0]},${-q[1]}`).join(' ')" :style="fill(s)" />
    </template>
  </svg>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import { defaultPropProps, paramsOf } from './create'
import { shade } from './finish'
import { PlanShape, PropDef } from './types'

// The plan symbol of a catalogue item at its default size and colours (library cards).
export default defineComponent({
  name: 'PropThumb',
  props: {
    def: { type: Object as PropType<PropDef>, required: true }
  },
  setup(props) {
    const data = computed(() => defaultPropProps(props.def))
    const shapes = computed<PlanShape[]>(() => {
      try { return props.def.plan(paramsOf(data.value)) } catch { return [] }
    })
    const viewBox = computed(() => {
      const { w, d } = data.value
      const s = Math.max(w, d, 0.1) * 1.15
      return `${-s / 2} ${-s / 2} ${s} ${s}`
    })
    const fill = (s: PlanShape) => {
      const f = data.value.finishes
      const c = (s.tint && f[s.tint]?.colour) || f[props.def.slots[0]?.id]?.colour || '#8b8f99'
      if (s.cls === 'soft') return { fill: shade(c, 0.15), fillOpacity: 0.85 }
      if (!s.cls || s.cls === 'body') return { fill: c, fillOpacity: 0.6 }
      return {}
    }
    return { shapes, viewBox, fill }
  }
})
</script>

<style scoped>
.thumb { width: 100%; height: 100%; display: block; }
.body { stroke: #c9ccd4; stroke-width: 1px; vector-effect: non-scaling-stroke; }
.soft { stroke: rgba(230, 231, 234, 0.55); stroke-width: 0.75px; vector-effect: non-scaling-stroke; }
.line { fill: none; stroke: rgba(230, 231, 234, 0.6); stroke-width: 0.75px; vector-effect: non-scaling-stroke; }
.glass { fill: none; stroke: #7fb2ff; stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.hidden { fill: none; stroke: rgba(230, 231, 234, 0.45); stroke-width: 1px; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
</style>
