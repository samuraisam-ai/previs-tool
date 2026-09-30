<template>
  <div v-if="o && wall" class="panel-body">
    <h4>{{ label }}</h4>
    <label>Type
      <select :value="o.kind" @change="e => setKind(e.target.value)">
        <option value="door">Door</option>
        <option value="double-door">Double door</option>
        <option value="sliding-door">Sliding door</option>
        <option value="opening">Doorway (no door)</option>
        <option value="window">Window</option>
      </select>
    </label>
    <div class="row2">
      <label>Width (m)
        <input type="number" step="0.01" min="0.3" :value="o.width" @change="e => setWidth(Number(e.target.value))" />
      </label>
      <label>Height (m)
        <input type="number" step="0.01" min="0.3" :max="wall.height" v-model.number="o.height" />
      </label>
    </div>
    <div class="row2">
      <label>From wall start (m)
        <input type="number" step="0.01" min="0" :value="(o.offset - o.width / 2).toFixed(2)" @change="e => setStartDistance(Number(e.target.value))" />
      </label>
      <label v-if="o.kind === 'window'">Sill height (m)
        <input type="number" step="0.05" min="0" :max="wall.height - o.height" v-model.number="o.sill" />
      </label>
    </div>

    <template v-if="isDoor">
      <div class="modes">
        <button :class="{ on: o.hinge === 'left' }" @click="o.hinge = 'left'">{{ o.kind === 'sliding-door' ? 'Slides left' : 'Hinge left' }}</button>
        <button :class="{ on: o.hinge === 'right' }" @click="o.hinge = 'right'">{{ o.kind === 'sliding-door' ? 'Slides right' : 'Hinge right' }}</button>
      </div>
      <div class="modes">
        <button :class="{ on: o.swing === 'in' }" @click="o.swing = 'in'">Opens this side</button>
        <button :class="{ on: o.swing === 'out' }" @click="o.swing = 'out'">Opens other side</button>
      </div>
      <button class="toggle" :class="{ on: o.openAngle > 0 }" @click="toggle">{{ o.openAngle > 0 ? 'Open — click to close' : 'Closed — click to open' }}</button>
      <div class="field centred">
        <span class="caption">{{ o.kind === 'sliding-door' ? 'Slide' : 'Open angle' }}</span>
        <AngleWheel v-model="openAngle" :min="0" :max="o.kind === 'sliding-door' ? 90 : 180" :snap="15" :size="110" label="Door open angle" />
      </div>
      <div class="readout">Tip: double-click a door on the plan to open or close it.</div>
    </template>

    <div class="actions">
      <button @click="duplicate">Duplicate</button>
      <button class="danger" @click="remove">Delete</button>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import AngleWheel from '../../components/controls/AngleWheel.vue'
import { scene } from '../../scene/store'
import { OpeningKind } from '../../scene/types'
import { clampOffset, deleteIds, duplicateSelection, getWall, openingDefaults, openingFits, toggleDoor } from '../ops'

const LABELS: Record<OpeningKind, string> = {
  'door': 'Door', 'double-door': 'Double door', 'sliding-door': 'Sliding door', 'opening': 'Doorway', 'window': 'Window'
}

export default defineComponent({
  name: 'OpeningPanel',
  components: { AngleWheel },
  props: {
    id: { type: String, required: true }
  },
  setup(props) {
    const o = computed(() => scene.openings.find(x => x.id === props.id))
    const wall = computed(() => (o.value ? getWall(o.value.wallId) : undefined))
    const isDoor = computed(() => !!o.value && ['door', 'double-door', 'sliding-door'].includes(o.value.kind))
    const label = computed(() => (o.value ? LABELS[o.value.kind] : ''))

    const openAngle = computed({
      get: () => o.value?.openAngle ?? 0,
      set: v => {
        if (!o.value) return
        o.value.openAngle = v
        if (v > 0) o.value.openTo = v
      }
    })

    const setWidth = (v: number) => {
      if (!o.value || !wall.value || !(v >= 0.3)) return
      const offset = clampOffset(wall.value, o.value.offset, v)
      if (openingFits(wall.value, offset, v, o.value.id)) {
        o.value.width = Math.round(v * 1000) / 1000
        o.value.offset = offset
      }
    }
    const setStartDistance = (v: number) => {
      if (!o.value || !wall.value || !isFinite(v)) return
      const offset = clampOffset(wall.value, v + o.value.width / 2, o.value.width)
      if (openingFits(wall.value, offset, o.value.width, o.value.id)) o.value.offset = offset
    }
    const setKind = (kind: string) => {
      if (!o.value || !wall.value) return
      const d = openingDefaults(kind as OpeningKind)
      const offset = clampOffset(wall.value, o.value.offset, d.width)
      o.value.kind = kind as OpeningKind
      if (openingFits(wall.value, offset, d.width, o.value.id)) {
        o.value.width = d.width
        o.value.offset = offset
      }
      o.value.height = d.height
      o.value.sill = d.sill
      if (kind === 'window' || kind === 'opening') o.value.openAngle = 0
    }
    const toggle = () => { if (o.value) toggleDoor(o.value) }
    const remove = () => deleteIds([props.id])
    const duplicate = () => duplicateSelection([props.id])

    return { o, wall, isDoor, label, openAngle, setWidth, setStartDistance, setKind, toggle, remove, duplicate }
  }
})
</script>
