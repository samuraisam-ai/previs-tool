<template>
  <div v-if="hasMarks" class="blocking-bar" role="group" aria-label="Blocking playback">
    <button class="play" :title="playback.playing ? 'Pause (P)' : 'Play the blocking (P)'" @click="togglePlay">
      <svg viewBox="0 0 24 24"><path :d="playback.playing ? 'M7 5h3v14H7zM14 5h3v14h-3z' : 'M7 4.5v15l12-7.5z'" /></svg>
    </button>
    <button class="stop" title="Stop — back to the start" :disabled="!playback.active" @click="stop">
      <svg viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
    </button>
    <input class="scrub" type="range" min="0" :max="duration" step="0.05" :value="playback.time" aria-label="Playback position" @input="onSeek" />
    <span class="time">{{ fmt(playback.time) }} / {{ fmt(duration) }}</span>
    <select v-model.number="playback.speed" title="Playback speed">
      <option :value="0.5">0.5×</option>
      <option :value="1">1×</option>
      <option :value="2">2×</option>
    </select>
    <label class="loop" title="Loop"><input v-model="playback.loop" type="checkbox" /> Loop</label>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { scene } from '../scene/store'
import { playback, seek, stop, togglePlay } from './blocking'
import { marksOf, owners, PACES } from './marks'

export default defineComponent({
  name: 'BlockingBar',
  setup() {
    const hasMarks = computed(() => scene.marks.length > 0)
    // Shown before the first play too (the timeline is built when playing).
    const duration = computed(() => {
      if (playback.active) return playback.duration
      return owners().reduce((d, o) => {
        const kind = o.kind === 'camera' ? 'camera' : 'subject'
        let from = { x: o.x, z: o.z }
        let t = 0
        marksOf(o.id).forEach(m => {
          t += Math.hypot(m.x - from.x, m.z - from.z) / PACES[kind][m.pace].speed + m.hold
          from = m
        })
        return Math.max(d, t)
      }, 0)
    })
    const fmt = (t: number) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`
    const onSeek = (e: Event) => seek(Number((e.target as HTMLInputElement).value))
    return { playback, hasMarks, duration, fmt, onSeek, togglePlay, stop }
  }
})
</script>

<style scoped>
.blocking-bar { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); z-index: 5; display: flex; align-items: center; gap: 8px; padding: 5px 10px; background: rgba(23, 24, 28, 0.94); border: 1px solid var(--line); border-radius: 10px; font-size: 12px; white-space: nowrap; max-width: calc(100% - 24px); }
button { display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 6px; }
button svg { width: 16px; height: 16px; fill: currentColor; }
.play { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.stop:disabled { opacity: 0.35; cursor: default; }
.scrub { width: 160px; min-width: 60px; flex: 1; }
.time { font-variant-numeric: tabular-nums; color: var(--muted); }
select { padding: 2px 4px; font-size: 12px; }
.loop { display: flex; align-items: center; gap: 4px; color: var(--muted); }
.loop input { accent-color: var(--accent); margin: 0; }
</style>
