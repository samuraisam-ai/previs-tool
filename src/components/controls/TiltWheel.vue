<template>
  <div class="tilt-wheel">
    <svg
      ref="svg"
      :width="size"
      :height="size"
      viewBox="-60 -60 120 120"
      tabindex="0"
      role="slider"
      :aria-valuenow="modelValue"
      aria-valuemin="-90"
      aria-valuemax="90"
      :aria-label="label"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @wheel.prevent="onWheel"
      @keydown="onKey"
      @dblclick="set(0)"
    >
      <circle class="ring" r="52" />
      <!-- Scale on the forward (right) half: every 15°, labelled every 45°. -->
      <g v-for="t in ticks" :key="t" :transform="`rotate(${t})`">
        <line class="tick" :class="{ major: t % 45 === 0 }" x1="46" x2="52" y1="0" y2="0" />
      </g>
      <text class="scale" x="0" y="-40" text-anchor="middle">UP</text>
      <text class="scale" x="0" y="46" text-anchor="middle">DOWN</text>
      <line class="horizon" x1="-52" x2="52" y1="0" y2="0" />

      <g :transform="`rotate(${modelValue})`">
        <line class="pointer" x1="0" y1="0" x2="50" y2="0" />
        <!-- Head silhouette pointing forward (right). -->
        <template v-if="icon === 'camera'">
          <rect class="head" x="-12" y="-7" width="16" height="14" rx="2" />
          <rect class="head" x="4" y="-5" width="10" height="10" rx="1" />
        </template>
        <template v-else>
          <path class="head" d="M -12 -6 h 8 l 14 -6 v 24 l -14 -6 h -8 z" />
        </template>
        <circle class="knob" cx="52" cy="0" r="6" />
      </g>
    </svg>
    <div class="readout">{{ text }}</div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'

// Rotary tilt control drawn as a side view: the pointer shows where the head points.
// 0 = level, positive = tilted down, negative = tilted up.
export default defineComponent({
  name: 'TiltWheel',
  props: {
    modelValue: { type: Number, required: true },
    min: { type: Number, default: -90 },
    max: { type: Number, default: 90 },
    size: { type: Number, default: 132 },
    icon: { type: String, default: 'light' },
    label: { type: String, default: 'Tilt' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const svg = ref<SVGSVGElement | null>(null)
    let dragging = false

    const set = (value: number) => {
      const clamped = Math.round(Math.min(props.max, Math.max(props.min, value)))
      if (clamped !== props.modelValue) emit('update:modelValue', clamped)
    }

    const angleAt = (event: PointerEvent) => {
      const rect = (svg.value as SVGSVGElement).getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      // Behind the pivot, snap to straight up/down rather than flipping round.
      if (dx < 0) return dy >= 0 ? 90 : -90
      return (Math.atan2(dy, dx) * 180) / Math.PI
    }

    const start = (event: PointerEvent) => {
      dragging = true
      svg.value?.setPointerCapture(event.pointerId)
      set(angleAt(event))
    }
    const move = (event: PointerEvent) => { if (dragging) set(angleAt(event)) }
    const end = () => { dragging = false }

    const onWheel = (event: WheelEvent) => set(props.modelValue + Math.sign(event.deltaY) * (event.shiftKey ? 5 : 1))
    const onKey = (event: KeyboardEvent) => {
      const step = event.shiftKey ? 5 : 1
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') set(props.modelValue + step)
      else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') set(props.modelValue - step)
      else if (event.key === '0' || event.key === 'Home') set(0)
      else return
      event.preventDefault()
    }

    const text = computed(() => {
      const v = props.modelValue
      return v === 0 ? 'Level' : v > 0 ? `${v}° down` : `${-v}° up`
    })
    const ticks = Array.from({ length: 13 }, (_, i) => -90 + i * 15)

    return { svg, set, start, move, end, onWheel, onKey, text, ticks }
  }
})
</script>

<style scoped>
.tilt-wheel { display: flex; flex-direction: column; align-items: center; gap: 4px; }
svg { cursor: grab; touch-action: none; outline: none; border-radius: 50%; }
svg:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
.ring { fill: #1b1c21; stroke: #3a3d46; stroke-width: 2; }
.tick { stroke: #555a66; stroke-width: 1; }
.tick.major { stroke: #9aa0ad; stroke-width: 1.5; }
.scale { fill: #6d7280; font-size: 8px; letter-spacing: 1px; }
.horizon { stroke: #3a3d46; stroke-dasharray: 3 3; }
.pointer { stroke: var(--accent); stroke-width: 2; }
.head { fill: #8a8f9c; stroke: #0d0e11; stroke-width: 1; }
.knob { fill: var(--accent); stroke: #0d0e11; stroke-width: 1; cursor: grab; }
.readout { font-size: 12px; color: var(--text); font-variant-numeric: tabular-nums; }
</style>
