<template>
  <div :class="['card', { starred: capture.starred, archived: capture.archived }]">
    <button class="thumb" :title="`Open ${label}`" @click="$emit('open')">
      <img v-if="thumb" :src="thumb" :alt="capture.name || label" draggable="false" />
    </button>
    <div class="meta">
      <div class="line">
        <span class="num">{{ label }}</span>
        <button :class="['star', { on: capture.starred }]" :title="capture.starred ? 'Remove from selects' : 'Mark as a select'" @click="toggleStar">★</button>
      </div>
      <b>{{ capture.name || 'Untitled' }}</b>
      <p v-if="capture.description">{{ capture.description }}</p>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from 'vue'
import { imageUrl, updateCapture } from '../store'
import { Capture, captureLabel, Scene } from '../types'

export default defineComponent({
  name: 'CaptureCard',
  props: {
    capture: { type: Object as PropType<Capture>, required: true },
    scene: { type: Object as PropType<Scene>, required: true }
  },
  emits: ['open'],
  setup(props) {
    const thumb = computed(() => imageUrl(props.capture.thumbId))
    const label = computed(() => captureLabel(props.scene, props.capture))
    const toggleStar = () => updateCapture(props.capture, { starred: !props.capture.starred })
    return { thumb, label, toggleStar }
  }
})
</script>

<style scoped>
.card { background: var(--panel); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; display: flex; flex-direction: column; height: 100%; }
.card.starred { border-color: rgba(255, 181, 71, 0.6); }
.card.archived { opacity: 0.55; }
.thumb { padding: 0; border: none; border-radius: 0; aspect-ratio: 16 / 9; background: #0b0c0f; display: block; width: 100%; }
.thumb img { width: 100%; height: 100%; object-fit: contain; display: block; }
.meta { padding: 8px 10px 10px; display: flex; flex-direction: column; gap: 3px; }
.line { display: flex; align-items: center; justify-content: space-between; }
.num { font-size: 11px; letter-spacing: 0.6px; text-transform: uppercase; color: var(--muted); }
.star { border: none; background: none; padding: 0 2px; font-size: 16px; color: #4a4d56; line-height: 1; }
.star:hover { background: none; color: var(--accent); }
.star.on { color: var(--accent); }
b { font-size: 13px; font-weight: 600; }
p { margin: 0; font-size: 12px; color: var(--muted); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
</style>
