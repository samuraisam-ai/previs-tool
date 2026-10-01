<template>
  <div class="world">
    <h4 class="section">World light</h4>
    <label class="switch" :class="{ on: w.blackout }">
      <input type="checkbox" :checked="w.blackout" @change="w.blackout = !w.blackout" />
      <span class="track"><span class="thumb"></span></span>
      Blackout <small>only your fixtures light the scene</small>
    </label>

    <div :class="['presets', { dim: w.blackout }]" role="radiogroup" aria-label="Time of day">
      <button
        v-for="id in WORLD_ORDER"
        :key="id"
        role="radio"
        :aria-checked="w.preset === id"
        :class="{ on: w.preset === id }"
        :title="`${WORLD_PRESETS[id].note} · ${WORLD_PRESETS[id].lux} lux · ${WORLD_PRESETS[id].kelvin} K`"
        @click="pick(id)"
      >
        <span class="swatch" :style="{ background: swatch(WORLD_PRESETS[id].kelvin) }"></span>
        {{ WORLD_PRESETS[id].label }}
      </button>
    </div>

    <label :class="{ dim: w.blackout }">Amount
      <div class="amount">
        <input type="range" min="0" max="200" step="1" :value="w.percent" :disabled="w.blackout" @input="setPercent" />
        <input type="number" min="0" max="200" step="5" :value="Math.round(w.percent)" :disabled="w.blackout" @change="setPercent" />
        <span>%</span>
      </div>
    </label>
    <div class="marks"><span>0</span><span>100% = preset</span><span>200</span></div>

    <label :class="{ dim: w.blackout }">Colour temperature
      <div class="amount">
        <input type="number" min="1800" max="12000" step="100" :value="w.kelvin" :disabled="w.blackout" @change="setKelvin" />
        <span>K</span>
        <button v-if="w.kelvin !== WORLD_PRESETS[w.preset].kelvin" class="link" @click="w.kelvin = WORLD_PRESETS[w.preset].kelvin">Reset to {{ WORLD_PRESETS[w.preset].kelvin }} K</button>
      </div>
    </label>
    <p class="readout">{{ summary }}<br /><span class="note">{{ WORLD_PRESETS[w.preset].note }}</span></p>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { kelvinToSrgb } from '../../library/colour'
import { scene } from '../../scene/store'
import { WorldPreset } from '../../scene/types'
import { WORLD_ORDER, WORLD_PRESETS, worldSummary } from '../../scene/world'

export default defineComponent({
  name: 'WorldPanel',
  setup() {
    const w = computed(() => scene.world)
    const summary = computed(() => worldSummary(scene.world))
    // Choosing a time of day resets it to that preset's level and colour.
    const pick = (id: WorldPreset) => {
      Object.assign(scene.world, { preset: id, percent: 100, kelvin: WORLD_PRESETS[id].kelvin, blackout: false })
    }
    const value = (e: Event) => Number((e.target as HTMLInputElement).value)
    const setPercent = (e: Event) => { const v = value(e); if (isFinite(v)) scene.world.percent = Math.min(200, Math.max(0, v)) }
    const setKelvin = (e: Event) => { const v = value(e); if (isFinite(v)) scene.world.kelvin = Math.round(Math.min(12000, Math.max(1800, v))) }
    const swatch = (k: number) => `rgb(${kelvinToSrgb(k).map(c => Math.round(Math.min(1, c) * 255)).join(',')})`
    return { w, summary, pick, setPercent, setKelvin, swatch, WORLD_ORDER, WORLD_PRESETS }
  }
})
</script>

<style scoped>
.world { display: flex; flex-direction: column; gap: 8px; }
.switch { display: flex; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 8px; cursor: pointer; font-size: 13px; color: var(--text); }
.switch small { flex-basis: 100%; margin-left: 38px; margin-top: -6px; }
.switch input { position: absolute; opacity: 0; pointer-events: none; }
.switch small { color: var(--muted); font-size: 11px; }
.track { width: 30px; height: 17px; border-radius: 9px; background: #2c2f37; position: relative; transition: background 0.15s; flex-shrink: 0; }
.thumb { position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #d0d2d8; transition: left 0.15s; }
.switch.on .track { background: var(--accent); }
.switch.on .thumb { left: 15px; background: #1a1a1a; }
.switch input:focus-visible + .track { outline: 2px solid var(--accent); outline-offset: 2px; }
.presets { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.presets button { display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 6px 2px; font-size: 11px; }
.presets button.on { border-color: var(--accent); color: var(--accent); }
.swatch { width: 14px; height: 14px; border-radius: 50%; border: 1px solid rgba(255, 255, 255, 0.2); }
.dim { opacity: 0.4; }
.amount { display: flex; align-items: center; gap: 6px; margin-top: 4px; }
.amount input[type='range'] { flex: 1; }
.amount input[type='number'] { width: 70px; }
.marks { display: flex; justify-content: space-between; font-size: 10px; color: var(--muted); margin-top: -4px; }
.link { border: none; background: none; padding: 0; font-size: 11px; color: var(--accent); text-decoration: underline; }
.note { color: var(--muted); font-size: 11px; }
</style>
