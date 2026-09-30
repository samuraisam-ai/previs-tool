<template>
  <div v-if="captureState.toast" :class="['toast', captureState.toast.state]" role="status">
    <span>{{ captureState.toast.state === 'saved' ? '✓ ' : '' }}{{ captureState.toast.text }}</span>
    <button v-if="captureState.toast.state !== 'saving'" @click="view">View</button>
    <button class="x" title="Dismiss" @click="captureState.toast = null">✕</button>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { openSetups } from '../../nav'
import { captureState } from '../capture'

export default defineComponent({
  name: 'CaptureToast',
  setup() {
    const view = () => {
      const t = captureState.toast
      if (!t) return
      openSetups(t.productionId, t.sceneId, t.tab)
      captureState.toast = null
    }
    return { captureState, view }
  }
})
</script>

<style scoped>
.toast { position: fixed; left: 50%; bottom: 44px; transform: translateX(-50%); z-index: 70; display: flex; align-items: center; gap: 10px; padding: 8px 10px 8px 14px; background: #23252c; border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45); font-size: 13px; max-width: calc(100vw - 32px); }
span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button { padding: 3px 10px; font-size: 12px; }
.error { border-color: #e5484d; }
.saving span { color: var(--muted); }
.x { border: none; background: none; color: var(--muted); padding: 3px 6px; }
</style>
