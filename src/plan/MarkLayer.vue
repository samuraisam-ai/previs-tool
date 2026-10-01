<template>
  <g class="marks">
    <g v-for="o in paths" :key="o.ownerId" :class="['owner', o.kind, { focus: o.focus }]" :style="{ '--c': o.colour }">
      <!-- Traced path: dim full route, bright part already travelled during playback. -->
      <polyline class="route" :points="o.points" :stroke-width="2 * px" :stroke-dasharray="o.kind === 'camera' ? `${8 * px} ${5 * px}` : undefined" pointer-events="none" />
      <polyline
        v-if="o.travelled > 0"
        class="travelled"
        :points="o.points"
        :stroke-width="3.5 * px"
        :stroke-dasharray="`${o.travelled} ${o.length + 1}`"
        pointer-events="none"
      />
      <!-- Direction arrows along each leg. -->
      <path v-for="(a, i) in o.arrows" :key="i" class="arrow" :d="arrowPath" :transform="`translate(${a.x} ${-a.z}) rotate(${a.deg}) scale(${px})`" pointer-events="none" />
      <!-- T marks: the crossbar is where the toes go; the stem points back between the feet. -->
      <g
        v-for="m in o.marks"
        :key="m.id"
        :class="['tmark', { active: m.id === activeMark }]"
        :transform="`translate(${m.x} ${-m.z})`"
      >
        <g :transform="`rotate(${m.rotationY})`">
          <rect class="hit" x="-0.22" y="-0.22" width="0.44" height="0.44" data-handle="mark" :data-for="m.id" />
          <line class="bar" x1="-0.16" y1="-0.1" x2="0.16" y2="-0.1" pointer-events="none" />
          <line class="stem" x1="0" y1="-0.1" x2="0" y2="0.14" pointer-events="none" />
          <g v-if="m.id === activeMark" class="aim">
            <line x1="0" y1="-0.12" x2="0" y2="-0.45" pointer-events="none" />
            <circle cy="-0.5" :r="6 * px" data-handle="mark-aim" :data-for="m.id" />
          </g>
        </g>
        <g :transform="`translate(${0.2} ${-0.2})`" pointer-events="none">
          <circle class="badge" :r="8 * px" />
          <text class="num" :font-size="10 * px" text-anchor="middle" :dy="3.5 * px">{{ m.order }}</text>
        </g>
      </g>
    </g>
  </g>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { scene } from '../scene/store'
import { Pt } from '../scene/types'
import { playback } from './blocking'
import { editor } from './editor'
import { marksOf, ownerColour, owners } from './marks'

const ARROW_EVERY = 0.75 // metres between arrowheads

export default defineComponent({
  name: 'MarkLayer',
  props: {
    px: { type: Number, required: true }
  },
  setup() {
    const activeMark = computed(() => editor.activeMark)
    const paths = computed(() => {
      // Read marks so the layer updates when they change.
      void scene.marks.length
      return owners().map(owner => {
        const marks = marksOf(owner.id)
        // The route starts where the owner stands in the scene (not its playback pose).
        const pts: Pt[] = [{ x: owner.x, z: owner.z }, ...marks.map(m => ({ x: m.x, z: m.z }))]
        let length = 0
        const arrows: Array<{ x: number; z: number; deg: number }> = []
        for (let i = 1; i < pts.length; i++) {
          const a = pts[i - 1]
          const b = pts[i]
          const L = Math.hypot(b.x - a.x, b.z - a.z)
          length += L
          if (L < 0.05) continue
          const deg = (Math.atan2(b.x - a.x, b.z - a.z) * 180) / Math.PI
          // Evenly spaced along the leg, plus one just before the mark it arrives at.
          const n = Math.max(1, Math.floor(L / ARROW_EVERY))
          for (let k = 1; k <= n; k++) {
            const t = k === n ? Math.max(0, (L - 0.3) / L) : k / (n + 0.5)
            if (t * L < 0.25) continue
            arrows.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, deg })
          }
        }
        const focus = editor.selection.includes(owner.id) || editor.markOwner === owner.id
        return {
          ownerId: owner.id, kind: owner.kind, colour: ownerColour(owner.id), focus, marks, arrows, length,
          points: pts.map(p => `${p.x},${-p.z}`).join(' '),
          travelled: playback.active ? playback.travelled[owner.id] ?? 0 : 0
        }
      })
    })
    // A chevron in screen pixels (scaled by px), pointing up = direction of travel.
    const arrowPath = 'M -5 4 L 0 -4 L 5 4'
    return { paths, activeMark, arrowPath }
  }
})
</script>

<style scoped>
.route { fill: none; stroke: var(--c); opacity: 0.45; stroke-linejoin: round; }
.owner.focus .route { opacity: 0.8; }
.travelled { fill: none; stroke: var(--c); stroke-linejoin: round; }
.arrow { fill: none; stroke: var(--c); stroke-width: 2px; vector-effect: non-scaling-stroke; stroke-linecap: round; stroke-linejoin: round; opacity: 0.9; }
.tmark .hit { fill: transparent; cursor: move; }
.tmark .bar, .tmark .stem { stroke: var(--c); stroke-width: 4px; vector-effect: non-scaling-stroke; stroke-linecap: butt; }
.tmark.active .bar, .tmark.active .stem { stroke-width: 6px; }
.badge { fill: #15161a; stroke: var(--c); stroke-width: 1.5px; vector-effect: non-scaling-stroke; }
.tmark.active .badge { fill: var(--c); }
.num { fill: #fff; font-weight: 700; }
.tmark.active .num { fill: #111; }
.aim line { stroke: var(--c); stroke-width: 1px; stroke-dasharray: 2 2; vector-effect: non-scaling-stroke; }
.aim circle { fill: #15161a; stroke: var(--c); stroke-width: 2px; vector-effect: non-scaling-stroke; cursor: grab; }
</style>
