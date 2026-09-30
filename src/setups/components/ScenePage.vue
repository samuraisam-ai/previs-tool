<template>
  <div class="page">
    <div class="head">
      <div class="heading">
        <h2>{{ slugLine(scene) }}</h2>
        <p v-if="scene.synopsis && !editing">{{ scene.synopsis }}</p>
      </div>
      <div class="actions">
        <button @click="editing = !editing">{{ editing ? 'Done' : 'Edit scene' }}</button>
        <button class="danger" @click="remove">Delete scene</button>
      </div>
    </div>
    <div v-if="editing" class="edit">
      <SceneForm :value="scene" @patch="save" />
    </div>

    <div class="bar">
      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="nav.sceneTab === 'setups'" :class="{ on: nav.sceneTab === 'setups' }" @click="nav.sceneTab = 'setups'">
          Floor plan setups <span class="count">{{ count('setup') }}</span>
        </button>
        <button role="tab" :aria-selected="nav.sceneTab === 'storyboard'" :class="{ on: nav.sceneTab === 'storyboard' }" @click="nav.sceneTab = 'storyboard'">
          Storyboard <span class="count">{{ count('frame') }}</span>
        </button>
      </div>
      <div v-if="nav.sceneTab === 'setups'" class="filters">
        <button v-for="f in FILTERS" :key="f.id" :class="{ on: filter === f.id }" @click="filter = f.id">{{ f.label }}</button>
        <label title="Renumber 1, 2, 3… whenever you reorder"><input v-model="autoNumber" type="checkbox" /> Auto-number</label>
      </div>
    </div>

    <StoryboardBoard v-if="nav.sceneTab === 'storyboard'" :scene="scene" />
    <template v-else>
    <p v-if="!shown.length" class="empty">{{ emptyText }}</p>
    <div class="grid">
      <div
        v-for="(c, i) in shown"
        :key="c.id"
        :draggable="filter === 'all'"
        :class="['cell', { over: reorder.over.value === c.id, dragging: reorder.dragging.value === c.id }]"
        @dragstart="reorder.onDragStart(c.id, $event)"
        @dragover="reorder.onDragOver(c.id, $event)"
        @drop="reorder.onDrop(c.id)"
        @dragend="reorder.onDragEnd"
      >
        <CaptureCard :capture="c" :scene="scene" @open="viewing = i" />
      </div>
    </div>

    <CaptureViewer
      v-if="viewed"
      :capture="viewed"
      :scene="scene"
      :has-prev="(viewing ?? 0) > 0"
      :has-next="(viewing ?? 0) < shown.length - 1"
      @step="viewing = (viewing ?? 0) + $event"
      @close="viewing = null"
    />
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref, watch } from 'vue'
import { nav, openSetups } from '../../nav'
import { useReorder } from '../reorder'
import { capturesOf, deleteScene, reorderCaptures, updateScene } from '../store'
import { CaptureKind, Scene, slugLine } from '../types'
import CaptureCard from './CaptureCard.vue'
import CaptureViewer from './CaptureViewer.vue'
import SceneForm from './SceneForm.vue'
import StoryboardBoard from './StoryboardBoard.vue'

type Filter = 'all' | 'selects' | 'archived'
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'selects', label: '★ Selects' },
  { id: 'archived', label: 'Archived' }
]

export default defineComponent({
  name: 'ScenePage',
  components: { SceneForm, CaptureCard, CaptureViewer, StoryboardBoard },
  props: {
    scene: { type: Object as PropType<Scene>, required: true }
  },
  setup(props) {
    const editing = ref(false)
    const filter = ref<Filter>('all')
    const autoNumber = ref(true)
    const viewing = ref<number | null>(null)

    const kind = computed<CaptureKind>(() => (nav.sceneTab === 'setups' ? 'setup' : 'frame'))
    const all = computed(() => capturesOf(props.scene, kind.value))
    const shown = computed(() => all.value.filter(c =>
      filter.value === 'archived' ? c.archived : !c.archived && (filter.value === 'all' || c.starred)))
    const viewed = computed(() => (viewing.value === null ? null : shown.value[viewing.value] ?? null))
    watch([kind, filter], () => { viewing.value = null })
    // Close the viewer if its capture disappears (deleted/archived out of the filter).
    watch(() => shown.value.length, n => { if (viewing.value !== null && viewing.value >= n) viewing.value = n ? n - 1 : null })

    // Reordering works on the full list (archived ones keep their place).
    const reorder = useReorder(() => all.value.map(c => c.id), order => reorderCaptures(props.scene, kind.value, order, autoNumber.value))

    const count = (k: CaptureKind) => capturesOf(props.scene, k).filter(c => !c.archived).length
    const emptyText = computed(() => {
      if (filter.value === 'selects') return 'No selects yet — star (★) the setups you want to go with.'
      if (filter.value === 'archived') return 'Nothing archived.'
      return kind.value === 'setup'
        ? 'No floor plan setups yet. On the Floor Plan, press the camera button (or C) to capture the current setup into this scene.'
        : 'No storyboard frames yet. In the Live View, look through a camera and press Capture frame (or C).'
    })
    const save = (patch: Partial<Scene>) => updateScene(props.scene, patch)
    const remove = () => {
      const n = all.value.length + capturesOf(props.scene, kind.value === 'setup' ? 'frame' : 'setup').length
      if (!window.confirm(`Delete scene ${props.scene.number}${n ? ` and its ${n} capture${n === 1 ? '' : 's'}` : ''}? This can't be undone.`)) return
      const productionId = props.scene.productionId
      deleteScene(props.scene)
      openSetups(productionId)
    }
    return { nav, editing, filter, FILTERS, autoNumber, viewing, viewed, shown, reorder, count, emptyText, save, remove, slugLine }
  }
})
</script>

<style scoped>
.heading { min-width: 0; }
.heading h2 { letter-spacing: 0.3px; }
.heading p { margin: 6px 0 0; color: var(--muted); max-width: 720px; line-height: 1.45; }
.edit { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 14px; margin-bottom: 16px; }
.bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; border-bottom: 1px solid var(--line); margin-bottom: 16px; }
.tabs { display: flex; gap: 2px; }
.tabs button { border: none; border-bottom: 2px solid transparent; border-radius: 0; background: none; padding: 10px 12px; color: var(--muted); }
.tabs button.on { color: var(--text); border-bottom-color: var(--accent); }
.count { font-size: 11px; background: #2c2f37; border-radius: 9px; padding: 1px 7px; margin-left: 4px; color: var(--muted); }
.filters { display: flex; align-items: center; gap: 4px; padding-bottom: 6px; font-size: 13px; }
.filters button { padding: 3px 10px; font-size: 12px; border-radius: 14px; }
.filters button.on { border-color: var(--accent); color: var(--accent); }
.filters label { display: flex; align-items: center; gap: 5px; color: var(--muted); font-size: 12px; margin-left: 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; }
.cell { border-radius: 10px; }
.cell[draggable='true'] { cursor: grab; }
.cell.over { outline: 2px solid var(--accent); outline-offset: 2px; }
.cell.dragging { opacity: 0.4; }
</style>
