<template>
  <div v-if="cam" class="monitor" :style="rectStyle" @wheel="onImageWheel">
    <!-- On-image assists: frame lines, grid, centre, safety. Frame lines stay even with DISP off. -->
    <svg class="assist" :viewBox="`0 0 ${rect.width} ${rect.height}`" preserveAspectRatio="none">
      <template v-if="frame">
        <rect v-for="(bar, i) in frame.bars" :key="'m' + i" class="matte" :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h" />
        <rect class="frame-line" :x="frame.inner.x" :y="frame.inner.y" :width="frame.inner.w" :height="frame.inner.h" />
      </template>
      <template v-if="d.osd">
        <line v-for="(l, i) in gridLines" :key="'g' + i" class="grid" :x1="l[0]" :y1="l[1]" :x2="l[2]" :y2="l[3]" />
        <g v-if="d.centre" class="centre">
          <line :x1="rect.width / 2 - 12" :x2="rect.width / 2 + 12" :y1="rect.height / 2" :y2="rect.height / 2" />
          <line :y1="rect.height / 2 - 12" :y2="rect.height / 2 + 12" :x1="rect.width / 2" :x2="rect.width / 2" />
        </g>
        <rect v-if="d.safety" class="safety" :x="rect.width * 0.05" :y="rect.height * 0.05" :width="rect.width * 0.9" :height="rect.height * 0.9" />
      </template>
    </svg>

    <button v-if="!d.osd" class="disp-chip" title="Show viewfinder display (D)" @click="d.osd = true">DISP</button>
    <button v-if="!d.osd" class="disp-chip still-chip" title="Capture storyboard frame (C)" @click="$emit('capture')">◉ FRAME</button>

    <template v-if="d.osd">
      <!-- Status line -->
      <div class="top-bar">
        <span :class="['rec', { on: p.recording }]">{{ p.recording ? '● REC' : 'STBY' }}</span>
        <span class="tc">{{ timecode }}</span>
        <span>{{ body.format.label }} {{ rate.label }}</span>
        <span class="dim">{{ body.format.codec }}</span>
        <span class="spacer"></span>
        <span>{{ profile.label }}</span>
        <span class="dim">{{ body.brand }} {{ body.model }} · {{ lens.name }}</span>
      </div>

      <!-- Right-hand buttons -->
      <div class="side-buttons">
        <button :class="{ on: menuOpen }" @click="menuOpen = !menuOpen">MENU</button>
        <button @click="d.osd = false" title="Hide display (D)">DISP</button>
        <button :class="['rec-btn', { on: p.recording }]" @click="toggleRec">REC</button>
        <button class="still-btn" title="Capture a clean storyboard frame to a production (C)" @click="$emit('capture')">◉ FRAME</button>
      </div>

      <!-- Exposure assist legend -->
      <div v-if="d.falseColour" class="fc-legend">
        <span style="background:#800099">0</span><span style="background:#1a59ff">≤10</span><span style="background:#33d933">18%</span>
        <span style="background:#ff8cb3">skin</span><span style="background:#ffe600;color:#000">≥92</span><span style="background:#f00">clip</span>
      </div>

      <ScopeDock v-if="d.scopes.length" class="scopes" :frame="frameCapture" :scopes="d.scopes" />

      <!-- Control popup for the selected parameter -->
      <div v-if="selected" class="control-pop" @wheel.stop>
        <template v-if="selected === 'nd'">
          <RingDial v-model="p.nd.stops" :min="2" :max="8" :step="1 / 3" :sweep="270" label="VARIABLE ND" :display="`${p.nd.stops.toFixed(1)} st`" />
          <div class="pop-side">
            <button :class="{ on: p.nd.fitted }" @click="p.nd.fitted = !p.nd.fitted">{{ p.nd.fitted ? 'ND fitted' : 'Fit ND' }}</button>
            <div class="hint">Density {{ (p.nd.stops * 0.3).toFixed(1) }} · 1/{{ Math.round(Math.pow(2, p.nd.stops)) }} light</div>
          </div>
        </template>
        <template v-else-if="selected === 'pol'">
          <RingDial v-model="p.polarizer.angle" :min="0" :max="180" :step="1" :sweep="180" label="POLARIZER" :display="`${Math.round(p.polarizer.angle)}°`" />
          <div class="pop-side">
            <button :class="{ on: p.polarizer.fitted }" @click="p.polarizer.fitted = !p.polarizer.fitted">{{ p.polarizer.fitted ? 'CPL fitted' : 'Fit polarizer' }}</button>
            <div class="hint">Turn to cut reflections · costs 1.5 stops</div>
          </div>
        </template>
        <template v-else-if="selected === 'focus'">
          <RingDial :model-value="focusM" :min="lens.closeFocus" :max="30" :log="true" :sweep="300" label="FOCUS" :display="formatDistance(focusM)" @update:model-value="setManualFocus" />
          <div class="pop-side">
            <button :class="{ on: p.focus.mode === 'manual' }" @click="setManualFocus(focusM)">MF</button>
            <button v-for="s in subjects" :key="s.id" :class="{ on: p.focus.mode === 'subject' && p.focus.subjectId === s.id }" @click="track(s.id)">AF · {{ s.name }}</button>
            <div class="hint">DOF {{ formatDistance(dof.near) }} – {{ formatDistance(dof.far) }}</div>
          </div>
        </template>
        <template v-else-if="selected === 'tilt'">
          <TiltWheel v-model="p.tilt" icon="camera" label="Camera tilt" />
        </template>
        <template v-else>
          <div class="scrollers">
            <div v-if="selected === 'shutter'" class="modes">
              <button :class="{ on: p.shutterMode === 'angle' }" @click="setShutterMode('angle')">ANGLE</button>
              <button :class="{ on: p.shutterMode === 'speed' }" @click="setShutterMode('speed')">SPEED</button>
            </div>
            <div class="scroller" tabindex="0" @pointerdown="dragStart($event, selected)" @pointermove="dragMove" @pointerup="dragEnd" @wheel.prevent="e => stepParam(selected, Math.sign(e.deltaY), e.shiftKey)">
              <span v-for="(v, i) in neighbours(selected)" :key="i" :class="{ current: i === 3 }">{{ v }}</span>
            </div>
            <div v-if="selected === 'wb'" class="scroller" @pointerdown="dragStart($event, 'tint')" @pointermove="dragMove" @pointerup="dragEnd" @wheel.prevent="e => stepParam('tint', Math.sign(e.deltaY), e.shiftKey)">
              <span v-for="(v, i) in neighbours('tint')" :key="i" :class="{ current: i === 3 }">{{ v }}</span>
            </div>
            <div class="hint">Drag, scroll or ←/→ · Shift for fine/coarse</div>
          </div>
        </template>
      </div>

      <!-- Parameter bar -->
      <div class="bottom-bar">
        <button v-for="cell in cells" :key="cell.id" :class="['cell', { selected: selected === cell.id, off: cell.off }]" @click="select(cell.id)">
          <small>{{ cell.label }}</small>
          <span>{{ cell.value }}</span>
          <i v-if="cell.tag" class="tag">{{ cell.tag }}</i>
        </button>
        <div v-if="d.mm" class="cell mm" :class="mmClass">
          <small>M.M.</small>
          <span>{{ mmText }}</span>
          <div class="mm-scale"><i :style="{ left: `${50 + Math.max(-2, Math.min(2, mm)) * 25}%` }"></i></div>
        </div>
      </div>

      <!-- MENU -->
      <div v-if="menuOpen" class="menu" @wheel.stop>
        <h5>Shooting</h5>
        <label>Picture profile
          <select v-model="p.profile" @change="clampIso"><option v-for="pr in body.profiles" :key="pr.id" :value="pr.id">{{ pr.label }}</option></select>
        </label>
        <label>Frame rate
          <select v-model.number="p.fps" @change="clampShutter"><option v-for="r in body.frameRates" :key="r.fps" :value="r.fps">{{ r.label }}{{ r.crop > 1 ? ` (${r.crop}× crop)` : '' }}</option></select>
        </label>
        <label>Shutter mode
          <select :value="p.shutterMode" @change="e => setShutterMode(e.target.value)"><option value="angle">Angle</option><option value="speed">Speed</option></select>
        </label>
        <label>Lens
          <select v-model="p.lensId" @change="clampIris"><option v-for="l in lenses" :key="l.id" :value="l.id">{{ l.name }}{{ l.approx ? ' ≈' : '' }}</option></select>
        </label>
        <h5>Monitor</h5>
        <label>Frame lines
          <select v-model="d.frameLines"><option v-for="f in frameLineOptions" :key="f" :value="f">{{ f === 'off' ? 'Off' : f === '2.00' ? '2:1' : f.includes(':') ? f : `${f}:1` }}</option></select>
        </label>
        <label>Grid
          <select v-model="d.grid"><option value="off">Off</option><option value="thirds">Rule of 3rds</option><option value="square">Square</option><option value="diagonal">Diag + square</option></select>
        </label>
        <label class="check"><input type="checkbox" v-model="d.centre" /> Centre marker</label>
        <label class="check"><input type="checkbox" v-model="d.safety" /> 90% safety zone</label>
        <h5>Exposure assist</h5>
        <label class="check"><input type="checkbox" v-model="d.zebras" /> Zebras</label>
        <label>Zebra level
          <select v-model.number="d.zebraLevel"><option v-for="z in [70, 75, 80, 90, 95, 100]" :key="z" :value="z">{{ z }}{{ z === 100 ? '+' : '' }}</option></select>
        </label>
        <label class="check"><input type="checkbox" v-model="d.falseColour" /> False colour</label>
        <label class="check"><input type="checkbox" v-model="d.mm" /> M.M. exposure meter</label>
        <h5>Scopes (max 2)</h5>
        <label v-for="s in scopeOptions" :key="s.id" class="check"><input type="checkbox" :checked="d.scopes.includes(s.id)" @change="toggleScope(s.id)" /> {{ s.label }}</label>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, PropType, ref, watch } from 'vue'
import RingDial from '../controls/RingDial.vue'
import TiltWheel from '../controls/TiltWheel.vue'
import ScopeDock from './ScopeDock.vue'
import { getBody } from '../../library/cameras'
import { getLens, LENSES } from '../../library/lenses'
import { angleFromSpeed, dofLimits, focusDistance, formatDistance, formatShutter, frameRate } from '../../library/optics'
import { illuminanceAt, stopsOver, subjectMeterPoint, T_STOPS } from '../../library/photometry'
import { FrameCapture } from '../../live/LiveScene'
import { getItem, scene, sceneBounce } from '../../scene/store'
import { CameraItem, FrameLines, ScopeId, SubjectItem } from '../../scene/types'

type ParamId = 'shutter' | 'iris' | 'iso' | 'nd' | 'pol' | 'wb' | 'tint' | 'lens' | 'focus' | 'tilt'

const FRAME_ASPECT: Record<Exclude<FrameLines, 'off'>, number> = {
  '2.39': 2.39, '2.00': 2, '1.85': 1.85, '4:3': 4 / 3, '1:1': 1, '9:16': 9 / 16, '4:5': 4 / 5
}

export default defineComponent({
  name: 'CameraMonitor',
  components: { RingDial, TiltWheel, ScopeDock },
  props: {
    cameraId: { type: String, required: true },
    rect: { type: Object as PropType<{ x: number; y: number; width: number; height: number }>, required: true },
    frameCapture: { type: Object as PropType<FrameCapture | null>, default: null },
    active: { type: Boolean, default: true }
  },
  emits: ['capture'],
  setup(props) {
    const cam = computed(() => {
      const item = getItem(props.cameraId)
      return item && item.kind === 'camera' ? item : undefined
    })
    const p = computed(() => (cam.value as CameraItem).props)
    const d = computed(() => p.value.display)
    const body = computed(() => getBody(p.value.bodyId))
    const lens = computed(() => getLens(p.value.lensId))
    const rate = computed(() => frameRate(p.value))
    const profile = computed(() => body.value.profiles.find(pr => pr.id === p.value.profile) ?? body.value.profiles[0])
    const subjects = computed(() => scene.items.filter((i): i is SubjectItem => i.kind === 'subject'))
    const focusM = computed(() => focusDistance(cam.value as CameraItem, scene))
    const dof = computed(() => dofLimits(p.value, focusM.value))

    const selected = ref<ParamId | null>(null)
    const menuOpen = ref(false)
    const select = (id: ParamId) => { selected.value = selected.value === id ? null : id }

    // ── Value lists the camera steps through ────────────────────────────────
    const irisStops = computed(() => T_STOPS.filter(t => t >= lens.value.maxT && t <= lens.value.minT))
    const isoList = computed(() => body.value.isos.filter(iso => iso >= profile.value.minIso))
    const speedList = computed(() => body.value.shutterSpeeds.filter(s => 1 / s <= 1 / p.value.fps + 1e-6))

    const nearestIndex = (list: number[], v: number) => list.reduce((best, x, i) => (Math.abs(x - v) < Math.abs(list[best] - v) ? i : best), 0)
    const stepList = (list: number[], v: number, dir: number) => list[Math.min(list.length - 1, Math.max(0, nearestIndex(list, v) + dir))]

    const stepParam = (id: ParamId, dir: number, alt = false) => {
      const c = p.value
      switch (id) {
        case 'iris': c.tStop = stepList(irisStops.value, c.tStop, dir); break
        case 'iso': c.iso = stepList(isoList.value, c.iso, dir); break
        case 'shutter':
          if (c.shutterMode === 'angle') {
            c.shutterAngle = alt
              ? Math.min(360, Math.max(1, Math.round(c.shutterAngle) + dir))
              : stepList(body.value.shutterAngles, c.shutterAngle, dir)
          } else c.shutterSpeed = stepList(speedList.value, c.shutterSpeed, dir)
          break
        case 'wb': c.wb = Math.min(body.value.wbRange[1], Math.max(body.value.wbRange[0], c.wb + dir * (alt ? 10 : 100))); break
        case 'tint': c.tint = Math.min(99, Math.max(-99, c.tint + dir * (alt ? 10 : 1))); break
        case 'lens': {
          const i = LENSES.findIndex(l => l.id === c.lensId)
          c.lensId = LENSES[Math.min(LENSES.length - 1, Math.max(0, i + dir))].id
          clampIris()
          break
        }
        case 'nd': c.nd.stops = Math.min(8, Math.max(2, Math.round((c.nd.stops + dir / 3) * 3) / 3)); break
        case 'pol': c.polarizer.angle = Math.min(180, Math.max(0, c.polarizer.angle + dir * (alt ? 1 : 5))); break
        case 'focus': setManualFocus(focusM.value * Math.pow(alt ? 1.01 : 1.05, dir)); break
        case 'tilt': c.tilt = Math.min(90, Math.max(-90, c.tilt + dir * (alt ? 5 : 1))); break
      }
    }

    const neighbours = (id: ParamId): string[] => {
      const c = p.value
      // Seven labels centred on index i (blank past either end).
      const around = (labels: string[], i: number) => [-3, -2, -1, 0, 1, 2, 3].map(o => labels[i + o] ?? '')
      switch (id) {
        case 'iris': return around(irisStops.value.map(t => `T${t}`), nearestIndex(irisStops.value, c.tStop))
        case 'iso': return around(isoList.value.map(String), nearestIndex(isoList.value, c.iso))
        case 'shutter': {
          if (c.shutterMode === 'speed') return around(speedList.value.map(s => `1/${s}`), nearestIndex(speedList.value, c.shutterSpeed))
          const angles = body.value.shutterAngles
          const i = nearestIndex(angles, c.shutterAngle)
          const labels = angles.map((a, j) => (j === i ? `${c.shutterAngle.toFixed(1)}°` : `${a}°`))
          return around(labels, i)
        }
        case 'wb': return [-3, -2, -1, 0, 1, 2, 3].map(o => { const k = c.wb + o * 100; return k >= body.value.wbRange[0] && k <= body.value.wbRange[1] ? `${k}K` : '' })
        case 'tint': return [-3, -2, -1, 0, 1, 2, 3].map(o => { const t = c.tint + o; return Math.abs(t) <= 99 ? (t === 0 ? 'G/M 0' : t < 0 ? `G${-t}` : `M${t}`) : '' })
        case 'lens': return around(LENSES.map(l => `${l.focalLength}mm`), LENSES.findIndex(l => l.id === c.lensId))
        default: return []
      }
    }

    // Horizontal drag on a scroller: one step per 22px.
    let drag: { id: ParamId; x: number } | null = null
    const dragStart = (event: PointerEvent, id: ParamId) => {
      drag = { id, x: event.clientX };
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
    }
    const dragMove = (event: PointerEvent) => {
      if (!drag) return
      const steps = Math.trunc((drag.x - event.clientX) / 22)
      if (steps) {
        stepParam(drag.id, Math.sign(steps), event.shiftKey)
        drag.x -= Math.sign(steps) * 22
      }
    }
    const dragEnd = () => { drag = null }

    const clampIris = () => { p.value.tStop = stepList(irisStops.value, p.value.tStop, 0) }
    const clampIso = () => { p.value.iso = stepList(isoList.value, Math.max(p.value.iso, profile.value.minIso), 0) }
    const clampShutter = () => {
      if (!speedList.value.includes(p.value.shutterSpeed)) p.value.shutterSpeed = speedList.value[0]
    }
    const setShutterMode = (mode: string) => {
      const c = p.value
      if (mode === c.shutterMode) return
      // Carry the exposure time across: 180° at 23.98p ⇄ 1/48.
      if (mode === 'speed') c.shutterSpeed = stepList(speedList.value, 360 * c.fps / c.shutterAngle, 0)
      else c.shutterAngle = Math.round(angleFromSpeed(c.shutterSpeed, c.fps) * 10) / 10
      c.shutterMode = mode as 'angle' | 'speed'
    }
    const setManualFocus = (m: number) => {
      p.value.focus.mode = 'manual'
      p.value.focus.distance = Math.min(30, Math.max(lens.value.closeFocus, m))
    }
    const track = (id: string) => {
      p.value.focus.mode = 'subject'
      p.value.focus.subjectId = id
    }
    const toggleScope = (id: ScopeId) => {
      const list = d.value.scopes
      const i = list.indexOf(id)
      if (i >= 0) list.splice(i, 1)
      else {
        list.push(id)
        if (list.length > 2) list.shift()
      }
    }

    // ── M.M. (metered manual) against the focused / first subject's face ─────
    const mm = computed(() => {
      const subject = subjects.value.find(s => s.id === p.value.focus.subjectId) ?? subjects.value[0]
      if (!subject) return -Infinity
      const point = subjectMeterPoint(subject)
      const lux = scene.items.reduce((sum, i) => (i.kind === 'light' ? sum + illuminanceAt(i, point) : sum), sceneBounce().lux)
      return stopsOver(lux, p.value)
    })
    const mmText = computed(() => {
      const v = mm.value
      if (!isFinite(v)) return '−−'
      if (v > 2) return '+2.0▶'
      if (v < -2) return '◀−2.0'
      return `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(1)}`
    })
    const mmClass = computed(() => (Math.abs(mm.value) <= 0.35 ? 'good' : mm.value > 0 ? 'over' : 'under'))

    const cells = computed(() => {
      const c = p.value
      const baseTag = profile.value.baseIsos.includes(c.iso) ? 'BASE' : ''
      return [
        { id: 'shutter' as ParamId, label: 'SHUTTER', value: formatShutter(c) },
        { id: 'iris' as ParamId, label: 'IRIS', value: `T${c.tStop}` },
        { id: 'iso' as ParamId, label: 'ISO', value: String(c.iso), tag: baseTag },
        { id: 'nd' as ParamId, label: 'ND', value: c.nd.fitted ? `${c.nd.stops.toFixed(1)}` : 'CLEAR', off: !c.nd.fitted },
        { id: 'pol' as ParamId, label: 'POL', value: c.polarizer.fitted ? `${Math.round(c.polarizer.angle)}°` : 'OFF', off: !c.polarizer.fitted },
        { id: 'wb' as ParamId, label: 'WB', value: `${c.wb}K ${c.tint === 0 ? '' : c.tint < 0 ? `G${-c.tint}` : `M${c.tint}`}` },
        { id: 'lens' as ParamId, label: 'LENS', value: `${lens.value.focalLength}mm` },
        { id: 'focus' as ParamId, label: c.focus.mode === 'subject' ? 'AF' : 'MF', value: formatDistance(focusM.value) },
        { id: 'tilt' as ParamId, label: 'TILT', value: c.tilt === 0 ? 'LEVEL' : `${Math.abs(c.tilt)}° ${c.tilt > 0 ? '↓' : '↑'}` }
      ]
    })

    // ── Assist overlays ──────────────────────────────────────────────────────
    const frame = computed(() => {
      const fl = d.value.frameLines
      if (fl === 'off') return null
      const W = props.rect.width
      const H = props.rect.height
      const a = FRAME_ASPECT[fl]
      if (a >= W / H) {
        const h = W / a
        const y = (H - h) / 2
        return { inner: { x: 0, y, w: W, h }, bars: [{ x: 0, y: 0, w: W, h: y }, { x: 0, y: y + h, w: W, h: y }] }
      }
      const w = H * a
      const x = (W - w) / 2
      return { inner: { x, y: 0, w, h: H }, bars: [{ x: 0, y: 0, w: x, h: H }, { x: x + w, y: 0, w: x, h: H }] }
    })
    const gridLines = computed(() => {
      const W = props.rect.width
      const H = props.rect.height
      const lines: number[][] = []
      if (d.value.grid === 'thirds') {
        [1, 2].forEach(i => { lines.push([(W * i) / 3, 0, (W * i) / 3, H]); lines.push([0, (H * i) / 3, W, (H * i) / 3]) })
      } else if (d.value.grid === 'square' || d.value.grid === 'diagonal') {
        const step = H / 6
        for (let x = W / 2 % step; x < W; x += step) lines.push([x, 0, x, H])
        for (let y = step; y < H; y += step) lines.push([0, y, W, y])
        if (d.value.grid === 'diagonal') { lines.push([0, 0, W, H]); lines.push([W, 0, 0, H]) }
      }
      return lines
    })

    // ── REC + timecode ───────────────────────────────────────────────────────
    const frames = ref(0)
    let timer: number | undefined
    const toggleRec = () => { p.value.recording = !p.value.recording }
    watch(() => p.value?.recording, rec => {
      window.clearInterval(timer)
      if (rec) {
        const start = performance.now() - (frames.value / p.value.fps) * 1000
        timer = window.setInterval(() => { frames.value = Math.floor(((performance.now() - start) / 1000) * p.value.fps) }, 40)
      }
    }, { immediate: true })
    const timecode = computed(() => {
      const fps = Math.round(p.value.fps)
      const f = frames.value
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${pad(Math.floor(f / (fps * 3600)))}:${pad(Math.floor(f / (fps * 60)) % 60)}:${pad(Math.floor(f / fps) % 60)}:${pad(f % fps)}`
    })

    // ── Keyboard / wheel ─────────────────────────────────────────────────────
    const onKey = (event: KeyboardEvent) => {
      if (!props.active || !cam.value) return
      if (document.querySelector('[aria-modal="true"]')) return
      const target = event.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'd' || event.key === 'D') d.value.osd = !d.value.osd
      else if (event.key === 'Escape') { selected.value = null; menuOpen.value = false }
      else if (selected.value && (event.key === 'ArrowRight' || event.key === 'ArrowUp')) stepParam(selected.value, 1, event.shiftKey)
      else if (selected.value && (event.key === 'ArrowLeft' || event.key === 'ArrowDown')) stepParam(selected.value, -1, event.shiftKey)
      else return
      event.preventDefault()
    }
    // Scrolling over the image turns the "control dial" for the selected parameter.
    const onImageWheel = (event: WheelEvent) => {
      if (!selected.value || !d.value.osd) return
      event.preventDefault()
      stepParam(selected.value, -Math.sign(event.deltaY), event.shiftKey)
    }
    onMounted(() => window.addEventListener('keydown', onKey))
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKey)
      window.clearInterval(timer)
    })

    const rectStyle = computed(() => ({
      left: `${props.rect.x}px`, top: `${props.rect.y}px`, width: `${props.rect.width}px`, height: `${props.rect.height}px`
    }))

    return {
      cam, p, d, body, lens, rate, profile, subjects, focusM, dof, selected, menuOpen, select, stepParam,
      neighbours, dragStart, dragMove, dragEnd, clampIris, clampIso, clampShutter, setShutterMode,
      setManualFocus, track, toggleScope, mm, mmText, mmClass, cells, frame, gridLines, toggleRec, timecode,
      onImageWheel, rectStyle, formatDistance, lenses: LENSES,
      frameLineOptions: ['off', '2.39', '2.00', '1.85', '4:3', '1:1', '9:16', '4:5'],
      scopeOptions: [
        { id: 'histogram', label: 'Histogram' }, { id: 'waveform', label: 'Waveform (RGB overlay)' },
        { id: 'parade', label: 'RGB parade' }, { id: 'vectorscope', label: 'Vectorscope' }
      ]
    }
  }
})
</script>

<style scoped>
.monitor {
  position: absolute;
  font-family: 'Helvetica Neue', Arial, sans-serif;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  pointer-events: none;
  user-select: none;
}
.monitor > * { pointer-events: auto; }
.assist { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.matte { fill: rgba(0, 0, 0, 0.6); }
.frame-line { fill: none; stroke: rgba(255, 255, 255, 0.7); stroke-width: 1; }
.grid { stroke: rgba(255, 255, 255, 0.35); stroke-width: 1; }
.centre line { stroke: rgba(255, 255, 255, 0.8); stroke-width: 1.5; }
.safety { fill: none; stroke: rgba(255, 255, 255, 0.45); stroke-dasharray: 6 4; }

button { font-family: inherit; text-shadow: none; }
.disp-chip {
  position: absolute; top: 8px; right: 8px; font-size: 10px; letter-spacing: 1px; padding: 2px 6px;
  background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.25); color: rgba(255, 255, 255, 0.7);
}

.top-bar {
  position: absolute; top: 0; left: 0; right: 0; height: 24px; display: flex; align-items: center; gap: 14px;
  padding: 0 10px; font-size: 12px; background: linear-gradient(rgba(0, 0, 0, 0.55), rgba(0, 0, 0, 0));
  pointer-events: none;
}
.top-bar .spacer { flex: 1; }
.top-bar .dim { color: rgba(255, 255, 255, 0.65); }
.rec { font-weight: 700; letter-spacing: 1px; }
.rec.on { color: #ff3b30; }
.tc { font-variant-numeric: tabular-nums; }

.side-buttons { position: absolute; top: 32px; right: 8px; display: flex; flex-direction: column; gap: 6px; }
.side-buttons button {
  font-size: 10px; letter-spacing: 1px; padding: 4px 8px; background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.25); color: #fff; border-radius: 3px;
}
.side-buttons button.on { background: #ffb547; color: #111; border-color: #ffb547; }
.side-buttons .rec-btn { color: #ff6259; }
.side-buttons .rec-btn.on { background: #ff3b30; color: #fff; border-color: #ff3b30; }
.side-buttons .still-btn { color: #ffb547; margin-top: 6px; }
.still-chip { top: 32px; color: #ffb547; }

.fc-legend { position: absolute; top: 30px; left: 10px; display: flex; font-size: 9px; }
.fc-legend span { padding: 1px 5px; color: #fff; text-shadow: none; }

.scopes { position: absolute; right: 8px; bottom: 58px; }

.bottom-bar {
  position: absolute; left: 0; right: 0; bottom: 0; display: flex; align-items: stretch; gap: 2px; padding: 4px 6px;
  background: linear-gradient(rgba(0, 0, 0, 0), rgba(0, 0, 0, 0.7));
}
.cell {
  position: relative; display: flex; flex-direction: column; align-items: flex-start; min-width: 0; flex: 1;
  padding: 3px 6px; background: transparent; border: 1px solid transparent; border-radius: 3px; color: #fff; cursor: pointer;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
}
.cell small { font-size: 9px; letter-spacing: 1px; color: rgba(255, 255, 255, 0.6); }
.cell span { font-size: 14px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }
.cell.off span { color: rgba(255, 255, 255, 0.5); }
.cell.selected { border-color: #ffb547; background: rgba(255, 181, 71, 0.18); }
.cell.selected span { color: #ffb547; }
.tag { position: absolute; top: 2px; right: 4px; font-size: 8px; font-style: normal; background: #ffb547; color: #111; padding: 0 3px; border-radius: 2px; text-shadow: none; }
.mm { cursor: default; }
.mm.good span { color: #8fdc8f; }
.mm.over span { color: #ffb547; }
.mm.under span { color: #7fb2ff; }
.mm-scale { position: relative; width: 100%; height: 4px; margin-top: 2px; background: linear-gradient(to right, #7fb2ff, #fff 50%, #ffb547); opacity: 0.8; }
.mm-scale i { position: absolute; top: -3px; width: 2px; height: 10px; background: #fff; transform: translateX(-1px); }

.control-pop {
  position: absolute; left: 50%; bottom: 60px; transform: translateX(-50%); display: flex; align-items: center; gap: 14px;
  padding: 10px 14px; background: rgba(12, 12, 16, 0.82); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 8px;
  text-shadow: none;
}
.pop-side { display: flex; flex-direction: column; gap: 6px; max-width: 200px; }
.pop-side button, .modes button {
  font-size: 11px; padding: 4px 8px; background: #23252c; border: 1px solid #3a3d46; color: #fff; border-radius: 4px;
}
.pop-side button.on, .modes button.on { background: #ffb547; color: #111; border-color: #ffb547; }
.hint { font-size: 10px; color: rgba(255, 255, 255, 0.55); }
.scrollers { display: flex; flex-direction: column; gap: 8px; align-items: center; }
.modes { display: flex; gap: 4px; }
.scroller {
  display: flex; gap: 2px; cursor: ew-resize; touch-action: none; outline: none; padding: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.15); border-bottom: 1px solid rgba(255, 255, 255, 0.15);
}
.scroller span { width: 62px; text-align: center; font-size: 12px; color: rgba(255, 255, 255, 0.45); font-variant-numeric: tabular-nums; }
.scroller span.current { color: #ffb547; font-size: 16px; font-weight: 700; }

.menu {
  position: absolute; top: 32px; right: 64px; bottom: 64px; width: 230px; overflow-y: auto; padding: 8px 12px;
  background: rgba(12, 12, 16, 0.88); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px;
  font-size: 12px; text-shadow: none; display: flex; flex-direction: column; gap: 6px;
}
.menu h5 { margin: 6px 0 0; font-size: 10px; letter-spacing: 1.5px; color: #ffb547; }
.menu label { display: flex; flex-direction: column; gap: 3px; color: rgba(255, 255, 255, 0.7); }
.menu label.check { flex-direction: row; align-items: center; gap: 6px; color: #fff; }
.menu select { width: 100%; font-size: 12px; padding: 3px 6px; }
</style>
