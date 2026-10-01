<template>
  <div v-if="wall" class="panel-body">
    <h4>Wall</h4>
    <div class="row2">
      <label>Length (m)
        <input type="number" step="0.01" min="0.05" :value="length.toFixed(3)" @change="e => setLength(Number(e.target.value))" />
      </label>
      <label>Keep
        <select v-model="anchor">
          <option value="start">Start</option>
          <option value="centre">Centre</option>
          <option value="end">End</option>
        </select>
      </label>
    </div>
    <div class="row2">
      <label>Thickness (m)
        <input type="number" step="0.01" min="0.03" max="1" :value="wall.thickness" @change="e => setThickness(Number(e.target.value))" />
      </label>
      <label>Height (m)
        <input type="number" step="0.05" min="0.2" max="10" v-model.number="wall.height" />
      </label>
    </div>
    <div class="row2">
      <label>Start x (m)
        <input type="number" step="0.01" :value="wall.a.x" @change="e => setStart(Number(e.target.value), wall.a.z)" />
      </label>
      <label>Start z (m)
        <input type="number" step="0.01" :value="wall.a.z" @change="e => setStart(wall.a.x, Number(e.target.value))" />
      </label>
    </div>
    <div class="field">
      <span class="caption">Angle</span>
      <div class="angle-row">
        <AngleWheel :model-value="compass" :min="0" :max="359" :snap="15" :size="100" label="Wall angle" @update:model-value="setCompass" />
        <label>Degrees
          <input type="number" step="1" :value="Math.round(compass)" @change="e => setCompass(Number(e.target.value))" />
        </label>
      </div>
    </div>
    <div class="field">
      <span class="caption">Corners</span>
      <div v-for="c in corners" :key="c.end" class="corner">
        <span :class="['dot', { detached: c.detached }]"></span>
        <span class="corner-text"><b>{{ c.label }}</b> · {{ c.status }}</span>
        <button v-if="c.detached" title="Snap this end onto the nearest corner (within 30 cm) and link it" @click="attach(c.end)">Attach</button>
        <button v-else :disabled="!c.linked" title="Unlink this end so it moves on its own" @click="detach(c.end)">Detach</button>
      </div>
      <div v-if="attachMessage" class="readout">{{ attachMessage }}</div>
    </div>
    <div class="actions">
      <button @click="addHere('door')">+ Door here</button>
      <button @click="addHere('window')">+ Window here</button>
    </div>
    <div class="actions">
      <button @click="duplicate">Duplicate</button>
      <button class="danger" @click="remove">Delete</button>
    </div>
    <div class="readout">Drag the round end handles to lengthen or turn it, the square side handle to make it thicker.</div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import AngleWheel from '../../components/controls/AngleWheel.vue'
import { OpeningKind } from '../../scene/types'
import { wallAngle, wallLength } from '../geometry'
import { addOpening, attachCorner, cornerLinks, deleteIds, detachCorner, duplicateSelection, getWall, setWallAngle, setWallLength, setWallStart } from '../ops'

export default defineComponent({
  name: 'WallPanel',
  components: { AngleWheel },
  props: {
    id: { type: String, required: true }
  },
  setup(props) {
    const wall = computed(() => getWall(props.id))
    const length = computed(() => (wall.value ? wallLength(wall.value) : 0))
    const anchor = ref<'start' | 'centre' | 'end'>('start')
    // Shown as a compass bearing on the plan: 0° = up the plan, clockwise.
    const compass = computed(() => (wall.value ? ((90 - wallAngle(wall.value)) % 360 + 360) % 360 : 0))

    const setLength = (v: number) => { if (wall.value && v > 0.04) setWallLength(wall.value, v, anchor.value) }
    const setThickness = (v: number) => { if (wall.value) wall.value.thickness = Math.min(1, Math.max(0.03, Math.round(v * 100) / 100)) }
    const setStart = (x: number, z: number) => { if (wall.value && isFinite(x) && isFinite(z)) setWallStart(wall.value, { x, z }) }
    const setCompass = (deg: number) => { if (wall.value) setWallAngle(wall.value, 90 - deg) }
    const addHere = (kind: OpeningKind) => { if (wall.value) addOpening(kind, wall.value.id, length.value / 2) }
    const remove = () => deleteIds([props.id])

    // ── Corner links ─────────────────────────────────────────────────────
    const attachMessage = ref('')
    const corners = computed(() => {
      const w = wall.value
      if (!w) return []
      return (['a', 'b'] as const).map(end => {
        const detached = !!w.detached?.[end]
        const links = cornerLinks(w, end)
        const n = links.walls + links.rooms
        const parts = [links.walls ? `${links.walls} wall${links.walls === 1 ? '' : 's'}` : '', links.rooms ? `${links.rooms} room${links.rooms === 1 ? '' : 's'}` : ''].filter(Boolean)
        const status = detached ? 'Detached' : n ? `Linked to ${parts.join(' + ')}` : 'Free end'
        return { end, label: end === 'a' ? 'Start' : 'End', detached, linked: n > 0, status }
      })
    })
    const detach = (end: 'a' | 'b') => { if (wall.value) { detachCorner(wall.value, end); attachMessage.value = '' } }
    const attach = (end: 'a' | 'b') => {
      if (!wall.value) return
      attachMessage.value = attachCorner(wall.value, end) ? '' : 'Nothing within 30 cm to attach to — drag the end closer to a corner first.'
    }
    const duplicate = () => duplicateSelection([props.id])

    return { wall, length, anchor, compass, setLength, setThickness, setStart, setCompass, addHere, remove, duplicate, corners, detach, attach, attachMessage }
  }
})
</script>.corner { display: flex; align-items: center; gap: 8px; margin-top: 6px; font-size: 12px; }
.corner-text { flex: 1; color: var(--muted); }
.corner-text b { color: var(--text); font-weight: 500; }
.corner button { padding: 2px 10px; font-size: 12px; }
.corner button:disabled { opacity: 0.35; cursor: default; }
.dot { width: 10px; height: 10px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
.dot.detached { background: transparent; border: 2px dashed var(--accent); }

