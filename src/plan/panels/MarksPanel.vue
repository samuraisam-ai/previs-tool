<template>
  <div class="marks-panel">
    <h4 class="section"><span class="chip" :style="{ background: colour }"></span>Blocking marks</h4>
    <p v-if="!list.length" class="readout">
      No marks yet. Press <b>Add marks</b> (or <b>K</b>) and click on the plan to place T marks 1, 2, 3… in the order {{ kind === 'camera' ? 'the camera moves' : 'they move' }}.
    </p>
    <ol class="list">
      <li v-for="(m, i) in list" :key="m.id" :class="{ active: m.id === editor.activeMark }" @click="editor.activeMark = m.id">
        <div class="row">
          <span class="num" :style="{ borderColor: colour }">{{ m.order }}</span>
          <input class="note" :value="m.note" placeholder="Beat / note" @change="updateMark(m.id, { note: value($event) })" @click.stop />
          <button title="Move earlier" :disabled="i === 0" @click.stop="moveMarkOrder(m.id, -1)">↑</button>
          <button title="Move later" :disabled="i === list.length - 1" @click.stop="moveMarkOrder(m.id, 1)">↓</button>
          <button class="x" title="Delete mark" @click.stop="deleteMark(m.id)">✕</button>
        </div>
        <div class="row small">
          <label>Hold <input type="number" min="0" max="60" step="0.5" :value="m.hold" @change="updateMark(m.id, { hold: Math.max(0, Number(value($event)) || 0) })" @click.stop /> s</label>
          <select :value="m.pace" title="How fast it travels to this mark" @change="updateMark(m.id, { pace: value($event) })" @click.stop>
            <option v-for="(p, id) in paces" :key="id" :value="id">{{ p.label }}</option>
          </select>
          <button class="go" title="Put it on this mark (position and facing)" @click.stop="goToMark(m.id)">Go to {{ m.order }}</button>
        </div>
      </li>
    </ol>
    <div class="actions">
      <button :class="{ on: editor.tool === 'marks' && editor.markOwner === ownerId }" @click="startPlacing">＋ Add marks</button>
      <button v-if="list.length" class="danger" @click="clearAll">Clear path</button>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { getItem, scene } from '../../scene/store'
import { editor } from '../editor'
import { clearMarks, deleteMark, goToMark, marksOf, moveMarkOrder, ownerColour, PACES, startMarks, updateMark } from '../marks'

export default defineComponent({
  name: 'MarksPanel',
  props: {
    ownerId: { type: String, required: true }
  },
  setup(props) {
    const list = computed(() => { void scene.marks.length; return marksOf(props.ownerId) })
    const kind = computed(() => (getItem(props.ownerId)?.kind === 'camera' ? 'camera' : 'subject'))
    const paces = computed(() => PACES[kind.value])
    const colour = computed(() => ownerColour(props.ownerId))
    const value = (e: Event) => (e.target as HTMLInputElement).value
    const startPlacing = () => startMarks(props.ownerId)
    const clearAll = () => { if (window.confirm('Remove every mark on this path?')) clearMarks(props.ownerId) }
    return { list, kind, paces, colour, editor, value, startPlacing, clearAll, updateMark, deleteMark, moveMarkOrder, goToMark }
  }
})
</script>

<style scoped>
.section { display: flex; align-items: center; gap: 6px; }
.chip { width: 10px; height: 10px; border-radius: 2px; }
.list { list-style: none; margin: 4px 0 8px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.list li { border: 1px solid var(--line); border-radius: 8px; padding: 6px; display: flex; flex-direction: column; gap: 5px; cursor: pointer; }
.list li.active { border-color: var(--accent); background: rgba(255, 181, 71, 0.06); }
.row { display: flex; align-items: center; gap: 4px; }
.row.small { font-size: 11px; color: var(--muted); }
.num { width: 22px; height: 22px; border: 2px solid; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
.note { flex: 1; min-width: 0; padding: 3px 6px; font-size: 12px; }
.row button { padding: 2px 7px; font-size: 11px; }
.row button:disabled { opacity: 0.3; }
.row.small label { display: flex; align-items: center; gap: 3px; }
.row.small input { width: 46px; padding: 2px 4px; font-size: 11px; }
.row.small select { padding: 2px 4px; font-size: 11px; flex: 1; min-width: 0; }
.go { white-space: nowrap; }
.x { border-color: transparent; background: none; color: var(--muted); }
.actions button.on { border-color: var(--accent); color: var(--accent); }
</style>
