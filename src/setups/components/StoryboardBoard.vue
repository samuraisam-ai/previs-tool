<template>
  <div class="board-wrap">
    <!-- Frame strip -->
    <aside
      :class="['strip', { target: drag && drag.from === 'panel' }]"
      @dragover="onStripOver"
      @drop="onStripDrop"
    >
      <div class="strip-head">
        <b>Frames <span class="count">{{ frames.length }}</span></b>
        <div class="chips">
          <button v-for="f in FILTERS" :key="f.id" :class="{ on: filter === f.id }" :title="f.title" @click="filter = f.id">{{ f.label }}</button>
        </div>
      </div>
      <p v-if="!frames.length" class="hint">
        {{ filter === 'all' ? 'No frames yet. In the Live View, look through a camera and press ◉ FRAME (or C).' : 'Nothing here.' }}
      </p>
      <p v-else-if="picked" class="hint pick">Click a panel to place it · Esc to cancel</p>
      <p v-else class="hint">Drag frames onto the board. Double-click to open.</p>
      <ol class="frames">
        <li
          v-for="(c, i) in frames"
          :key="c.id"
          draggable="true"
          :class="{ picked: picked === c.id, placed: placed.has(c.id), dragging: drag && drag.id === c.id && drag.from === 'strip' }"
          :title="`${label(c)}${c.name ? ' — ' + c.name : ''}`"
          @dragstart="startDrag($event, { from: 'strip', id: c.id })"
          @dragend="drag = null"
          @click="picked = picked === c.id ? null : c.id"
          @dblclick="viewing = i"
        >
          <img v-if="thumb(c)" :src="thumb(c)" alt="" draggable="false" />
          <div class="frame-meta">
            <span>{{ shortLabel(c) }}<template v-if="c.shot"> · {{ c.shot.size }}</template></span>
            <span v-if="placed.has(c.id)" class="tick" title="On the board">✓</span>
            <span v-if="c.starred" class="star">★</span>
          </div>
          <small v-if="c.name">{{ c.name }}</small>
        </li>
      </ol>
    </aside>

    <!-- Pages -->
    <div class="pages">
      <div class="pages-head">
        <span class="muted">{{ usedPages }} page{{ usedPages === 1 ? '' : 's' }} · {{ placedCount }} of {{ allFrames.length }} frames placed</span>
        <div class="actions">
          <button :disabled="!unplaced.length" title="Fill empty panels with unplaced frames, in strip order" @click="autoFill">Auto-fill in order</button>
          <button :disabled="!placedCount" title="Remove every frame from the board (frames are kept)" @click="clearBoard">Clear board</button>
          <button class="primary" :disabled="!placedCount" @click="print">Print / PDF</button>
        </div>
      </div>

      <section v-for="(page, p) in pages" :key="p" class="sheet">
        <header>
          <span>{{ productionTitle }}</span>
          <b>{{ slugLine(scene) }}</b>
          <span v-if="p < usedPages || placedCount === 0">Page {{ p + 1 }} / {{ usedPages }}</span>
          <span v-else>Next page — drop frames to continue</span>
        </header>
        <div class="grid">
          <div v-for="(id, k) in page" :key="p * 6 + k" class="panel">
            <div
              :class="['shot', { empty: !id, over: overSlot === p * 6 + k, pickable: picked }]"
              @dragover="onPanelOver($event, p * 6 + k)"
              @dragleave="overSlot = null"
              @drop="onPanelDrop($event, p * 6 + k)"
              @click="onPanelClick(p * 6 + k)"
            >
              <span class="index">{{ p * 6 + k + 1 }}</span>
              <template v-if="id && byId(id)">
                <img
                  :src="thumbFull(byId(id))"
                  alt=""
                  draggable="true"
                  @dragstart="startDrag($event, { from: 'panel', id, slot: p * 6 + k })"
                  @dragend="drag = null"
                />
                <button class="clear" title="Remove from board" @click.stop="setSlot(p * 6 + k, null)">✕</button>
              </template>
              <span v-else class="drop">{{ picked ? 'Click to place' : 'Drop a frame' }}</span>
            </div>
            <div v-if="id && byId(id)" class="caption">
              <div class="line">
                <b>{{ shortLabel(byId(id)) }}</b>
                <select v-if="byId(id).shot" :value="byId(id).shot.size" aria-label="Shot size" @change="patchShot(id, { size: value($event) })">
                  <option v-for="s in SHOT_SIZES" :key="s" :value="s">{{ s }}</option>
                </select>
                <input v-if="byId(id).shot" :value="byId(id).shot.movement" placeholder="Movement" aria-label="Movement" @change="patchShot(id, { movement: value($event) })" />
              </div>
              <textarea
                v-if="byId(id).shot"
                :value="byId(id).shot.action"
                rows="2"
                placeholder="Action"
                aria-label="Action"
                @change="patchShot(id, { action: value($event) })"
              ></textarea>
              <textarea
                v-if="byId(id).shot"
                class="dialogue"
                :value="byId(id).shot.dialogue"
                rows="1"
                placeholder="Dialogue"
                aria-label="Dialogue"
                @change="patchShot(id, { dialogue: value($event) })"
              ></textarea>
              <small v-if="byId(id).shot">{{ cameraLine(byId(id)) }}</small>
            </div>
            <div v-else class="caption blank"></div>
          </div>
        </div>
      </section>
    </div>

    <CaptureViewer
      v-if="viewed"
      :capture="viewed"
      :scene="scene"
      :has-prev="(viewing ?? 0) > 0"
      :has-next="(viewing ?? 0) < frames.length - 1"
      @step="viewing = (viewing ?? 0) + $event"
      @close="viewing = null"
    />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, PropType, ref, watch } from 'vue'
import { capturesOf, getProduction, imageUrl, PANELS_PER_PAGE, setBoard, updateCapture } from '../store'
import { Capture, captureLabel, Scene, Shot, SHOT_SIZES, slugLine } from '../types'
import CaptureViewer from './CaptureViewer.vue'
import { printStoryboard } from './printStoryboard'

type Filter = 'all' | 'selects' | 'archived'
const FILTERS: Array<{ id: Filter; label: string; title: string }> = [
  { id: 'all', label: 'All', title: 'All frames' },
  { id: 'selects', label: '★', title: 'Selects only' },
  { id: 'archived', label: 'Archived', title: 'Archived frames' }
]
interface DragInfo { from: 'strip' | 'panel'; id: string; slot?: number }
const MIME = 'application/x-previs-frame'

export default defineComponent({
  name: 'StoryboardBoard',
  components: { CaptureViewer },
  props: {
    scene: { type: Object as PropType<Scene>, required: true }
  },
  setup(props) {
    const filter = ref<Filter>('all')
    const picked = ref<string | null>(null)
    const drag = ref<DragInfo | null>(null)
    const overSlot = ref<number | null>(null)
    const viewing = ref<number | null>(null)

    const allFrames = computed(() => capturesOf(props.scene, 'frame').filter(c => !c.archived))
    const frames = computed(() => capturesOf(props.scene, 'frame').filter(c =>
      filter.value === 'archived' ? c.archived : !c.archived && (filter.value === 'all' || c.starred)))
    const viewed = computed(() => (viewing.value === null ? null : frames.value[viewing.value] ?? null))
    watch(filter, () => { viewing.value = null })

    const slots = computed(() => props.scene.boardSlots)
    const pages = computed(() => {
      const out: Array<Array<string | null>> = []
      for (let i = 0; i < slots.value.length; i += PANELS_PER_PAGE) out.push(slots.value.slice(i, i + PANELS_PER_PAGE))
      return out
    })
    const placed = computed(() => new Set(slots.value.filter((id): id is string => !!id)))
    const placedCount = computed(() => allFrames.value.filter(c => placed.value.has(c.id)).length)
    const unplaced = computed(() => allFrames.value.filter(c => !placed.value.has(c.id)))
    const usedPages = computed(() => Math.max(1, pages.value.length - 1))

    const byIdMap = computed(() => new Map(capturesOf(props.scene, 'frame').map(c => [c.id, c])))
    const byId = (id: string) => byIdMap.value.get(id) as Capture
    const thumb = (c: Capture) => imageUrl(c.thumbId)
    // Panels are big enough to deserve the full image once it has loaded.
    const thumbFull = (c: Capture) => imageUrl(c.imageId) ?? imageUrl(c.thumbId)
    const label = (c: Capture) => captureLabel(props.scene, c)
    const shortLabel = (c: Capture) => `Shot ${c.number}`
    const cameraLine = (c: Capture) => {
      const cam = c.shot?.camera
      return cam ? `${cam.lensMm}mm · T${cam.tStop} · ${cam.heightM.toFixed(2)} m${cam.tiltDeg ? ` · tilt ${Math.round(cam.tiltDeg)}°` : ''}` : ''
    }
    const productionTitle = computed(() => getProduction(props.scene.productionId)?.title ?? '')

    // ── Board edits ───────────────────────────────────────────────────────
    const setSlot = (index: number, id: string | null) => {
      const next = slots.value.slice()
      // A frame appears once on the board: placing it again moves it.
      if (id) next.forEach((x, i) => { if (x === id) next[i] = null })
      next[index] = id
      setBoard(props.scene, next)
    }
    const swap = (a: number, b: number) => {
      const next = slots.value.slice()
      ;[next[a], next[b]] = [next[b] ?? null, next[a] ?? null]
      setBoard(props.scene, next)
    }
    const autoFill = () => {
      const queue = unplaced.value.map(c => c.id)
      const next = slots.value.slice()
      for (let i = 0; queue.length; i++) if (!next[i]) next[i] = queue.shift() as string
      setBoard(props.scene, next)
    }
    const clearBoard = () => {
      if (window.confirm('Remove every frame from this storyboard? The frames themselves are kept.')) setBoard(props.scene, [])
    }

    // ── Drag and drop / click to place ─────────────────────────────────
    const startDrag = (event: DragEvent, info: DragInfo) => {
      drag.value = info
      picked.value = null
      event.dataTransfer?.setData(MIME, JSON.stringify(info))
      event.dataTransfer?.setData('text/plain', info.id)
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
    }
    const dragInfo = (event: DragEvent): DragInfo | null => {
      if (drag.value) return drag.value
      const raw = event.dataTransfer?.getData(MIME)
      return raw ? JSON.parse(raw) : null
    }
    const onPanelOver = (event: DragEvent, index: number) => {
      if (!drag.value) return
      event.preventDefault()
      overSlot.value = index
    }
    const onPanelDrop = (event: DragEvent, index: number) => {
      event.preventDefault()
      const info = dragInfo(event)
      overSlot.value = null
      drag.value = null
      if (!info) return
      if (info.from === 'panel' && info.slot !== undefined) swap(info.slot, index)
      else setSlot(index, info.id)
    }
    const onStripOver = (event: DragEvent) => { if (drag.value?.from === 'panel') event.preventDefault() }
    const onStripDrop = (event: DragEvent) => {
      event.preventDefault()
      const info = dragInfo(event)
      drag.value = null
      if (info?.from === 'panel' && info.slot !== undefined) setSlot(info.slot, null)
    }
    const onPanelClick = (index: number) => {
      if (!picked.value) return
      setSlot(index, picked.value)
      picked.value = null
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape' && picked.value) picked.value = null }
    onMounted(() => window.addEventListener('keydown', onKey))
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

    // ── Captions ──────────────────────────────────────────────────────────
    const value = (event: Event) => (event.target as HTMLInputElement).value
    const patchShot = (id: string, patch: Partial<Shot>) => {
      const c = byId(id)
      if (c?.shot) updateCapture(c, { shot: { ...c.shot, ...patch } as Shot })
    }

    const print = () => printStoryboard(props.scene, productionTitle.value, pages.value.slice(0, usedPages.value), byId)

    return {
      FILTERS, SHOT_SIZES, filter, picked, drag, overSlot, viewing, viewed, frames, allFrames, pages, placed, placedCount, unplaced, usedPages,
      byId, thumb, thumbFull, label, shortLabel, cameraLine, productionTitle, slugLine, setSlot, autoFill, clearBoard,
      startDrag, onPanelOver, onPanelDrop, onStripOver, onStripDrop, onPanelClick, value, patchShot, print
    }
  }
})
</script>

<style scoped>
.board-wrap { display: flex; gap: 18px; align-items: flex-start; }
.strip { width: 170px; flex-shrink: 0; position: sticky; top: 52px; max-height: calc(100vh - 120px); display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.strip.target { border-color: var(--accent); }
.strip-head { padding: 10px 10px 6px; display: flex; flex-direction: column; gap: 6px; border-bottom: 1px solid var(--line); }
.strip-head b { font-size: 13px; }
.count { font-size: 11px; background: #2c2f37; border-radius: 9px; padding: 1px 7px; margin-left: 4px; color: var(--muted); font-weight: 400; }
.chips { display: flex; gap: 3px; }
.chips button { padding: 1px 7px; font-size: 11px; border-radius: 10px; }
.chips button.on { border-color: var(--accent); color: var(--accent); }
.hint { margin: 8px 10px 0; font-size: 11px; color: var(--muted); line-height: 1.4; }
.hint.pick { color: var(--accent); }
.frames { list-style: none; margin: 0; padding: 8px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
.frames li { cursor: grab; border: 1px solid transparent; border-radius: 6px; padding: 3px; }
.frames li:hover { border-color: var(--line); }
.frames li.picked { border-color: var(--accent); background: rgba(255, 181, 71, 0.08); }
.frames li.dragging { opacity: 0.4; }
.frames li.placed img { opacity: 0.55; }
.frames img { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; border-radius: 4px; background: #0b0c0f; }
.frame-meta { display: flex; align-items: center; gap: 5px; font-size: 11px; margin-top: 4px; }
.frame-meta span:first-child { flex: 1; color: var(--text); }
.tick { color: #4cc38a; }
.star { color: var(--accent); }
.frames small { display: block; font-size: 11px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.pages { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 18px; }
.pages-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; }
.muted { color: var(--muted); font-size: 13px; }
.actions { display: flex; gap: 6px; flex-wrap: wrap; }
.actions button:disabled { opacity: 0.4; cursor: default; }
button.primary { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.sheet { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px 14px; }
.sheet header { display: flex; align-items: baseline; gap: 12px; font-size: 12px; color: var(--muted); margin-bottom: 10px; }
.sheet header b { flex: 1; color: var(--text); font-size: 13px; letter-spacing: 0.3px; }
.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
@media (max-width: 980px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.panel { display: flex; flex-direction: column; min-width: 0; }
.shot { position: relative; aspect-ratio: 16 / 9; background: #0b0c0f; border: 1px solid #33363e; border-radius: 4px; overflow: hidden; }
.shot.empty { border-style: dashed; display: flex; align-items: center; justify-content: center; }
.shot.pickable { cursor: pointer; }
.shot.pickable:hover, .shot.over { border-color: var(--accent); border-style: solid; box-shadow: inset 0 0 0 1px var(--accent); }
.shot img { width: 100%; height: 100%; object-fit: cover; display: block; cursor: grab; }
.index { position: absolute; top: 4px; left: 5px; font-size: 10px; padding: 0 5px; border-radius: 3px; background: rgba(0, 0, 0, 0.55); color: #d0d2d8; pointer-events: none; }
.drop { font-size: 12px; color: #4a4d56; pointer-events: none; }
.clear { position: absolute; top: 4px; right: 4px; padding: 0 6px; font-size: 11px; background: rgba(0, 0, 0, 0.6); border-color: transparent; opacity: 0; }
.shot:hover .clear { opacity: 1; }
.caption { display: flex; flex-direction: column; gap: 4px; padding-top: 6px; min-height: 96px; }
.caption .line { display: flex; align-items: center; gap: 6px; }
.caption .line b { font-size: 12px; white-space: nowrap; }
.caption select { padding: 1px 4px; font-size: 11px; }
.caption input { flex: 1; min-width: 0; padding: 2px 6px; font-size: 12px; }
.caption textarea { resize: vertical; padding: 3px 6px; font-size: 12px; line-height: 1.35; }
.caption .dialogue { font-style: italic; }
.caption small { color: var(--muted); font-size: 11px; }
input, select, textarea { color: var(--text); background: #1d1f25; border-color: #2a2c33; }
input:focus, textarea:focus, select:focus { border-color: #4a4d56; outline: none; }
</style>
