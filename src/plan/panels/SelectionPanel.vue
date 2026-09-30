<template>
  <div class="panel-body">
    <template v-if="room">
      <h4>Room</h4>
      <label>Name <input v-model="room.name" /></label>
      <div class="readout">Area {{ area }} m² · includes its walls and anything inside when moved, rotated or resized</div>
      <label>Floor
        <select v-model="room.floor">
          <option value="wood">Wood</option>
          <option value="tile">Tile</option>
          <option value="concrete">Concrete</option>
          <option value="carpet">Carpet</option>
        </select>
      </label>
      <div class="row2">
        <label class="check"><input type="checkbox" v-model="room.ceiling" /> Ceiling</label>
        <label v-if="room.ceiling">Ceiling (m)
          <input type="number" step="0.05" min="1.8" max="10" v-model.number="room.ceilingHeight" />
        </label>
      </div>
    </template>
    <template v-else>
      <h4>{{ ids.length }} selected</h4>
      <div class="readout">{{ summary }}</div>
    </template>

    <div class="row2">
      <label>Width (m)
        <input type="number" step="0.01" min="0.1" :value="size.w.toFixed(2)" @change="e => resize(Number(e.target.value), size.d)" />
      </label>
      <label>Depth (m)
        <input type="number" step="0.01" min="0.1" :value="size.d.toFixed(2)" @change="e => resize(size.w, Number(e.target.value))" />
      </label>
    </div>
    <div class="row2">
      <label>Left x (m)
        <input type="number" step="0.01" :value="size.x.toFixed(2)" @change="e => moveTo(Number(e.target.value), size.z)" />
      </label>
      <label>Bottom z (m)
        <input type="number" step="0.01" :value="size.z.toFixed(2)" @change="e => moveTo(size.x, Number(e.target.value))" />
      </label>
    </div>
    <div class="field">
      <span class="caption">Rotate</span>
      <div class="angle-row">
        <AngleWheel :relative="true" :snap="15" :size="100" label="Rotate selection" @turn="turn" />
        <div class="rot-buttons">
          <button @click="turn(-90)">⟲ 90°</button>
          <button @click="turn(90)">⟳ 90°</button>
          <label>By (°)
            <input type="number" step="1" placeholder="e.g. 30" @change="e => { turn(Number(e.target.value)); e.target.value = '' }" />
          </label>
        </div>
      </div>
    </div>
    <div class="actions">
      <button @click="duplicate">Duplicate</button>
      <button class="danger" @click="remove">Delete</button>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import AngleWheel from '../../components/controls/AngleWheel.vue'
import { scene } from '../../scene/store'
import { polygonArea } from '../geometry'
import { deleteIds, duplicateSelection, expandSelection, getEntity, nudgeSelection, resizeSelection, rotateSelection, selectionBounds } from '../ops'

export default defineComponent({
  name: 'SelectionPanel',
  components: { AngleWheel },
  props: {
    ids: { type: Array as PropType<string[]>, required: true }
  },
  setup(props) {
    const room = computed(() => (props.ids.length === 1 ? scene.rooms.find(r => r.id === props.ids[0]) : undefined))
    const area = computed(() => (room.value ? Math.abs(polygonArea(room.value.points)).toFixed(2) : ''))
    // Rooms carry their walls and contents.
    const targets = computed(() => expandSelection(props.ids))
    const size = computed(() => {
      const b = selectionBounds(targets.value)
      return b ? { w: b.maxX - b.minX, d: b.maxZ - b.minZ, x: b.minX, z: b.minZ } : { w: 0, d: 0, x: 0, z: 0 }
    })
    const summary = computed(() => {
      const counts: Record<string, number> = {}
      props.ids.forEach(id => {
        const e = getEntity(id)
        if (!e) return
        const k = e.kind === 'item' ? e.obj.kind : e.kind
        counts[k] = (counts[k] || 0) + 1
      })
      return Object.entries(counts).map(([k, n]) => `${n} ${k}${n > 1 ? 's' : ''}`).join(' · ')
    })

    const resize = (w: number, d: number) => { if (w > 0.05 && d > 0.05) resizeSelection(targets.value, w, d) }
    const moveTo = (x: number, z: number) => {
      if (isFinite(x) && isFinite(z)) nudgeSelection(targets.value, { x: x - size.value.x, z: z - size.value.z })
    }
    const turn = (deg: number) => { if (deg && isFinite(deg)) rotateSelection(targets.value, deg) }
    const duplicate = () => duplicateSelection(props.ids)
    const remove = () => deleteIds(props.ids)

    return { room, area, size, summary, resize, moveTo, turn, duplicate, remove }
  }
})
</script>
