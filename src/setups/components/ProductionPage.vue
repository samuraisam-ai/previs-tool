<template>
  <div class="page">
    <div class="head">
      <input class="title" :value="production.title" aria-label="Production title" @change="rename" />
      <div class="actions">
        <button :disabled="exporting" @click="exportFile">{{ exporting ? 'Exporting…' : 'Export' }}</button>
        <button class="danger" @click="remove">Delete</button>
        <button class="primary" @click="startNew">＋ New scene</button>
      </div>
    </div>

    <form v-if="draft" class="new" @submit.prevent="create">
      <SceneForm :value="draft" @patch="Object.assign(draft, $event)" />
      <div class="actions">
        <button class="primary" type="submit">Add scene</button>
        <button type="button" @click="draft = null">Cancel</button>
      </div>
    </form>

    <p v-if="!scenes.length && !draft" class="empty">No scenes yet. Add the first one to start tracking setups and storyboards.</p>

    <ol class="scenes">
      <li
        v-for="(s, i) in scenes"
        :key="s.id"
        draggable="true"
        :class="{ over: reorder.over.value === s.id, dragging: reorder.dragging.value === s.id }"
        @dragstart="reorder.onDragStart(s.id, $event)"
        @dragover="reorder.onDragOver(s.id, $event)"
        @drop="reorder.onDrop(s.id)"
        @dragend="reorder.onDragEnd"
      >
        <span class="grip" title="Drag to reorder">⋮⋮</span>
        <button class="open" @click="openSetups(production.id, s.id)">
          <b>{{ slugLine(s) }}</b>
          <span v-if="s.synopsis">{{ s.synopsis }}</span>
          <small>{{ counts(s) }}</small>
        </button>
        <span class="move">
          <button :disabled="i === 0" title="Move up" @click="reorder.move(s.id, -1)">↑</button>
          <button :disabled="i === scenes.length - 1" title="Move down" @click="reorder.move(s.id, 1)">↓</button>
        </span>
      </li>
    </ol>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref } from 'vue'
import { openSetups } from '../../nav'
import { useReorder } from '../reorder'
import { createScene, deleteProduction, exportProduction, nextSceneNumber, SceneFields, scenesOf, setups, updateProduction } from '../store'
import { Production, Scene, slugLine } from '../types'
import { download, fileSafe } from './format'
import SceneForm from './SceneForm.vue'

export default defineComponent({
  name: 'ProductionPage',
  components: { SceneForm },
  props: {
    production: { type: Object as PropType<Production>, required: true }
  },
  setup(props) {
    const scenes = computed(() => scenesOf(props.production))
    const draft = ref<SceneFields | null>(null)
    const exporting = ref(false)
    const reorder = useReorder(() => scenes.value.map(s => s.id), order => updateProduction(props.production, { sceneOrder: order }))

    const startNew = () => {
      draft.value = { number: nextSceneNumber(props.production), setting: 'INT', location: '', timeOfDay: 'DAY', synopsis: '' }
    }
    const create = () => {
      if (!draft.value) return
      createScene(props.production, { ...draft.value, number: draft.value.number.trim() || nextSceneNumber(props.production) })
      draft.value = null
    }
    const rename = (event: Event) => updateProduction(props.production, { title: (event.target as HTMLInputElement).value.trim() || 'Untitled production' })
    const remove = () => {
      const n = scenes.value.length
      if (!window.confirm(`Delete “${props.production.title}”${n ? ` and its ${n} scene${n === 1 ? '' : 's'} with every setup and frame` : ''}? This can't be undone.`)) return
      deleteProduction(props.production)
      openSetups()
    }
    const exportFile = async () => {
      exporting.value = true
      try { download(await exportProduction(props.production), `${fileSafe(props.production.title)}.previs.json`) } finally { exporting.value = false }
    }
    const counts = (s: Scene) => {
      const setupsCount = setups.captures.filter(c => c.sceneId === s.id && c.kind === 'setup').length
      const frames = setups.captures.filter(c => c.sceneId === s.id && c.kind === 'frame').length
      return `${setupsCount} setup${setupsCount === 1 ? '' : 's'} · ${frames} frame${frames === 1 ? '' : 's'}`
    }
    return { scenes, draft, exporting, reorder, startNew, create, rename, remove, exportFile, counts, slugLine, openSetups }
  }
})
</script>

<style scoped>
.title { font-size: 20px; font-weight: 600; background: transparent; border-color: transparent; padding: 4px 6px; margin-left: -6px; min-width: 0; flex: 1; max-width: 520px; }
.title:hover, .title:focus { border-color: var(--line); background: #23252c; }
.new { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin-bottom: 16px; display: flex; flex-direction: column; gap: 12px; }
.scenes { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.scenes li { display: flex; align-items: center; gap: 10px; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 6px 10px; }
.scenes li.over { border-color: var(--accent); }
.scenes li.dragging { opacity: 0.4; }
.grip { color: var(--muted); cursor: grab; user-select: none; letter-spacing: -2px; }
.open { flex: 1; display: flex; flex-direction: column; align-items: flex-start; gap: 3px; text-align: left; background: transparent; border: none; padding: 6px 4px; }
.open:hover { background: transparent; }
.open:hover b { color: var(--accent); }
.open b { font-size: 14px; letter-spacing: 0.3px; }
.open span { color: var(--text); font-size: 13px; opacity: 0.85; }
.open small { color: var(--muted); }
.move { display: flex; gap: 4px; }
.move button { padding: 2px 8px; }
.move button:disabled { opacity: 0.3; cursor: default; }
</style>
