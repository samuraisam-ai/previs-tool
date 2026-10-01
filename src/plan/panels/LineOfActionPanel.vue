<template>
  <div v-if="line" class="panel-body">
    <h4>180° line</h4>
    <p class="readout">Keep cameras on one side of the line of action so screen direction stays consistent between shots.</p>
    <label v-for="end in ENDS" :key="end.id">{{ end.label }}
      <select :value="(end.id === 'a' ? line.aSubject : line.bSubject) ?? ''" @change="setEnd(end.id, $event)">
        <option value="">Free point (drag to place)</option>
        <option v-for="s in subjects" :key="s.id" :value="s.id">Follows {{ s.name }}</option>
      </select>
    </label>
    <div class="status" :class="{ bad: crossing.length }">
      <template v-if="!cameras.length">No cameras yet.</template>
      <template v-else-if="crossing.length">⚠ {{ crossing.map(c => c.name).join(', ') }} {{ crossing.length === 1 ? 'crosses' : 'cross' }} the line</template>
      <template v-else>✓ All {{ cameras.length }} camera{{ cameras.length === 1 ? '' : 's' }} on the same side</template>
    </div>
    <div class="actions">
      <button title="Make the other side the camera side" @click="flipLineSide">Flip side</button>
      <button @click="hide">Hide</button>
      <button class="danger" @click="removeLine">Delete</button>
    </div>
    <p class="readout">Drag an end to adjust it freely; drop it on a subject to attach it again. <b>L</b> shows or hides the line.</p>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { scene } from '../../scene/store'
import { CameraItem } from '../../scene/types'
import { clearSelection } from '../editor'
import { crossesLine, flipLineSide, removeLine, setLineSubject, toggleLine } from '../lineOfAction'

const ENDS = [{ id: 'a' as const, label: 'End A' }, { id: 'b' as const, label: 'End B' }]

export default defineComponent({
  name: 'LineOfActionPanel',
  setup() {
    const line = computed(() => scene.lineOfAction)
    const subjects = computed(() => scene.items.filter(i => i.kind === 'subject'))
    const cameras = computed(() => scene.items.filter((i): i is CameraItem => i.kind === 'camera'))
    const crossing = computed(() => cameras.value.filter(c => crossesLine(c)))
    const setEnd = (end: 'a' | 'b', e: Event) => setLineSubject(end, (e.target as HTMLSelectElement).value || null)
    const hide = () => { toggleLine(); clearSelection() }
    return { line, subjects, cameras, crossing, setEnd, hide, flipLineSide, removeLine: () => { removeLine(); clearSelection() }, ENDS }
  }
})
</script>

<style scoped>
.status { font-size: 13px; padding: 8px 10px; border-radius: 6px; background: rgba(76, 195, 138, 0.1); color: #7fdcae; margin: 6px 0; }
.status.bad { background: rgba(255, 98, 89, 0.12); color: #ff8a83; }
</style>
