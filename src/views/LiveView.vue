<template>
  <div ref="container" class="live">
    <div v-if="!device.webgl2" class="unsupported">
      <h3>3D isn't available on this browser or computer</h3>
      <p>The Live View needs WebGL2 (any recent Chrome, Edge, Firefox or Safari with hardware acceleration on).
        The Floor Plan still works fully.</p>
    </div>
    <template v-else>
      <canvas ref="canvas"></canvas>
      <CameraMonitor
        v-if="viewId && imageRect"
        :camera-id="viewId"
        :rect="imageRect"
        :frame-capture="frameCapture"
        :active="active"
        @capture="captureFrame"
      />
      <div v-if="renderState.preparing" class="preparing">Preparing lights…</div>
      <div v-if="notice" class="notice">{{ notice }}</div>
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
        <label v-if="!viewId" title="Dollhouse view: walls cut at hip height so you can see into the rooms">
          Walls
          <select v-model="editor.cutaway">
            <option :value="true">Cutaway</option>
            <option :value="false">Full height</option>
          </select>
        </label>
        <label :title="`Detected: ${device.gpu} (${device.reason}). Colour, exposure and bokeh are identical on every level; only smoothness and shadow detail change.`">
          Performance
          <select v-model="performance">
            <option value="auto">Auto ({{ tierLabel(device.tier) }}{{ autoScaleNote }})</option>
            <option value="lite">Lite</option>
            <option value="standard">Standard</option>
            <option value="high">High</option>
          </select>
        </label>
        <span v-if="!viewId" class="hint">Drag to orbit · right-drag to pan · scroll to zoom</span>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import CameraMonitor from '../components/monitor/CameraMonitor.vue'
import { getBody } from '../library/cameras'
import { getLens } from '../library/lenses'
import { detectDevice } from '../live/deviceTier'
import { FrameCapture, LiveScene } from '../live/LiveScene'
import { renderState, TierId, TIERS } from '../live/renderState'
import { editor } from '../plan/editor'
import { requestCapture } from '../setups/capture'
import { captureFrame as captureFrameRequest } from '../setups/captureFrame'
import { initSetups } from '../setups/store'
import { scene } from '../scene/store'
import { CameraItem } from '../scene/types'

type PerformanceSetting = 'auto' | TierId

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
    const device = detectDevice()
    // Kept outside Vue reactivity: Babylon objects must not be wrapped in proxies.
    let live: LiveScene | null = null
    let resizeObserver: ResizeObserver | null = null

    // ── Performance level ─────────────────────────────────────────────────
    // Per-viewer preference; storage can be unavailable (private mode), so fall back quietly.
    const readSetting = (): PerformanceSetting => {
      try {
        const v = localStorage.getItem('previs.performance')
        return v === 'lite' || v === 'standard' || v === 'high' ? v : 'auto'
      } catch { return 'auto' }
    }
    const performance = ref<PerformanceSetting>(readSetting())
    const tierId = computed<TierId>(() => (performance.value === 'auto' ? device.tier : performance.value))
    // Auto also adapts render resolution to the measured frame rate.
    const AUTO_STEPS = [1, 1.25, 1.5, 2]
    const autoScale = ref(TIERS[device.tier].renderScale)
    const autoScaleNote = computed(() => (performance.value === 'auto' && autoScale.value !== TIERS[device.tier].renderScale ? `, ${autoScale.value}×` : ''))
    const tierLabel = (id: TierId) => TIERS[id].label
    const applyPerformance = () => {
      if (!live) return
      live.setTier(TIERS[tierId.value])
      live.setQuality(performance.value === 'auto' ? autoScale.value : TIERS[tierId.value].renderScale)
    }
    watch(performance, value => {
      autoScale.value = TIERS[tierId.value].renderScale
      applyPerformance()
      try { localStorage.setItem('previs.performance', value) } catch { /* ignore */ }
    })
    let slow = 0
    let fast = 0
    const autoTimer = window.setInterval(() => {
      // Only judge while the view is on screen and actually rendering continuously (camera moving).
      if (!live || performance.value !== 'auto' || !props.active || document.visibilityState !== 'visible') return
      const fps = live.getFps()
      if (!live.isAnimating()) return
      const i = AUTO_STEPS.indexOf(autoScale.value)
      slow = fps < 28 ? slow + 1 : 0
      fast = fps > 55 ? fast + 1 : 0
      if (slow >= 2 && i > 0) { autoScale.value = AUTO_STEPS[i - 1]; slow = 0; applyPerformance() }
      if (fast >= 6 && i < AUTO_STEPS.length - 1) { autoScale.value = AUTO_STEPS[i + 1]; fast = 0; applyPerformance() }
    }, 1000)

    const cameras = computed(() => scene.items.filter((item): item is CameraItem => item.kind === 'camera'))
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

    // ── Syncing the 3D scene ──────────────────────────────────────────────
    // Edits are batched to at most one sync per frame, and paused entirely while the Live View
    // isn't showing (the Floor Plan then costs no 3D work at all); it catches up when shown.
    let syncQueued = false
    let pendingSync = true
    let archDirty = true
    const visible = () => props.active && document.visibilityState === 'visible'
    const runSync = () => {
      if (!live) return
      live.sync(scene, archDirty)
      archDirty = false
      pendingSync = false
    }
    const scheduleSync = () => {
      pendingSync = true
      if (syncQueued || !visible()) return
      syncQueued = true
      requestAnimationFrame(() => { syncQueued = false; if (visible()) runSync() })
    }
    watch(() => [scene.walls, scene.openings, scene.rooms], () => { archDirty = true }, { deep: true, flush: 'sync' })
    watch(scene, scheduleSync, { deep: true })
    const updateActive = () => {
      const on = visible()
      live?.setActive(on)
      if (on && pendingSync) runSync()
    }
    watch(() => props.active, updateActive)
    document.addEventListener('visibilitychange', updateActive)

    onMounted(() => {
      if (!device.webgl2) return
      live = new LiveScene(canvas.value as HTMLCanvasElement)
      applyPerformance()
      live.setCutaway(editor.cutaway)
      runSync()
      updateActive()
      // Dev-only handles for inspecting and benchmarking from the console.
      if (process.env.NODE_ENV !== 'production') {
        Promise.all([import('../live/calibration'), import('../live/benchmark'), import('../setups/store'), import('../plan/history')]).then(([calibration, bench, setupsStore, history]) =>
          Object.assign(window, { previs: live, previsScene: scene, previsEditor: editor, previsCalibration: calibration, previsBench: bench, previsDevice: device, previsSetups: setupsStore, previsHistory: history }))
      }
      resizeObserver = new ResizeObserver(layout)
      resizeObserver.observe(container.value as HTMLDivElement)
      layout()
    })

    watch(() => editor.cutaway, on => live?.setCutaway(on))
    watch(viewId, id => {
      live?.viewThrough(id)
      layout()
      // Exposure/WB follow the camera being looked through.
      runSync()
      if (id) scene.activeCameraId = id
    })
    watch(cameras, list => {
      if (viewId.value && !list.some(cam => cam.id === viewId.value)) viewId.value = null
    })

    // ── Storyboard frames ─────────────────────────────────────────────────
    const notice = ref('')
    let noticeTimer: number | undefined
    const flash = (text: string) => {
      notice.value = text
      window.clearTimeout(noticeTimer)
      noticeTimer = window.setTimeout(() => { notice.value = '' }, 3500)
    }
    let capturing = false
    const captureFrame = async () => {
      const cam = viewing.value
      if (!live || !cam) { flash('Choose a camera in View to capture a storyboard frame.'); return }
      if (capturing) return
      capturing = true
      try {
        await initSetups()
        requestCapture(await captureFrameRequest(live, cam))
      } catch (e) {
        flash(e instanceof Error ? e.message : 'Could not capture the frame.')
      } finally {
        capturing = false
      }
    }
    const onKey = (event: KeyboardEvent) => {
      if (!props.active || event.metaKey || event.ctrlKey || event.altKey) return
      if (document.querySelector('[aria-modal="true"]')) return
      const target = event.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'c' || event.key === 'C') { captureFrame(); event.preventDefault() }
    }
    window.addEventListener('keydown', onKey)

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(noticeTimer)
      window.clearInterval(autoTimer)
      document.removeEventListener('visibilitychange', updateActive)
      resizeObserver?.disconnect()
      live?.dispose()
    })

    const lensLabel = (cam: CameraItem) => `${getLens(cam.props.lensId).focalLength}mm`

    return {
      container, canvas, viewId, imageRect, frameCapture, cameras, scene, lensLabel, editor, device,
      performance, tierLabel, autoScaleNote, renderState, notice, captureFrame
    }
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
.preparing {
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 3;
  font-size: 12px;
  padding: 5px 10px;
  border-radius: 12px;
  background: rgba(20, 20, 24, 0.85);
  color: var(--accent);
}
.notice {
  position: absolute;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  z-index: 3;
  font-size: 13px;
  padding: 7px 14px;
  border-radius: 8px;
  background: rgba(20, 20, 24, 0.9);
  border: 1px solid var(--line);
}
.unsupported {
  max-width: 460px;
  margin: 15vh auto 0;
  padding: 0 16px;
  color: var(--text);
  text-align: center;
}
.unsupported p { color: var(--muted); line-height: 1.5; }
</style>
