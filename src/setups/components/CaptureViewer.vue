<template>
  <div class="backdrop" @click.self="$emit('close')" @keydown="onKey">
    <div ref="dialog" class="viewer" role="dialog" aria-modal="true" :aria-label="label" tabindex="-1">
      <div class="image">
        <img v-if="image" :src="image" :alt="capture.name || label" />
        <button class="nav prev" :disabled="!hasPrev" title="Previous (←)" @click="$emit('step', -1)">‹</button>
        <button class="nav next" :disabled="!hasNext" title="Next (→)" @click="$emit('step', 1)">›</button>
      </div>
      <div class="side">
        <div class="top">
          <span class="num">{{ label }}</span>
          <button class="close" title="Close (Esc)" @click="$emit('close')">✕</button>
        </div>
        <label>Number <input :value="capture.number" class="short" @change="set('number', $event)" /></label>
        <label>Name <input :value="capture.name" @change="set('name', $event)" /></label>
        <label>Description <textarea :value="capture.description" rows="4" @change="set('description', $event)"></textarea></label>
        <div v-if="capture.shot" class="shot">
          <span>{{ capture.shot.size }}<template v-if="capture.shot.movement"> · {{ capture.shot.movement }}</template></span>
          <small>{{ cameraLine }}</small>
        </div>
        <small class="date">Captured {{ new Date(capture.createdAt).toLocaleString() }}</small>
        <div class="buttons">
          <button class="primary" title="Replace the current Floor Plan scene with this setup (undoable)" @click="openInPlan">Open in Floor Plan</button>
          <button :class="{ on: capture.starred }" @click="update({ starred: !capture.starred })">★ {{ capture.starred ? 'Select' : 'Mark as select' }}</button>
          <button @click="update({ archived: !capture.archived })">{{ capture.archived ? 'Unarchive' : 'Archive' }}</button>
          <button class="danger" @click="remove">Delete</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, PropType, ref } from 'vue'
import { nav } from '../../nav'
import { loadScene } from '../../plan/history'
import { deleteCapture, imageUrl, updateCapture } from '../store'
import { Capture, captureLabel, Scene } from '../types'

export default defineComponent({
  name: 'CaptureViewer',
  props: {
    capture: { type: Object as PropType<Capture>, required: true },
    scene: { type: Object as PropType<Scene>, required: true },
    hasPrev: { type: Boolean, default: false },
    hasNext: { type: Boolean, default: false }
  },
  emits: ['close', 'step'],
  setup(props, { emit }) {
    const dialog = ref<HTMLDivElement | null>(null)
    const image = computed(() => imageUrl(props.capture.imageId))
    const label = computed(() => captureLabel(props.scene, props.capture))
    const cameraLine = computed(() => {
      const c = props.capture.shot?.camera
      return c ? `${c.name} · ${c.lensMm}mm · T${c.tStop} · ISO ${c.iso} · ${c.shutter} · ${c.wbK}K` : ''
    })
    const update = (patch: Partial<Capture>) => updateCapture(props.capture, patch)
    const set = (key: 'number' | 'name' | 'description', event: Event) =>
      update({ [key]: (event.target as HTMLInputElement).value.trim() })
    const openInPlan = () => {
      loadScene(props.capture.sceneJson)
      nav.view = 'plan'
    }
    const remove = () => {
      if (!window.confirm(`Delete ${label.value}${props.capture.name ? ` “${props.capture.name}”` : ''}? This can't be undone.`)) return
      deleteCapture(props.capture)
      emit('close')
    }
    // Arrow keys page through captures, except while typing in a field.
    const onKey = (event: KeyboardEvent) => {
      const typing = (event.target as HTMLElement).closest('input, textarea')
      if (event.key === 'Escape') emit('close')
      else if (!typing && event.key === 'ArrowLeft' && props.hasPrev) emit('step', -1)
      else if (!typing && event.key === 'ArrowRight' && props.hasNext) emit('step', 1)
    }
    onMounted(() => dialog.value?.focus())
    return { dialog, onKey, image, label, cameraLine, update, set, openInPlan, remove }
  }
})
</script>

<style scoped>
.backdrop { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.72); z-index: 50; display: flex; align-items: center; justify-content: center; padding: 24px; }
.viewer { display: flex; width: min(1280px, 100%); max-height: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; outline: none; }
.image { flex: 1; min-width: 0; background: #0b0c0f; position: relative; display: flex; align-items: center; justify-content: center; }
.image img { max-width: 100%; max-height: calc(100vh - 48px); display: block; }
.nav { position: absolute; top: 50%; transform: translateY(-50%); font-size: 26px; line-height: 1; padding: 6px 12px; background: rgba(20, 20, 24, 0.7); }
.nav:disabled { opacity: 0.2; cursor: default; }
.prev { left: 10px; }
.next { right: 10px; }
.side { width: 300px; flex-shrink: 0; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
.top { display: flex; justify-content: space-between; align-items: center; }
.num { font-size: 12px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--accent); }
.close { border: none; background: none; padding: 2px 6px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
input, textarea { color: var(--text); font-size: 13px; }
.short { width: 80px; }
textarea { resize: vertical; }
.shot { display: flex; flex-direction: column; gap: 2px; font-size: 13px; }
.shot small, .date { color: var(--muted); font-size: 12px; }
.buttons { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
.buttons button.on { color: var(--accent); border-color: rgba(255, 181, 71, 0.5); }
button.primary { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
button.danger:hover { border-color: #e5484d; color: #ff7b7f; }
@media (max-width: 760px) {
  .viewer { flex-direction: column; overflow-y: auto; }
  .side { width: auto; }
}
</style>
