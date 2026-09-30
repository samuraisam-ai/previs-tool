<template>
  <div class="ring-dial">
    <svg
      ref="svg"
      :width="size"
      :height="size"
      viewBox="-60 -60 120 120"
      tabindex="0"
      role="slider"
      :aria-label="label"
      :aria-valuenow="modelValue"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @wheel.prevent="onWheel"
      @keydown="onKey"
    >
      <circle class="barrel" r="54" />
      <!-- Knurled ring: rotates with the value like a real filter/focus ring. -->
      <g :transform="`rotate(${rotation})`">
        <line v-for="i in 48" :key="i" class="knurl" x1="46" x2="54" y1="0" y2="0" :transform="`rotate(${i * 7.5})`" />
        <circle class="index" cx="0" cy="-50" r="3.5" />
      </g>
      <circle class="glass" r="40" />
      <path class="fixed-mark" d="M 0 -60 L -4 -56 L 4 -56 Z" />
      <text class="value" y="4" text-anchor="middle">{{ display }}</text>
      <text class="caption" y="18" text-anchor="middle">{{ label }}</text>
    </svg>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'

// A rotating ring (filter ring, focus ring). Dragging around the centre turns it; the value moves
// through [min, max] over `sweep` degrees of rotation, linearly or logarithmically.
export default defineComponent({
  name: 'RingDial',
  props: {
    modelValue: { type: Number, required: true },
    min: { type: Number, required: true },
    max: { type: Number, required: true },
    step: { type: Number, default: 0 },
    sweep: { type: Number, default: 270 },
    log: { type: Boolean, default: false },
    size: { type: Number, default: 132 },
    label: { type: String, default: '' },
    display: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const svg = ref<SVGSVGElement | null>(null)

    const toPos = (v: number) => props.log
      ? Math.log(v / props.min) / Math.log(props.max / props.min)
      : (v - props.min) / (props.max - props.min)
    const fromPos = (p: number) => {
      const t = Math.min(1, Math.max(0, p))
      let v = props.log ? props.min * Math.pow(props.max / props.min, t) : props.min + t * (props.max - props.min)
      if (props.step) v = Math.round(v / props.step) * props.step
      return Math.min(props.max, Math.max(props.min, v))
    }
    const rotation = computed(() => toPos(props.modelValue) * props.sweep - props.sweep / 2)

    let lastAngle: number | null = null
    let pos = 0
    const angleAt = (event: PointerEvent) => {
      const rect = (svg.value as SVGSVGElement).getBoundingClientRect()
      return Math.atan2(event.clientY - (rect.top + rect.height / 2), event.clientX - (rect.left + rect.width / 2)) * 180 / Math.PI
    }
    const emitPos = (p: number) => {
      pos = Math.min(1, Math.max(0, p))
      const v = fromPos(pos)
      if (v !== props.modelValue) emit('update:modelValue', v)
    }

    const start = (event: PointerEvent) => {
      svg.value?.setPointerCapture(event.pointerId)
      lastAngle = angleAt(event)
      pos = toPos(props.modelValue)
    }
    const move = (event: PointerEvent) => {
      if (lastAngle === null) return
      const a = angleAt(event)
      let delta = a - lastAngle
      if (delta > 180) delta -= 360
      if (delta < -180) delta += 360
      lastAngle = a
      emitPos(pos + delta / props.sweep)
    }
    const end = () => { lastAngle = null }

    // Scroll / arrow keys: one step (or 1% of the range), five with Shift. Log rings step by ratio.
    const nudge = (dir: number, big: boolean) => {
      const n = big ? 5 : 1
      let v: number
      if (props.log) v = props.modelValue * Math.pow(1.03, dir * n)
      else v = props.modelValue + dir * n * (props.step || (props.max - props.min) / 100)
      if (props.step) v = Math.round(v / props.step) * props.step
      v = Math.min(props.max, Math.max(props.min, v))
      if (v !== props.modelValue) emit('update:modelValue', v)
    }
    const onWheel = (event: WheelEvent) => nudge(-Math.sign(event.deltaY), event.shiftKey)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nudge(1, event.shiftKey)
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nudge(-1, event.shiftKey)
      else return
      event.preventDefault()
    }

    return { svg, rotation, start, move, end, onWheel, onKey }
  }
})
</script>

<style scoped>
.ring-dial { display: inline-flex; }
svg { cursor: grab; touch-action: none; outline: none; border-radius: 50%; }
svg:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
.barrel { fill: #16171b; stroke: #3a3d46; stroke-width: 2; }
.knurl { stroke: #4a4e59; stroke-width: 2; }
.index { fill: var(--accent); }
.glass { fill: rgba(40, 44, 58, 0.85); stroke: #2a2c33; }
.fixed-mark { fill: #e6e7ea; }
.value { fill: #fff; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums; }
.caption { fill: #8b8f99; font-size: 8px; letter-spacing: 1px; }
</style>
