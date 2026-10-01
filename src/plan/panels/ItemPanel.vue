<template>
  <div v-if="item" class="panel-body">
    <h4>{{ kindLabel[item.kind] }}</h4>
    <label>Name <input v-model="item.name" /></label>
    <label>Height (m) <input type="number" step="0.05" min="0.1" max="6" v-model.number="item.height" /></label>
    <label>Aim (°) <input type="number" step="5" v-model.number="item.rotationY" /></label>
    <div class="readout">x {{ item.x.toFixed(2) }} m · z {{ item.z.toFixed(2) }} m</div>

    <LightProperties v-if="item.kind === 'light'" :id="item.id" />

    <p v-if="item.kind === 'subject' && !meter" class="readout">Add a camera to meter this subject.</p>
    <template v-if="item.kind === 'subject' && meter">
      <h4 class="section">Light meter (face)</h4>
      <div class="meter-total">
        <strong>{{ meter.total.toLocaleString() }} lux</strong>
        <span>≈ T{{ meter.stop }} at ISO {{ meter.cam.iso }}, {{ meter.shutter }}{{ meter.filters }}</span>
      </div>
      <div class="meter-vs" :class="meter.verdict">{{ meter.vsText }}</div>
      <div class="meter-row" v-for="row in meter.rows" :key="row.id">
        <i class="swatch" :style="{ background: row.hex }"></i>{{ row.name }} <span>{{ row.lux.toLocaleString() }} lux</span>
      </div>
      <label v-if="cameraList.length > 1">Metering for
        <select v-model="scene.activeCameraId"><option v-for="c in cameraList" :key="c.id" :value="c.id">{{ c.name }}</option></select>
      </label>
      <div class="exposure">
        <label>ISO
          <select v-model.number="meter.cam.iso"><option v-for="iso in isos" :key="iso" :value="iso">{{ iso }}</option></select>
        </label>
        <label>Camera T-stop
          <select v-model.number="meter.cam.tStop"><option v-for="t in tStops" :key="t" :value="t">T{{ t }}</option></select>
        </label>
      </div>
      <div class="readout">Direct light plus estimated room bounce; shadows aren't counted.</div>
    </template>

    <div v-if="item.kind === 'camera' && crossesLine(item)" class="cross-warning">⚠ This camera is across the 180° line — screen direction will flip against the other cameras.</div>
    <CameraProperties v-if="item.kind === 'camera'" :id="item.id" />
    <MarksPanel v-if="item.kind === 'subject' || item.kind === 'camera'" :owner-id="item.id" />

    <div class="actions">
      <button @click="duplicate">Duplicate</button>
      <button class="danger" @click="remove">Delete</button>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import CameraProperties from '../../components/CameraProperties.vue'
import LightProperties from '../../components/LightProperties.vue'
import { crossesLine } from '../lineOfAction'
import MarksPanel from './MarksPanel.vue'
import { getBody } from '../../library/cameras'
import { formatShutter } from '../../library/optics'
import { illuminanceAt, nearestStop, resolveLight, stopsOver, subjectMeterPoint, T_STOPS, tStopFor } from '../../library/photometry'
import { activeCamera, getItem, scene, sceneBounce } from '../../scene/store'
import { CameraItem, LightItem } from '../../scene/types'
import { deleteIds, duplicateSelection } from '../ops'

export default defineComponent({
  name: 'ItemPanel',
  components: { CameraProperties, LightProperties, MarksPanel },
  props: {
    id: { type: String, required: true }
  },
  setup(props) {
    const item = computed(() => getItem(props.id))
    const cameraList = computed(() => scene.items.filter((i): i is CameraItem => i.kind === 'camera'))
    const lights = computed(() => scene.items.filter((i): i is LightItem => i.kind === 'light'))

    const meter = computed(() => {
      const subject = item.value
      const cam = activeCamera()
      if (!subject || subject.kind !== 'subject' || !cam) return null
      const exposure = cam.props
      const point = subjectMeterPoint(subject)
      const rows = lights.value
        .map(l => ({ id: l.id, name: l.name, hex: resolveLight(l).colourHex, lux: Math.round(illuminanceAt(l, point)) }))
        .sort((a, b) => b.lux - a.lux)
      const bounce = sceneBounce()
      if (bounce.lux >= 1) rows.push({ id: 'bounce', name: 'Room bounce (est.)', hex: '#8b8f99', lux: Math.round(bounce.lux) })
      const total = rows.reduce((sum, row) => sum + row.lux, 0)
      const over = stopsOver(total, exposure)
      const verdict = !isFinite(over) || over < -1 ? 'under' : over > 1 ? 'over' : 'good'
      const vsText = !isFinite(over)
        ? 'No direct light on the face'
        : Math.abs(over) < 0.17 ? `Exposed right at T${exposure.tStop}`
          : `${over > 0 ? '+' : '−'}${Math.abs(over).toFixed(1)} stops ${over > 0 ? 'over' : 'under'} at T${exposure.tStop}`
      const filters = [exposure.nd.fitted ? ` · ND ${exposure.nd.stops.toFixed(1)}` : '', exposure.polarizer.fitted ? ' · POL' : ''].join('')
      return { rows, total, stop: nearestStop(tStopFor(total, exposure)), verdict, vsText, cam: exposure, shutter: formatShutter(exposure), filters }
    })

    const remove = () => deleteIds([props.id])
    const duplicate = () => duplicateSelection([props.id])

    return { crossesLine,
      item, meter, cameraList, scene, remove, duplicate,
      kindLabel: { subject: 'Subject', light: 'Light', camera: 'Camera' },
      isos: getBody('fx3').isos,
      tStops: T_STOPS
    }
  }
})
</script>

<style scoped>
.cross-warning { font-size: 12px; line-height: 1.4; padding: 8px 10px; border-radius: 6px; background: rgba(255, 59, 48, 0.12); color: #ff8a83; margin: 8px 0; }
</style>
