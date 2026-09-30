<template>
  <div class="live">
    <canvas ref="canvas"></canvas>
    <div class="overlay">
      <label>
        View
        <select v-model="viewId">
          <option :value="null">Free orbit</option>
          <option v-for="cam in cameras" :key="cam.id" :value="cam.id">{{ cam.name }} · {{ cam.props.focalLength }}mm</option>
        </select>
      </label>
      <span class="hint">{{ viewId ? 'Locked to camera — move it in the Floor Plan' : 'Drag to orbit · right-drag to pan · scroll to zoom' }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { LiveScene } from '../live/LiveScene'
import { scene } from '../scene/store'
import { CameraItem } from '../scene/types'

export default defineComponent({
  name: 'LiveView',
  setup() {
    const canvas = ref<HTMLCanvasElement | null>(null)
    const viewId = ref<string | null>(null)
    const cameras = computed(() => scene.items.filter((item): item is CameraItem => item.kind === 'camera'))
    // Kept outside Vue reactivity: Babylon objects must not be wrapped in proxies.
    let live: LiveScene | null = null

    onMounted(() => {
      live = new LiveScene(canvas.value as HTMLCanvasElement)
      live.sync(scene)
    })

    watch(scene, () => live?.sync(scene), { deep: true })
    watch(viewId, id => live?.viewThrough(id))
    watch(cameras, list => {
      if (viewId.value && !list.some(cam => cam.id === viewId.value)) viewId.value = null
    })

    onBeforeUnmount(() => live?.dispose())

    return { canvas, viewId, cameras }
  }
})
</script>

<style scoped>
.live {
  position: relative;
  width: 100%;
  height: 100%;
}
canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
  touch-action: none;
}
.overlay {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
}
.overlay label {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(20, 20, 24, 0.85);
  padding: 6px 10px;
  border-radius: 6px;
}
.hint {
  color: var(--muted);
}
</style>
