<template>
  <div v-if="item && def" class="panel-body prop-panel">
    <h4>{{ items.length > 1 ? `${items.length} × ${def.name}` : def.name }}</h4>
    <p v-if="items.length > 1" class="readout">Changes apply to all {{ items.length }} selected.</p>
    <label v-else>Name <input :value="item.name" @change="setName($event)" /></label>

    <h4 class="section">Size</h4>
    <div class="row3">
      <label>Width (m) <input type="number" step="0.01" min="0.02" :value="item.props.w" @change="setSize('w', $event)" /></label>
      <label>Depth (m) <input type="number" step="0.01" min="0.005" :value="item.props.d" @change="setSize('d', $event)" /></label>
      <label>Height (m) <input type="number" step="0.01" min="0.005" :value="item.props.h" @change="setSize('h', $event)" /></label>
    </div>
    <label class="check"><input v-model="lock" type="checkbox" /> Keep proportions</label>
    <div class="row2">
      <label>Elevation (m) <input type="number" step="0.01" min="0" max="5" :value="item.props.elevation" @change="setElevation($event)" /></label>
      <div class="angle">
        <AngleWheel :model-value="heading" :min="0" :max="359" :snap="15" :size="84" label="Rotation" @update:model-value="setHeading" />
      </div>
    </div>

    <template v-if="def.options && def.options.length">
      <h4 class="section">Shape</h4>
      <div class="options">
        <label v-for="opt in def.options" :key="opt.id" :class="{ check: opt.type === 'toggle' }">
          <template v-if="opt.type === 'toggle'">
            <input type="checkbox" :checked="!!optionValue(opt.id)" @change="setOption(opt.id, ($event.target as HTMLInputElement).checked)" /> {{ opt.label }}
          </template>
          <template v-else>
            {{ opt.label }}
            <select v-if="opt.type === 'select'" :value="optionValue(opt.id)" @change="setOption(opt.id, ($event.target as HTMLSelectElement).value)">
              <option v-for="c in opt.choices" :key="c.value" :value="c.value">{{ c.label }}</option>
            </select>
            <input v-else type="number" :min="opt.min" :max="opt.max" :step="opt.step || 1" :value="optionValue(opt.id)" @change="setOption(opt.id, Number(($event.target as HTMLInputElement).value))" />
          </template>
        </label>
      </div>
    </template>

    <h4 class="section">Finishes</h4>
    <div class="finishes">
      <FinishEditor
        v-for="(slot, i) in def.slots"
        :key="slot.id"
        :value="finishOf(item, slot.id)"
        :label="slot.label"
        :fit="def.imageSlot === slot.id"
        :start-open="i === 0"
        @update="setFinish(slot.id, $event)"
        @reset="resetFinish(slot.id)"
      />
    </div>

    <div class="actions">
      <button @click="duplicate">Duplicate</button>
      <button class="danger" @click="remove">Delete</button>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref } from 'vue'
import AngleWheel from '../../components/controls/AngleWheel.vue'
import { getDef } from '../../props/catalog'
import { finishOf } from '../../props/create'
import { makeFinish } from '../../props/finish'
import FinishEditor from '../../props/FinishEditor.vue'
import { OptionValue } from '../../props/types'
import { scene } from '../../scene/store'
import { Finish, PropItem } from '../../scene/types'
import { deleteIds, duplicateSelection } from '../ops'

export default defineComponent({
  name: 'PropPanel',
  components: { AngleWheel, FinishEditor },
  props: {
    ids: { type: Array as PropType<string[]>, required: true }
  },
  setup(props) {
    const items = computed(() => props.ids.map(id => scene.items.find(i => i.id === id)).filter((i): i is PropItem => i?.kind === 'prop'))
    const item = computed(() => items.value[0])
    const def = computed(() => (item.value ? getDef(item.value.props.catalogId) : undefined))
    const lock = ref(false)
    const each = (fn: (p: PropItem) => void) => items.value.forEach(fn)
    const num = (e: Event) => Number((e.target as HTMLInputElement).value)

    const setName = (e: Event) => { if (item.value) item.value.name = (e.target as HTMLInputElement).value.trim() || def.value?.name || 'Prop' }
    const setSize = (key: 'w' | 'd' | 'h', e: Event) => {
      const v = num(e)
      if (!isFinite(v) || v <= 0) return
      each(p => {
        const ratio = v / p.props[key]
        if (lock.value && isFinite(ratio)) { p.props.w *= ratio; p.props.d *= ratio; p.props.h *= ratio }
        else p.props[key] = v
        p.props.w = Math.round(p.props.w * 1000) / 1000
        p.props.d = Math.round(p.props.d * 1000) / 1000
        p.props.h = Math.round(p.props.h * 1000) / 1000
      })
    }
    const setElevation = (e: Event) => { const v = num(e); if (isFinite(v)) each(p => { p.props.elevation = Math.max(0, Math.round(v * 1000) / 1000) }) }
    const heading = computed(() => (item.value ? ((Math.round(item.value.rotationY) % 360) + 360) % 360 : 0))
    const setHeading = (deg: number) => each(p => { p.rotationY = ((Math.round(deg) % 360) + 360) % 360 })
    const optionValue = (id: string) => item.value?.props.options[id] ?? def.value?.options?.find(o => o.id === id)?.default
    const setOption = (id: string, value: OptionValue) => each(p => {
      p.props.options = { ...p.props.options, [id]: value }
      // Some options set the size (e.g. bed size).
      const size = getDef(p.props.catalogId)?.sizeFor?.(p.props.options, { w: p.props.w, d: p.props.d, h: p.props.h })
      if (size && id === 'size') Object.assign(p.props, size)
    })
    const setFinish = (slot: string, f: Finish) => each(p => { p.props.finishes = { ...p.props.finishes, [slot]: { ...f } } })
    const resetFinish = (slot: string) => {
      const s = def.value?.slots.find(x => x.id === slot)
      if (s) setFinish(slot, makeFinish(s.default))
    }
    const duplicate = () => duplicateSelection(props.ids)
    const remove = () => deleteIds(props.ids)
    return { items, item, def, lock, heading, setName, setSize, setElevation, setHeading, optionValue, setOption, setFinish, resetFinish, finishOf, duplicate, remove }
  }
})
</script>

<style scoped>
.row3 { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.row2 { display: flex; gap: 10px; align-items: flex-end; }
.row2 label { flex: 1; }
.angle { flex-shrink: 0; }
.options { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 8px; }
.options .check { flex-direction: row; align-items: center; gap: 6px; grid-column: span 2; }
.finishes { display: flex; flex-direction: column; gap: 6px; }
</style>
