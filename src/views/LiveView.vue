<template>
  <div ref="container" class="live">
    <canvas ref="canvas"></canvas>
    <CameraMonitor
      v-if="viewId && imageRect"
      :camera-id="viewId"
      :rect="imageRect"
      :frame-capture="frameCapture"
      :active="active"
    />
    <div class="overlay">
      <label>
        View
        <select v-model="viewId">
          <option :value="null">Free orbit</option>
          <option v-for="cam in cameras" :key="cam.id" :value="cam.id">{{ cam.name }} · {{ lensLabel(cam) }}</option>
        </select>
      </label>
      <label v-if="!viewId && cameras.length">
        Exposure from
        <select v-model="scene.activeCameraId">
          <option v-for="cam in cameras" :key="cam.id" :value="cam.id">{{ cam.name }}</option>
        </select>
      </label>
      <span v-if="!viewId" class="hint">Drag to orbit · right-drag to pan · scroll to zoom</span>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import CameraMonitor from '../components/monitor/CameraMonitor.vue'
import { getBody } from '../library/cameras'
import { getLens } from '../library/lenses'
import { FrameCapture, LiveScene } from '../live/LiveScene'
import { scene } from '../scene/store'
import { CameraItem } from '../scene/types'

export default defineComponent({
  name: 'LiveView',
  components: { CameraMonitor },
  props: {
    active: { type: Boolean, default: true }
  },
  setup(props) {
    const container = ref<HTMLDivElement | null>(null)
    const canvas = ref<HTMLCanvasElement | null>(null)
    const viewId = ref<string | null>(null)
    const imageRect = ref<{ x: number; y: number; width: number; height: number } | null>(null)
    const frameCapture = shallowRef<FrameCapture | null>(null)
    const cameras = computed(() => scene.items.filter((item): item is CameraItem => item.kind === 'camera'))
    // Kept outside Vue reactivity: Babylon objects must not be wrapped in proxies.
    let live: LiveScene | null = null
    let resizeObserver: ResizeObserver | null = null

    const viewing = computed(() => cameras.value.find(cam => cam.id === viewId.value))

    // Fit the camera's recording format (16:9) inside the view; the rest is letterbox.
    const layout = () => {
      const el = container.value
      if (!el) return
      const W = el.clientWidth
      const H = el.clientHeight
      const cam = viewing.value
      let rect = { x: 0, y: 0, width: W, height: H }
      if (cam) {
        const format = getBody(cam.props.bodyId).format
        const aspect = format.width / format.height
        const width = Math.min(W, H * aspect)
        const height = width / aspect
        rect = { x: (W - width) / 2, y: (H - height) / 2, width, height }
      }
      imageRect.value = cam ? rect : null
      live?.setImageRect(rect)
    }

    const wantFrames = computed(() => Boolean(props.active && viewing.value && viewing.value.props.display.osd && viewing.value.props.display.scopes.length))
    watch(wantFrames, on => live?.onFrame(on ? frame => { frameCapture.value = frame } : null))

    onMounted(() => {
      live = new LiveScene(canvas.value as HTMLCanvasElement)
      live.sync(scene)
      // Dev-only handle for inspecting the Babylon scene from the console.
      if (process.env.NODE_ENV !== 'production') Object.assign(window, { previs: live, previsScene: scene })
      resizeObserver = new ResizeObserver(layout)
      resizeObserver.observe(container.value as HTMLDivElement)
      layout()
    })

    watch(scene, () => live?.sync(scene), { deep: true })
    watch(viewId, id => {
      live?.viewThrough(id)
      layout()
      // Exposure/WB follow the camera being looked through.
      live?.sync(scene)
      if (id) scene.activeCameraId = id
    })
    watch(cameras, list => {
      if (viewId.value && !list.some(cam => cam.id === viewId.value)) viewId.value = null
    })

    onBeforeUnmount(() => {
      resizeObserver?.disconnect()
      live?.dispose()
    })

    const lensLabel = (cam: CameraItem) => `${getLens(cam.props.lensId).focalLength}mm`

    return { container, canvas, viewId, imageRect, frameCapture, cameras, scene, lensLabel }
  }
})
</script>

<style scoped>
.live {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
  overflow: hidden;
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
  flex-wrap: wrap;
  gap: 8px;
  font-size: 13px;
  z-index: 2;
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
