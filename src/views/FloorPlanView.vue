<template>
  <div class="plan">
    <div class="canvas-area">
      <div class="toolbar">
        <button @click="add('subject')">+ Subject</button>
        <button :class="{ on: showLibrary }" @click="showLibrary = !showLibrary">+ Light</button>
        <button @click="add('camera')">+ Camera</button>
      </div>
      <LightLibrary v-if="showLibrary" @pick="addLight" @close="showLibrary = false" />

      <!-- SVG units are metres. svg y = -world z, so "up" on the plan is +z in 3D. -->
      <svg
        ref="svg"
        :viewBox="viewBox"
        preserveAspectRatio="xMidYMid meet"
        @pointerdown.self="select(null)"
        @pointermove="onPointerMove"
        @pointerup="endDrag"
        @pointerleave="endDrag"
      >
        <g class="grid" pointer-events="none">
          <line v-for="x in gridX" :key="'gx' + x" :x1="x" :x2="x" :y1="bounds.minY" :y2="bounds.maxY" :class="{ major: isMajor(x) }" />
          <line v-for="y in gridY" :key="'gy' + y" :y1="y" :y2="y" :x1="bounds.minX" :x2="bounds.maxX" :class="{ major: isMajor(y) }" />
        </g>

        <rect class="room" :x="-room.width / 2" :y="-room.depth / 2" :width="room.width" :height="room.depth" pointer-events="none" />
        <text class="dim" :x="0" :y="-room.depth / 2 - 0.2" text-anchor="middle">{{ room.width.toFixed(1) }} m</text>
        <text class="dim" :transform="`translate(${-room.width / 2 - 0.2} 0) rotate(-90)`" text-anchor="middle">{{ room.depth.toFixed(1) }} m</text>

        <g
          v-for="item in items"
          :key="item.id"
          :transform="`translate(${item.x} ${-item.z})`"
          :class="['item', item.kind, { selected: item.id === selectedId }]"
        >
          <g :transform="`rotate(${item.rotationY})`">
            <template v-if="item.kind === 'light'">
              <circle v-if="visuals[item.id].omni" class="beam" :r="visuals[item.id].throw" :fill="visuals[item.id].hex" pointer-events="none" />
              <path
                v-else
                :class="['beam', { hard: visuals[item.id].hard }]"
                :d="wedge(visuals[item.id].beam, visuals[item.id].throw)"
                :fill="visuals[item.id].hex"
                :stroke="visuals[item.id].hex"
                pointer-events="none"
              />
              <g class="fixture" @pointerdown.stop="startMove($event, item)">
                <circle class="hit" r="0.25" />
                <path v-for="(part, i) in visuals[item.id].parts" :key="i" :d="part.d" :class="part.glow ? 'glow' : 'body'" :fill="part.glow ? visuals[item.id].hex : undefined" />
              </g>
            </template>

            <template v-else-if="item.kind === 'camera'">
              <path class="fov" :d="wedge(fovDegrees(item.props.focalLength), 3)" pointer-events="none" />
              <rect class="body" x="-0.14" y="-0.1" width="0.28" height="0.24" rx="0.03" @pointerdown.stop="startMove($event, item)" />
              <rect class="lens" x="-0.07" y="-0.2" width="0.14" height="0.1" @pointerdown.stop="startMove($event, item)" />
            </template>

            <template v-else>
              <circle class="body" r="0.22" @pointerdown.stop="startMove($event, item)" />
              <path class="nose" d="M -0.08 -0.2 L 0 -0.32 L 0.08 -0.2 Z" pointer-events="none" />
            </template>

            <g v-if="item.id === selectedId" class="rotate-handle">
              <line x1="0" y1="-0.25" x2="0" y2="-0.6" pointer-events="none" />
              <circle cy="-0.66" r="0.07" @pointerdown.stop="startRotate($event, item)" />
            </g>
          </g>
          <text class="label" y="0.42" text-anchor="middle" pointer-events="none">{{ item.name }}</text>
        </g>
      </svg>
      <div class="hint">Drag to move (snaps to 10 cm, hold Alt for free) · drag the dot to aim (snaps to 5°, hold Alt for free) · Delete removes</div>
    </div>

    <aside class="panel">
      <template v-if="selected">
        <h4>{{ kindLabel[selected.kind] }}</h4>
        <label>Name <input v-model="selected.name" /></label>
        <label>Height (m) <input type="number" step="0.05" min="0.1" max="6" v-model.number="selected.height" /></label>
        <label>Aim (°) <input type="number" step="5" v-model.number="selected.rotationY" /></label>
        <div class="readout">x {{ selected.x.toFixed(2) }} m · z {{ selected.z.toFixed(2) }} m</div>

        <LightProperties v-if="selected.kind === 'light'" :id="selected.id" />

        <template v-if="selected.kind === 'subject' && meter">
          <h4 class="section">Light meter (face)</h4>
          <div class="meter-total">
            <strong>{{ meter.total.toLocaleString() }} lux</strong>
            <span>≈ T{{ meter.stop }} at ISO {{ exposure.iso }}, 1/{{ Math.round(1 / exposure.shutter) }}</span>
          </div>
          <div class="meter-vs" :class="meter.verdict">{{ meter.vsText }}</div>
          <div class="meter-row" v-for="row in meter.rows" :key="row.id">
            <i class="swatch" :style="{ background: row.hex }"></i>{{ row.name }} <span>{{ row.lux.toLocaleString() }} lux</span>
          </div>
          <div class="exposure">
            <label>ISO
              <select v-model.number="exposure.iso"><option v-for="iso in isos" :key="iso" :value="iso">{{ iso }}</option></select>
            </label>
            <label>Camera T-stop
              <select v-model.number="exposure.tStop"><option v-for="t in tStops" :key="t" :value="t">T{{ t }}</option></select>
            </label>
          </div>
          <div class="readout">Direct light only; walls, bounce and shadows aren't counted.</div>
        </template>

        <template v-if="selected.kind === 'camera'">
          <label>Focal length (mm)
            <select v-model.number="selected.props.focalLength">
              <option v-for="mm in focalLengths" :key="mm" :value="mm">{{ mm }}mm</option>
            </select>
          </label>
        </template>

        <button class="danger" @click="remove(selected.id)">Delete</button>
      </template>
      <p v-else class="empty">Select an item on the plan to edit it, or add one from the toolbar.</p>
    </aside>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import LightLibrary from '../components/LightLibrary.vue'
import LightProperties from '../components/LightProperties.vue'
import {
  illuminanceAt, ISOS, nearestStop, ResolvedLight, resolveLight, stopsOver, subjectMeterPoint, T_STOPS, tStopFor
} from '../library/photometry'
import { addItem, getItem, removeItem, scene, select } from '../scene/store'
import { horizontalFov, ItemKind, LightItem, SceneItem } from '../scene/types'

const MARGIN = 1.5
const MOVE_SNAP = 0.1
const ROTATE_SNAP = 5

const snap = (value: number, step: number) => Math.round(value / step) * step
const round = (value: number) => Math.round(value * 1000) / 1000

interface LightVisual {
  omni: boolean
  hard: boolean
  beam: number
  throw: number
  hex: string
  parts: Array<{ d: string; glow: boolean }>
}

const rectPath = (x: number, y: number, w: number, h: number) => `M ${x} ${y} h ${w} v ${h} h ${-w} Z`
const circlePath = (r: number) => `M ${-r} 0 a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`

// Top-down outline of the fixture at true size. The emitting face is at y = 0 facing up (-y);
// housings extend behind it (+y).
function fixtureParts(light: ResolvedLight, orientation: LightItem['props']['orientation']): LightVisual['parts'] {
  const { shape, w, depth } = light.emitter
  const parts: LightVisual['parts'] = []
  const face = (width: number) => parts.push({ d: rectPath(-width / 2, -0.035, width, 0.035), glow: true })
  switch (shape) {
    case 'rect':
      if (light.fixture.shape.type === 'rect' && light.modifier.kind !== 'panel-softbox') {
        parts.push({ d: rectPath(-w / 2, 0, w, Math.max(depth, 0.05)), glow: false })
      } else {
        const back = Math.min(0.2, w)
        parts.push({ d: `M ${-w / 2} 0 L ${w / 2} 0 L ${back / 2} ${depth} L ${-back / 2} ${depth} Z`, glow: false })
      }
      face(w)
      break
    case 'octa':
    case 'dish':
    case 'reflector': {
      const back = Math.min(0.15, w)
      parts.push({ d: `M ${-w / 2} 0 L ${w / 2} 0 L ${back / 2} ${depth} L ${-back / 2} ${depth} Z`, glow: false })
      face(w)
      break
    }
    case 'sphere':
      parts.push({ d: circlePath(w / 2), glow: true })
      break
    case 'lens':
      parts.push({ d: rectPath(-w / 2, 0, w, depth), glow: false })
      face(w * 0.8)
      break
    case 'cob':
      face(0.1)
      break
    case 'tube':
      parts.push({ d: orientation === 'vertical' ? circlePath(0.045) : rectPath(-w / 2, -0.025, w, 0.05), glow: true })
      break
    case 'bulb':
      parts.push({ d: circlePath(0.05), glow: true })
      break
  }
  if (light.fixture.shape.type === 'cob') {
    const size = light.fixture.shape.size
    const offset = shape === 'sphere' ? w / 2 : depth
    parts.push({ d: rectPath(-size * 0.4, offset, size * 0.8, size), glow: false })
  }
  return parts
}

type Drag = { mode: 'move' | 'rotate'; id: string; offsetX: number; offsetZ: number }

export default defineComponent({
  name: 'FloorPlanView',
  components: { LightLibrary, LightProperties },
  props: {
    active: { type: Boolean, default: true }
  },
  setup(props) {
    const svg = ref<SVGSVGElement | null>(null)
    const room = computed(() => scene.room)
    const items = computed(() => scene.items)
    const selectedId = computed(() => scene.selectedId)
    const selected = computed(() => getItem(scene.selectedId))

    const bounds = computed(() => ({
      minX: -room.value.width / 2 - MARGIN,
      maxX: room.value.width / 2 + MARGIN,
      minY: -room.value.depth / 2 - MARGIN,
      maxY: room.value.depth / 2 + MARGIN
    }))
    const viewBox = computed(() => {
      const b = bounds.value
      return `${b.minX} ${b.minY} ${b.maxX - b.minX} ${b.maxY - b.minY}`
    })

    const range = (min: number, max: number) => {
      const lines: number[] = []
      for (let v = Math.ceil(min * 2) / 2; v <= max; v += 0.5) lines.push(round(v))
      return lines
    }
    const gridX = computed(() => range(bounds.value.minX, bounds.value.maxX))
    const gridY = computed(() => range(bounds.value.minY, bounds.value.maxY))
    const isMajor = (v: number) => Number.isInteger(v)

    // Wedge pointing "up" (-y) with the given full angle in degrees.
    const wedge = (angle: number, length: number) => {
      const half = (Math.min(angle, 179) / 2) * Math.PI / 180
      const x = Math.sin(half) * length
      const y = -Math.cos(half) * length
      return `M 0 0 L ${x} ${y} A ${length} ${length} 0 0 0 ${-x} ${y} Z`
    }
    const fovDegrees = (focalLength: number) => horizontalFov(focalLength) * 180 / Math.PI

    const lights = computed(() => scene.items.filter((item): item is LightItem => item.kind === 'light'))

    const visuals = computed(() => {
      const result: Record<string, LightVisual> = {}
      lights.value.forEach(item => {
        const light = resolveLight(item)
        result[item.id] = {
          omni: light.omni,
          hard: light.hardEdge,
          beam: light.beam,
          // Beam drawn out to where it falls to ~400 lux.
          throw: Math.min(Math.max(Math.sqrt(light.candela / 400), 0.6), 6),
          hex: light.colourHex,
          parts: fixtureParts(light, item.props.orientation)
        }
      })
      return result
    })

    const exposure = scene.exposure
    const meter = computed(() => {
      const subject = selected.value
      if (!subject || subject.kind !== 'subject') return null
      const point = subjectMeterPoint(subject)
      const rows = lights.value
        .map(item => ({ id: item.id, name: item.name, hex: resolveLight(item).colourHex, lux: Math.round(illuminanceAt(item, point)) }))
        .sort((a, b) => b.lux - a.lux)
      const total = rows.reduce((sum, row) => sum + row.lux, 0)
      const over = stopsOver(total, exposure)
      const verdict = !isFinite(over) || over < -1 ? 'under' : over > 1 ? 'over' : 'good'
      const vsText = !isFinite(over)
        ? 'No direct light on the face'
        : Math.abs(over) < 0.17 ? `Exposed right at T${exposure.tStop}`
          : `${over > 0 ? '+' : '−'}${Math.abs(over).toFixed(1)} stops ${over > 0 ? 'over' : 'under'} at T${exposure.tStop}`
      return { rows, total, stop: nearestStop(tStopFor(total, exposure)), verdict, vsText }
    })

    const showLibrary = ref(false)
    const addLight = (fixtureId: string) => {
      addItem('light', fixtureId)
      showLibrary.value = false
    }

    const toWorld = (event: PointerEvent) => {
      const el = svg.value as SVGSVGElement
      const point = el.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      const local = point.matrixTransform((el.getScreenCTM() as DOMMatrix).inverse())
      return { x: local.x, z: -local.y }
    }

    let drag: Drag | null = null

    const startMove = (event: PointerEvent, item: SceneItem) => {
      select(item.id)
      const p = toWorld(event)
      drag = { mode: 'move', id: item.id, offsetX: item.x - p.x, offsetZ: item.z - p.z }
      svg.value?.setPointerCapture(event.pointerId)
    }

    const startRotate = (event: PointerEvent, item: SceneItem) => {
      drag = { mode: 'rotate', id: item.id, offsetX: 0, offsetZ: 0 }
      svg.value?.setPointerCapture(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!drag) return
      const item = getItem(drag.id)
      if (!item) return
      const p = toWorld(event)
      const free = event.altKey
      if (drag.mode === 'move') {
        const b = bounds.value
        const x = Math.min(Math.max(p.x + drag.offsetX, b.minX), b.maxX)
        const z = Math.min(Math.max(p.z + drag.offsetZ, -b.maxY), -b.minY)
        item.x = round(free ? x : snap(x, MOVE_SNAP))
        item.z = round(free ? z : snap(z, MOVE_SNAP))
      } else {
        const angle = Math.atan2(p.x - item.x, p.z - item.z) * 180 / Math.PI
        const normalised = (angle + 360) % 360
        item.rotationY = Math.round(free ? normalised : snap(normalised, ROTATE_SNAP) % 360)
      }
    }

    const endDrag = () => { drag = null }

    const add = (kind: ItemKind) => addItem(kind)
    const remove = (id: string) => removeItem(id)

    const onKey = (event: KeyboardEvent) => {
      if (!props.active || !scene.selectedId) return
      const target = event.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      if (event.key === 'Delete' || event.key === 'Backspace') {
        removeItem(scene.selectedId)
        event.preventDefault()
      }
    }
    onMounted(() => window.addEventListener('keydown', onKey))
    onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

    return {
      svg, room, items, selectedId, selected, bounds, viewBox, gridX, gridY, isMajor,
      wedge, fovDegrees, visuals, meter, exposure, showLibrary, addLight, isos: ISOS, tStops: T_STOPS, startMove, startRotate, onPointerMove, endDrag, add, remove, select,
      kindLabel: { subject: 'Subject', light: 'Light', camera: 'Camera' },
      focalLengths: [14, 18, 24, 35, 50, 85, 100, 135]
    }
  }
})
</script>

<style scoped>
.plan {
  display: flex;
  width: 100%;
  height: 100%;
}
.canvas-area {
  position: relative;
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.toolbar {
  position: absolute;
  top: 12px;
  left: 12px;
  display: flex;
  gap: 8px;
}
svg {
  flex: 1;
  width: 100%;
  min-height: 0;
  background: #15161a;
  user-select: none;
  touch-action: none;
}
.hint {
  padding: 8px 12px;
  font-size: 12px;
  color: var(--muted);
  border-top: 1px solid var(--line);
}

.grid line { stroke: #22242b; stroke-width: 0.01; }
.grid line.major { stroke: #2d3039; stroke-width: 0.015; }
.room { fill: #1c1e24; stroke: #c9ccd4; stroke-width: 0.05; }
.dim { fill: var(--muted); font-size: 0.18px; }
.label { fill: #d7d9de; font-size: 0.16px; }

.item .body { cursor: grab; stroke: #0d0e11; stroke-width: 0.02; }
.item.selected .body { stroke: var(--accent); stroke-width: 0.04; }
.subject .body { fill: #c89f82; }
.subject .nose { fill: #c89f82; }
.light .beam { opacity: 0.12; stroke: none; }
.light .beam.hard { opacity: 0.2; stroke-width: 0.02; stroke-opacity: 0.8; }
.light .fixture { cursor: grab; }
.light .fixture .hit { fill: transparent; }
.light .fixture .body { fill: #3a3d46; stroke: #0d0e11; stroke-width: 0.015; }
.light .fixture .glow { stroke: #0d0e11; stroke-width: 0.01; }
.light.selected .fixture .body { stroke: var(--accent); stroke-width: 0.03; }
.toolbar button.on { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.section { margin-top: 8px !important; padding-top: 12px; border-top: 1px solid var(--line); }
.meter-total { display: flex; flex-direction: column; gap: 2px; }
.meter-total strong { font-size: 20px; }
.meter-total span, .meter-row span { color: var(--muted); }
.meter-vs { font-size: 12px; padding: 4px 8px; border-radius: 4px; background: #23252c; }
.meter-vs.good { color: #8fdc8f; }
.meter-vs.over { color: #ffb547; }
.meter-vs.under { color: #7fb2ff; }
.meter-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.meter-row span { margin-left: auto; }
.swatch { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.exposure { display: flex; gap: 8px; }
.exposure label { flex: 1; }
.camera .body, .camera .lens { fill: #8a8f9c; cursor: grab; }
.camera .fov { fill: rgba(120, 170, 255, 0.07); stroke: rgba(120, 170, 255, 0.6); stroke-width: 0.015; stroke-dasharray: 0.08 0.06; }
.rotate-handle line { stroke: var(--accent); stroke-width: 0.02; }
.rotate-handle circle { fill: var(--accent); cursor: crosshair; }

.panel {
  width: 260px;
  flex-shrink: 0;
  padding: 16px;
  border-left: 1px solid var(--line);
  background: var(--panel);
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;
  font-size: 13px;
}
.panel h4 { margin: 0; font-size: 14px; }
.panel label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); }
.panel label span { color: var(--text); }
.panel input:not([type='range']):not([type='color']), .panel select { width: 100%; box-sizing: border-box; }
.readout { color: var(--muted); font-variant-numeric: tabular-nums; }
.empty { color: var(--muted); }
.danger { margin-top: 8px; color: #ff8a80; }
</style>
