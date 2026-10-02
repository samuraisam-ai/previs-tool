<template>
  <g class="items">
    <g
      v-for="item in items"
      :key="item.id"
      :transform="`translate(${item.x} ${-item.z})`"
      :class="['item', item.kind, { selected: isSelected(item.id), practical: isPractical(item) }]"
      :data-id="isPractical(item) ? undefined : item.id"
      :pointer-events="isPractical(item) ? 'none' : undefined"
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
          <g class="fixture">
            <circle class="hit" r="0.25" />
            <path v-for="(part, i) in visuals[item.id].parts" :key="i" :d="part.d" :class="part.glow ? 'glow' : 'body'" :fill="part.glow ? visuals[item.id].hex : undefined" />
          </g>
        </template>

        <template v-else-if="item.kind === 'camera'">
          <path class="fov" :d="wedge(camViews[item.id].fov, camViews[item.id].length)" pointer-events="none" />
          <path class="dof" :d="camViews[item.id].dofPath" pointer-events="none" />
          <path class="focus-arc" :d="camViews[item.id].focusPath" pointer-events="none" />
          <circle v-if="crossesLine(item)" class="cross-ring" r="0.36"><title>This camera crosses the 180° line</title></circle>
          <rect class="body" x="-0.14" y="-0.1" width="0.28" height="0.24" rx="0.03" />
          <rect class="lens" x="-0.07" y="-0.2" width="0.14" height="0.1" />
        </template>

        <template v-else>
          <circle class="body" r="0.22" />
          <path class="nose" d="M -0.08 -0.2 L 0 -0.32 L 0.08 -0.2 Z" pointer-events="none" />
        </template>

        <!-- Aim handle for a single selected item -->
        <g v-if="single === item.id" class="rotate-handle">
          <line x1="0" y1="-0.25" x2="0" y2="-0.6" pointer-events="none" />
          <circle cy="-0.66" :r="7 * px" data-handle="aim" :data-for="item.id" />
        </g>
      </g>
      <text v-if="!isPractical(item)" class="label" :y="0.3 + 12 * px" :font-size="11 * px" text-anchor="middle" pointer-events="none">
        {{ item.name }}{{ item.kind === 'camera' ? ` · ${camViews[item.id].lensMm}mm` : '' }}
      </text>
      <text v-if="(item.kind === 'camera' || item.kind === 'light') && item.props.tilt" class="tilt-label" :y="0.3 + 25 * px" :font-size="10 * px" text-anchor="middle" pointer-events="none">
        {{ Math.abs(item.props.tilt) }}° {{ item.props.tilt > 0 ? 'down' : 'up' }}
      </text>
    </g>
  </g>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { getLens } from '../library/lenses'
import { dofLimits, focusDistance, horizontalFov } from '../library/optics'
import { ResolvedLight, resolveLight } from '../library/photometry'
import { scene } from '../scene/store'
import { CameraItem, LightItem } from '../scene/types'
import { editor, isSelected } from './editor'
import { crossesLine } from './lineOfAction'
import { playback, posed } from './blocking'

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

// Wedge pointing "up" (-y) with the given full angle in degrees.
const wedge = (angle: number, length: number) => {
  const half = (Math.min(angle, 179) / 2) * Math.PI / 180
  const x = Math.sin(half) * length
  const y = -Math.cos(half) * length
  return `M 0 0 L ${x} ${y} A ${length} ${length} 0 0 0 ${-x} ${y} Z`
}
// Annular sector facing up between radii r1 and r2 over the full angle (deg).
const band = (angle: number, r1: number, r2: number) => {
  const h = (angle / 2) * Math.PI / 180
  const pt = (r: number, a: number) => `${r * Math.sin(a)} ${-r * Math.cos(a)}`
  return `M ${pt(r1, -h)} A ${r1} ${r1} 0 0 1 ${pt(r1, h)} L ${pt(r2, h)} A ${r2} ${r2} 0 0 0 ${pt(r2, -h)} Z`
}
const arc = (angle: number, r: number) => {
  const h = (angle / 2) * Math.PI / 180
  return `M ${r * Math.sin(-h)} ${-r * Math.cos(-h)} A ${r} ${r} 0 0 1 ${r * Math.sin(h)} ${-r * Math.cos(h)}`
}

export default defineComponent({
  name: 'ItemLayer',
  props: {
    // Plan metres per screen pixel, for zoom-independent label and handle sizes.
    px: { type: Number, required: true }
  },
  setup() {
    // Drawn at their blocking pose while playback runs.
    // Props are drawn by PropLayer, underneath.
    const items = computed(() => scene.items.filter(i => i.kind !== 'prop').map(i => (playback.active ? posed(i) : i)))
    const single = computed(() => (editor.selection.length === 1 ? editor.selection[0] : null))
    const cameraList = computed(() => scene.items.filter((item): item is CameraItem => item.kind === 'camera'))
    const lights = computed(() => scene.items.filter((item): item is LightItem => item.kind === 'light'))

    // Camera footprint on the plan: true horizontal FOV, focus distance and depth of field
    // (distances along the lens axis, projected onto the floor).
    const camViews = computed(() => {
      const result: Record<string, { fov: number; length: number; lensMm: number; focusPath: string; dofPath: string }> = {}
      cameraList.value.forEach(cam => {
        const fov = horizontalFov(cam.props) * 180 / Math.PI
        const flat = Math.cos(cam.props.tilt * Math.PI / 180)
        const focus = focusDistance(cam, scene)
        const { near, far } = dofLimits(cam.props, focus)
        const length = Math.min(9, Math.max(3, focus * flat * 1.8))
        result[cam.id] = {
          fov,
          length,
          lensMm: getLens(cam.props.lensId).focalLength,
          focusPath: arc(fov, focus * flat),
          dofPath: band(fov, Math.max(near * flat, 0.05), Math.min(far * flat, length))
        }
      })
      return result
    })

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

    // A lamp's bulb is part of the lamp on the plan: clicks go through to the lamp.
    const isPractical = (item: { kind: string; attachedTo?: string }) => item.kind === 'light' && !!item.attachedTo
    return { items, single, camViews, visuals, wedge, isSelected, crossesLine, isPractical }
  }
})
</script>

<style scoped>
.item { cursor: grab; }
.label { fill: #d7d9de; }
.tilt-label { fill: var(--muted); }
.item .body { stroke: #0d0e11; stroke-width: 0.02; }
.item.selected .body { stroke: var(--accent); stroke-width: 0.04; }
.subject .body { fill: #c89f82; }
.subject .nose { fill: #c89f82; }
.light .beam { opacity: 0.12; stroke: none; }
.light .beam.hard { opacity: 0.2; stroke-width: 0.02; stroke-opacity: 0.8; }
.light .fixture .hit { fill: transparent; }
.light .fixture .body { fill: #3a3d46; stroke: #0d0e11; stroke-width: 0.015; }
.light .fixture .glow { stroke: #0d0e11; stroke-width: 0.01; }
.light.selected .fixture .body { stroke: var(--accent); stroke-width: 0.03; }
.camera .body, .camera .lens { fill: #8a8f9c; }
.cross-ring { fill: rgba(255, 59, 48, 0.15); stroke: #ff3b30; stroke-width: 2px; vector-effect: non-scaling-stroke; }
.camera .dof { fill: rgba(120, 170, 255, 0.13); }
.camera .focus-arc { fill: none; stroke: #ffb547; stroke-width: 0.025; }
.camera .fov { fill: rgba(120, 170, 255, 0.07); stroke: rgba(120, 170, 255, 0.6); stroke-width: 0.015; stroke-dasharray: 0.08 0.06; }
.rotate-handle line { stroke: var(--accent); stroke-width: 0.02; }
.rotate-handle circle { fill: var(--accent); cursor: crosshair; }
.item.practical .fixture { transform: scale(0.45); opacity: 0.85; }
.item.practical .beam { opacity: 0.5; }
</style>
