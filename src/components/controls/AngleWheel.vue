<template>
  <div class="angle-wheel">
    <svg
      ref="svg"
      :width="size"
      :height="size"
      viewBox="-60 -60 120 120"
      tabindex="0"
      role="slider"
      :aria-label="label"
      :aria-valuenow="relative ? undefined : modelValue"
      @pointerdown="start"
      @pointermove="move"
      @pointerup="end"
      @pointercancel="end"
      @wheel.prevent="onWheel"
      @keydown="onKey"
      @dblclick="reset"
    >
      <circle class="ring" r="52" />
      <g v-for="t in ticks" :key="t" :transform="`rotate(${t})`">
        <line class="tick" :class="{ major: t % 90 === 0 }" x1="0" x2="0" y1="-52" y2="-46" />
      </g>
      <path v-if="!relative && max <= 180" class="range" :d="arc(0, modelValue)" />
      <g :transform="`rotate(${display})`">
        <line class="pointer" x1="0" y1="0" x2="0" y2="-50" />
        <circle class="knob" cx="0" cy="-52" r="6" />
      </g>
      <circle class="hub" r="5" />
    </svg>
    <div class="readout">{{ text }}</div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'

// Rotary angle control. Absolute mode: v-model is the angle (min–max, 0 at the top, clockwise).
// Relative mode: spin it and it emits `turn` with each change in degrees (for rotating selections).
export default defineComponent({
  name: 'AngleWheel',
  props: {
    modelValue: { type: Number, default: 0 },
    min: { type: Number, default: 0 },
    max: { type: Number, default: 360 },
    step: { type: Number, default: 1 },
    snap: { type: Number, default: 15 },
    size: { type: Number, default: 120 },
    label: { type: String, default: 'Angle' },
    relative: { type: Boolean, default: false }
  },
  emits: ['update:modelValue', 'turn'],
  setup(props, { emit }) {
    const svg = ref<SVGSVGElement | null>(null)
    const spun = ref(0)
    let last: number | null = null

    const angleAt = (event: PointerEvent) => {
      const rect = (svg.value as SVGSVGElement).getBoundingClientRect()
      const dx = event.clientX - (rect.left + rect.width / 2)
      const dy = event.clientY - (rect.top + rect.height / 2)
      return ((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360
    }
    const set = (v: number) => {
      const s = props.step
      const clamped = Math.min(props.max, Math.max(props.min, Math.round(v / s) * s))
      if (clamped !== props.modelValue) emit('update:modelValue', clamped)
    }
    const turn = (delta: number) => {
      if (!delta) return
      spun.value = (spun.value + delta + 360) % 360
      emit('turn', delta)
    }

    const start = (event: PointerEvent) => {
      svg.value?.setPointerCapture(event.pointerId)
      last = angleAt(event)
      if (!props.relative) set(event.shiftKey ? last : Math.round(last / props.snap) * props.snap)
    }
    const move = (event: PointerEvent) => {
      if (last === null) return
      const a = angleAt(event)
      if (props.relative) {
        let d = a - last
        if (d > 180) d -= 360
        if (d < -180) d += 360
        // Snap relative turns to whole snap steps unless Shift is held.
        const stepSize = event.shiftKey ? 1 : props.snap
        const whole = Math.trunc(d / stepSize) * stepSize
        if (whole) { turn(whole); last = (last + whole + 360) % 360 }
      } else {
        set(event.shiftKey ? a : Math.round(a / props.snap) * props.snap)
      }
    }
    const end = () => { last = null }

    const nudge = (dir: number, big: boolean) => {
      const d = dir * (big ? props.snap : props.step)
      if (props.relative) turn(d)
      else set(props.modelValue + d)
    }
    const onWheel = (event: WheelEvent) => nudge(Math.sign(event.deltaY), event.shiftKey)
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') nudge(1, event.shiftKey)
      else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') nudge(-1, event.shiftKey)
      else return
      event.preventDefault()
    }
    const reset = () => { if (!props.relative) set(props.min) }

    const display = computed(() => (props.relative ? spun.value : props.modelValue))
    const text = computed(() => (props.relative ? 'Spin to rotate' : `${Math.round(props.modelValue)}°`))
    const ticks = Array.from({ length: 24 }, (_, i) => i * 15)
    const arc = (from: number, to: number) => {
      if (to <= from) return ''
      const r = 40
      const p = (a: number) => `${Math.sin((a * Math.PI) / 180) * r} ${-Math.cos((a * Math.PI) / 180) * r}`
      return `M 0 0 L ${p(from)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${p(to)} Z`
    }

    return { svg, start, move, end, onWheel, onKey, reset, display, text, ticks, arc }
  }
})
</script>

<style scoped>
.angle-wheel { display: flex; flex-direction: column; align-items: center; gap: 4px; }
svg { cursor: grab; touch-action: none; outline: none; border-radius: 50%; }
svg:focus-visible { box-shadow: 0 0 0 2px var(--accent); }
.ring { fill: #1b1c21; stroke: #3a3d46; stroke-width: 2; }
.tick { stroke: #555a66; stroke-width: 1; }
.tick.major { stroke: #9aa0ad; stroke-width: 1.5; }
.range { fill: rgba(255, 181, 71, 0.18); }
.pointer { stroke: var(--accent); stroke-width: 2; }
.knob { fill: var(--accent); stroke: #0d0e11; stroke-width: 1; }
.hub { fill: #8a8f9c; }
.readout { font-size: 12px; color: var(--text); font-variant-numeric: tabular-nums; }
</style>
