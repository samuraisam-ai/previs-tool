<template>
  <!-- Under the items: camera-side tint and the line itself. -->
  <g v-if="geo && part === 'under'" :class="['loa', { selected }]">
    <polygon class="tint" :points="geo.tint" pointer-events="none" />
    <line class="extended" :x1="geo.far0.x" :y1="-geo.far0.z" :x2="geo.far1.x" :y2="-geo.far1.z" pointer-events="none" />
    <line class="segment" :x1="geo.a.x" :y1="-geo.a.z" :x2="geo.b.x" :y2="-geo.b.z" pointer-events="none" />
    <line class="hit" :x1="geo.a.x" :y1="-geo.a.z" :x2="geo.b.x" :y2="-geo.b.z" :stroke-width="12 * px" :data-id="LINE_ID" />
    <text class="label" :x="geo.label.x" :y="-geo.label.z" :font-size="11 * px" text-anchor="middle" :transform="`rotate(${geo.textAngle} ${geo.label.x} ${-geo.label.z})`" pointer-events="none">180°</text>
  </g>
  <!-- Over the items: end handles. Attached ends sit just outside their subject so the subject stays draggable. -->
  <g v-else-if="geo && part === 'over'" :class="['loa', { selected }]">
    <g v-for="h in geo.handles" :key="h.end">
      <line v-if="h.attached" class="tether" :x1="h.at.x" :y1="-h.at.z" :x2="h.pos.x" :y2="-h.pos.z" pointer-events="none" />
      <circle :class="['end', { attached: h.attached }]" :cx="h.pos.x" :cy="-h.pos.z" :r="6 * px" :data-handle="`loa-${h.end}`">
        <title>{{ h.attached ? 'Attached to a subject — drag to adjust freely' : 'Drag to adjust · drop on a subject to attach' }}</title>
      </circle>
    </g>
  </g>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import { scene } from '../scene/store'
import { Pt } from '../scene/types'
import { isSelected } from './editor'
import { cameraSide, LINE_ID, lineEnd } from './lineOfAction'

const FAR = 60 // how far the line and tint extend past the ends (m)

export default defineComponent({
  name: 'LineLayer',
  props: {
    px: { type: Number, required: true },
    part: { type: String as PropType<'under' | 'over'>, required: true }
  },
  setup(props) {
    const selected = computed(() => isSelected(LINE_ID))
    const geo = computed(() => {
      const line = scene.lineOfAction
      if (!line || !line.visible) return null
      const a = lineEnd(line, 'a')
      const b = lineEnd(line, 'b')
      const L = Math.hypot(b.x - a.x, b.z - a.z)
      if (L < 0.01) return null
      const d = { x: (b.x - a.x) / L, z: (b.z - a.z) / L }
      const n = { x: -d.z, z: d.x } // left of a → b
      const s = cameraSide(line)
      const at = (p: Pt, t: number, k = 0): Pt => ({ x: p.x + d.x * t + n.x * k, z: p.z + d.z * t + n.z * k })
      const far0 = at(a, -FAR)
      const far1 = at(b, FAR)
      const tint = [far0, far1, at(b, FAR, s * FAR), at(a, -FAR, s * FAR)].map(p => `${p.x},${-p.z}`).join(' ')
      // Text along the line, kept upright, nudged onto the non-camera side.
      let textAngle = (-Math.atan2(d.z, d.x) * 180) / Math.PI
      if (textAngle > 90) textAngle -= 180
      if (textAngle < -90) textAngle += 180
      const label = at({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }, 0, -s * 14 * props.px)
      const handle = (end: 'a' | 'b') => {
        const attached = !!(end === 'a' ? line.aSubject : line.bSubject)
        const p = end === 'a' ? a : b
        const out = end === 'a' ? -1 : 1
        return { end, attached, at: p, pos: attached ? at(p, out * 0.45) : p }
      }
      return { a, b, far0, far1, tint, label, textAngle, handles: [handle('a'), handle('b')] }
    })
    return { geo, selected, LINE_ID }
  }
})
</script>

<style scoped>
.tint { fill: rgba(76, 195, 138, 0.06); }
.extended { stroke: rgba(255, 98, 89, 0.55); stroke-width: 1px; stroke-dasharray: 6 5; vector-effect: non-scaling-stroke; }
.segment { stroke: #ff6259; stroke-width: 2px; vector-effect: non-scaling-stroke; }
.loa.selected .segment { stroke: var(--accent); stroke-width: 3px; }
.hit { stroke: transparent; cursor: pointer; }
.label { fill: #ff8a83; font-weight: 600; letter-spacing: 0.5px; }
.tether { stroke: #ff6259; stroke-width: 1px; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
.end { fill: #15161a; stroke: #ff6259; stroke-width: 2px; vector-effect: non-scaling-stroke; cursor: move; }
.end.attached { fill: #ff6259; }
.loa.selected .end { stroke: var(--accent); }
</style>
