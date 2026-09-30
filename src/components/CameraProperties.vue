<template>
  <div v-if="cam" class="camera-props">
    <div class="spec">{{ body.brand }} {{ body.model }} · {{ body.sensorWidth }}×{{ body.sensorHeight }} mm full frame</div>

    <label>Lens ({{ lens.kit }})
      <select v-model="p.lensId" @change="clampIris">
        <option v-for="l in lenses" :key="l.id" :value="l.id">{{ l.name }}{{ l.approx ? ' ≈' : '' }}</option>
      </select>
    </label>
    <div class="spec">
      T{{ lens.maxT }}–T{{ lens.minT }} · close focus {{ lens.closeFocus }} m{{ lens.approx ? ' (est.)' : '' }} · {{ lens.blades }}-blade iris
    </div>

    <label>Frame rate
      <select v-model.number="p.fps">
        <option v-for="r in body.frameRates" :key="r.fps" :value="r.fps">{{ r.label }}{{ r.crop > 1 ? ` (${r.crop}× crop)` : '' }}</option>
      </select>
    </label>

    <div class="field">
      <span class="caption">Focus</span>
      <div class="modes">
        <button v-for="s in subjects" :key="s.id" :class="{ on: p.focus.mode === 'subject' && p.focus.subjectId === s.id }" @click="track(s.id)">AF · {{ s.name }}</button>
        <button :class="{ on: p.focus.mode === 'manual' }" @click="manual(focusM)">MF</button>
      </div>
      <label v-if="p.focus.mode === 'manual'">Distance (m)
        <input type="number" :min="lens.closeFocus" max="30" step="0.05" :value="p.focus.distance.toFixed(2)" @change="e => manual(Number(e.target.value))" />
      </label>
      <div class="spec">
        Focus {{ formatDistance(focusM) }} · sharp {{ formatDistance(dof.near) }} – {{ formatDistance(dof.far) }}
        at T{{ p.tStop }}
      </div>
    </div>

    <div class="field tilt">
      <span class="caption">Tilt</span>
      <TiltWheel v-model="p.tilt" icon="camera" label="Camera tilt" />
    </div>

    <div class="field">
      <span class="caption">Exposure</span>
      <div class="summary">
        {{ formatShutter(p) }} · T{{ p.tStop }} · ISO {{ p.iso }} · WB {{ p.wb }}K
        <br />ND {{ p.nd.fitted ? `${p.nd.stops.toFixed(1)} stops` : 'clear' }} · POL {{ p.polarizer.fitted ? `${Math.round(p.polarizer.angle)}°` : 'off' }} · {{ profileLabel }}
      </div>
      <button v-if="scene.activeCameraId !== cam.id" @click="scene.activeCameraId = cam.id">Use for exposure &amp; meter</button>
      <div v-else class="spec active">● Active camera (exposure &amp; meter)</div>
      <div class="spec">Full camera controls: Live View → View → {{ cam.name }}.</div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import TiltWheel from './controls/TiltWheel.vue'
import { getBody } from '../library/cameras'
import { getLens, LENSES } from '../library/lenses'
import { dofLimits, focusDistance, formatDistance, formatShutter } from '../library/optics'
import { T_STOPS } from '../library/photometry'
import { getItem, scene } from '../scene/store'
import { CameraItem, SubjectItem } from '../scene/types'

export default defineComponent({
  name: 'CameraProperties',
  components: { TiltWheel },
  props: {
    id: { type: String, required: true }
  },
  setup(props) {
    const cam = computed(() => {
      const item = getItem(props.id)
      return item && item.kind === 'camera' ? item : undefined
    })
    const p = computed(() => (cam.value as CameraItem).props)
    const body = computed(() => getBody(p.value.bodyId))
    const lens = computed(() => getLens(p.value.lensId))
    const subjects = computed(() => scene.items.filter((i): i is SubjectItem => i.kind === 'subject'))
    const focusM = computed(() => focusDistance(cam.value as CameraItem, scene))
    const dof = computed(() => dofLimits(p.value, focusM.value))
    const profileLabel = computed(() => body.value.profiles.find(pr => pr.id === p.value.profile)?.label)

    const track = (id: string) => {
      p.value.focus.mode = 'subject'
      p.value.focus.subjectId = id
    }
    const manual = (m: number) => {
      p.value.focus.mode = 'manual'
      p.value.focus.distance = Math.min(30, Math.max(lens.value.closeFocus, m || lens.value.closeFocus))
    }
    const clampIris = () => {
      const stops = T_STOPS.filter(t => t >= lens.value.maxT && t <= lens.value.minT)
      if (!stops.includes(p.value.tStop)) p.value.tStop = stops.reduce((a, b) => (Math.abs(b - p.value.tStop) < Math.abs(a - p.value.tStop) ? b : a))
    }

    return {
      cam, p, body, lens, subjects, focusM, dof, profileLabel, track, manual, clampIris,
      formatDistance, formatShutter, scene, lenses: LENSES
    }
  }
})
</script>

<style scoped>
.camera-props { display: flex; flex-direction: column; gap: 12px; }
label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); }
select, input { width: 100%; box-sizing: border-box; }
.field { display: flex; flex-direction: column; gap: 6px; }
.caption { color: var(--muted); }
.tilt { align-items: center; }
.tilt .caption { align-self: flex-start; }
.spec, .summary { color: var(--muted); font-size: 12px; line-height: 1.5; }
.summary { color: var(--text); }
.active { color: #8fdc8f; }
.modes { display: flex; flex-wrap: wrap; gap: 4px; }
.modes button { flex: 1; font-size: 12px; }
.modes button.on { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
</style>
