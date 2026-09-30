<template>
  <div class="plan">
    <div class="canvas-area">
      <div class="toolbar">
        <button @click="add('subject')">+ Subject</button>
        <button @click="add('light')">+ Light</button>
        <button @click="add('camera')">+ Camera</button>
      </div>

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
              <path class="beam" :d="wedge(item.props.angle, 2.2)" :fill="item.props.color" pointer-events="none" />
              <rect class="body" x="-0.16" y="-0.1" width="0.32" height="0.2" rx="0.03" :fill="item.props.color" @pointerdown.stop="startMove($event, item)" />
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

        <template v-if="selected.kind === 'light'">
          <label>Intensity <span>{{ selected.props.intensity }}</span>
            <input type="range" min="0" max="200" step="1" v-model.number="selected.props.intensity" />
          </label>
          <label>Beam angle <span>{{ selected.props.angle }}°</span>
            <input type="range" min="5" max="120" step="1" v-model.number="selected.props.angle" />
          </label>
          <label>Tilt down <span>{{ selected.props.tilt }}°</span>
            <input type="range" min="-30" max="90" step="1" v-model.number="selected.props.tilt" />
          </label>
          <label>Colour <input type="color" v-model="selected.props.color" /></label>
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
import { addItem, getItem, removeItem, scene, select } from '../scene/store'
import { horizontalFov, ItemKind, SceneItem } from '../scene/types'

const MARGIN = 1.5
const MOVE_SNAP = 0.1
const ROTATE_SNAP = 5

const snap = (value: number, step: number) => Math.round(value / step) * step
const round = (value: number) => Math.round(value * 1000) / 1000

type Drag = { mode: 'move' | 'rotate'; id: string; offsetX: number; offsetZ: number }

export default defineComponent({
  name: 'FloorPlanView',
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
      wedge, fovDegrees, startMove, startRotate, onPointerMove, endDrag, add, remove, select,
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
.light .beam { opacity: 0.16; }
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
