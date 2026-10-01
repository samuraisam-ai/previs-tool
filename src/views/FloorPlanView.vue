<template>
  <div class="plan">
    <div ref="area" class="canvas-area">
      <PlanToolbar :tool="editor.tool" @tool="setTool" @add="onAdd" @undo="undo" @redo="redo" @fit="fit" @capture="capture" @line="lineToggle" />
      <LightLibrary v-if="showLibrary" @pick="addLight" @close="showLibrary = false" />
      <PropLibrary v-if="showProps" @pick="addPropPicked" @close="showProps = false" />

      <!-- SVG units are metres. svg y = -world z, so "up" on the plan is +z in 3D. -->
      <svg
        ref="svg"
        :viewBox="viewBox"
        :class="['canvas', `tool-${editor.tool}`, { panning: panning }]"
        @pointerdown="onDown"
        @pointermove="onMove"
        @pointerup="onUp"
        @pointercancel="onUp"
        @wheel.prevent="onWheel"
        @dblclick="onDouble"
        @contextmenu.prevent
      >
        <g class="grid" pointer-events="none">
          <line v-for="l in grid.lines" :key="l.k" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" :class="{ major: l.major }" />
        </g>
        <ArchLayer :px="px" />
        <LineLayer :px="px" part="under" />
        <PropLayer :px="px" />
        <MarkLayer :px="px" />
        <ItemLayer :px="px" />
        <LineLayer :px="px" part="over" />
        <OverlayLayer :px="px" :marquee="marqueeRect" />
      </svg>

      <div class="scalebar" :style="{ width: `${scaleBar.px}px` }"><span>{{ scaleBar.label }}</span></div>
      <div class="hint">{{ hint }}</div>
      <BlockingBar />
    </div>

    <aside class="panel plan-panel">
      <ItemPanel v-if="panel === 'item'" :id="editor.selection[0]" />
      <WallPanel v-else-if="panel === 'wall'" :id="editor.selection[0]" />
      <OpeningPanel v-else-if="panel === 'opening'" :id="editor.selection[0]" />
      <SelectionPanel v-else-if="panel === 'selection'" :ids="editor.selection" />
      <LineOfActionPanel v-else-if="panel === 'line'" />
      <PropPanel v-else-if="panel === 'prop'" :key="editor.selection.join()" :ids="editor.selection" />
      <div v-else class="panel-body">
        <h4>Floor plan</h4>
        <p class="readout">
          <b>Room (R)</b>: drag a rectangle. <b>Wall (W)</b>: click to place, then drag its ends or side handle.
          <b>Door (D) / Window (N) / Doorway (O)</b>: click on a wall. <b>Measure (M)</b>: drag between two points.
        </p>
        <p class="readout">
          Select to move; Shift-click or drag a box to select several. Use the box handles to rotate and scale,
          arrow keys to nudge (Shift ×10), ⌘D duplicate, ⌘C/⌘V copy/paste, Delete to remove, ⌘Z undo.
          Scroll to zoom. <b>H</b> (hand) drags the map; right-drag or Space-drag pans from any tool; <b>V</b> back to the pointer.
          <b>C</b> captures the setup (plan + light and camera legend) into a production.
          <b>K</b> places blocking T marks for the selected subject or camera; <b>P</b> plays the blocking. <b>L</b> shows the 180° line.
        </p>
        <h4 class="section">Snapping</h4>
        <label class="check"><input type="checkbox" v-model="editor.snap.grid" /> Grid</label>
        <label>Grid step
          <select v-model.number="editor.snap.gridSize">
            <option :value="0.01">1 cm</option>
            <option :value="0.05">5 cm</option>
            <option :value="0.1">10 cm</option>
            <option :value="0.25">25 cm</option>
            <option :value="0.5">50 cm</option>
          </select>
        </label>
        <label class="check"><input type="checkbox" v-model="editor.snap.objects" /> Wall ends &amp; corners</label>
        <p class="readout">Hold Alt while dragging to place freely.</p>
        <WorldPanel />
      </div>
    </aside>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import LightLibrary from '../components/LightLibrary.vue'
import PlanToolbar from '../plan/PlanToolbar.vue'
import LineLayer from '../plan/LineLayer.vue'
import MarkLayer from '../plan/MarkLayer.vue'
import PropLayer from '../plan/PropLayer.vue'
import PropLibrary from '../props/PropLibrary.vue'
import PropPanel from '../plan/panels/PropPanel.vue'
import { addProp } from '../props/add'
import BlockingBar from '../plan/BlockingBar.vue'
import { playback, stop as stopPlayback, togglePlay } from '../plan/blocking'
import { addMark, canHaveMarks, deleteMark, headingTo, setMarkHeading, setMarkPosition } from '../plan/marks'
import { createLine, dropLineEnd, LINE_ID, moveLineEnd, removeLine, subjectNear, toggleLine } from '../plan/lineOfAction'
import LineOfActionPanel from '../plan/panels/LineOfActionPanel.vue'
import WorldPanel from '../plan/panels/WorldPanel.vue'
import { requestCapture } from '../setups/capture'
import { capturePlan } from '../setups/capturePlan'
import { initSetups } from '../setups/store'
import ArchLayer from '../plan/ArchLayer.vue'
import ItemLayer from '../plan/ItemLayer.vue'
import OverlayLayer from '../plan/OverlayLayer.vue'
import ItemPanel from '../plan/panels/ItemPanel.vue'
import OpeningPanel from '../plan/panels/OpeningPanel.vue'
import SelectionPanel from '../plan/panels/SelectionPanel.vue'
import WallPanel from '../plan/panels/WallPanel.vue'
import { clearSelection, editor, isSelected, OPENING_TOOLS, setSelection, toggleSelection, Tool } from '../plan/editor'
import { add as addPt, boundsOf, dist, projectOnWall, round3, snapAngle, snapToGrid, sub } from '../plan/geometry'
import { redo, startHistory, undo } from '../plan/history'
import {
  addOpening, addRoomRect, addWallAt, applyTransform, beginEndpointDrag, beginTransform, clampOffset, copySelection,
  deleteIds, duplicateSelection, expandSelection, getEntity, getWall, moveEndpoint, nearestPoint, nearestWall,
  nudgeSelection, openingDefaults, openingFits, pasteClipboard, rotateAbout, scaleAbout, selectionBounds,
  selectionPoints, slideOpenings, snapCandidates, toggleDoor, TransformSession, translate
} from '../plan/ops'
import { addItem, getItem, scene } from '../scene/store'
import { ItemKind, Pt, SceneItem, Wall } from '../scene/types'

type Gesture =
  | { type: 'pan'; sx: number; sy: number; cx: number; cz: number }
  | { type: 'move'; start: Pt; ids: string[]; session: TransformSession | null; clickId: string | null }
  | { type: 'marquee'; a: Pt; b: Pt; additive: boolean }
  | { type: 'rotate'; pivot: Pt; start: number; session: TransformSession }
  | { type: 'scale'; handle: string; anchor: Pt; ref: Pt; session: TransformSession; w: number; d: number }
  | { type: 'wallEnd'; wall: Wall; fixed: Pt; session: TransformSession }
  | { type: 'wallThick'; wall: Wall }
  | { type: 'aim'; item: SceneItem }
  | { type: 'room'; a: Pt }
  | { type: 'measure' }
  | { type: 'loaEnd'; end: 'a' | 'b' }
  | { type: 'markMove'; id: string }
  | { type: 'markAim'; id: string }

const KEY_TOOLS: Record<string, Tool> = { v: 'select', h: 'pan', r: 'room', w: 'wall', d: 'door', n: 'window', o: 'opening', m: 'measure' }
const HINTS: Record<Tool, string> = {
  select: 'Click to select · drag to move · Shift-click / drag a box for several · handles rotate & scale · Alt = no snapping',
  pan: 'Hand: drag anywhere to move the map · scroll to zoom · V for the pointer',
  marks: 'Blocking: click a subject or camera, then click on the plan to drop T marks 1, 2, 3… in order · drag a mark to move it, its handle to turn it · Esc when done',
  line: 'Click the two points the 180° line runs through (click on a subject to attach the end to it).',
  room: 'Drag a rectangle to create a room (walls + floor). Rooms drawn against each other share a wall.',
  wall: 'Click to place a 3 m wall, then drag its round ends to lengthen/turn it and the square handle to thicken it.',
  door: 'Hover a wall and click to add a door. Double-click a door to open/close it.',
  window: 'Hover a wall and click to add a window.',
  opening: 'Hover a wall and click to add a doorway (an opening with no door).',
  measure: 'Drag between two points to measure. Snaps to wall ends and corners.'
}
const SNAP_PX = 10

export default defineComponent({
  name: 'FloorPlanView',
  components: { ArchLayer, ItemLayer, OverlayLayer, ItemPanel, WallPanel, OpeningPanel, SelectionPanel, LightLibrary, PlanToolbar, LineLayer, LineOfActionPanel, WorldPanel, MarkLayer, BlockingBar, PropLayer, PropLibrary, PropPanel },
  props: {
    active: { type: Boolean, default: true }
  },
  setup(props) {
    const svg = ref<SVGSVGElement | null>(null)
    const area = ref<HTMLDivElement | null>(null)
    const showLibrary = ref(false)
    const panning = ref(false)
    let spaceHeld = false
    let gesture: Gesture | null = null
    // What was under the pointer on the last press (pointer capture retargets dblclick to the svg).
    let lastDownId: string | null = null
    const marquee = ref<{ a: Pt; b: Pt } | null>(null)
    // First click of the 180° line tool.
    const lineStart = ref<Pt | null>(null)

    // ── Viewport ──────────────────────────────────────────────────────────
    const px = computed(() => 1 / editor.view.scale)
    const viewBox = computed(() => {
      const { cx, cz, scale } = editor.view
      const w = editor.size.w / scale
      const h = editor.size.h / scale
      return `${cx - w / 2} ${-cz - h / 2} ${w} ${h}`
    })
    const grid = computed(() => {
      const { cx, cz, scale } = editor.view
      const w = editor.size.w / scale
      const h = editor.size.h / scale
      const steps = [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50, 100]
      const minor = steps.find(s => s * scale >= 12) ?? 100
      const major = minor < 1 ? 1 : minor * 5
      const x0 = cx - w / 2
      const x1 = cx + w / 2
      const y0 = -cz - h / 2
      const y1 = -cz + h / 2
      const lines: Array<{ k: string; x1: number; y1: number; x2: number; y2: number; major: boolean }> = []
      for (let x = Math.ceil(x0 / minor) * minor; x <= x1 && lines.length < 600; x += minor) {
        const r = round3(x)
        lines.push({ k: `x${r}`, x1: r, y1: y0, x2: r, y2: y1, major: Math.abs(r / major - Math.round(r / major)) < 1e-6 })
      }
      for (let y = Math.ceil(y0 / minor) * minor; y <= y1 && lines.length < 1200; y += minor) {
        const r = round3(y)
        lines.push({ k: `y${r}`, x1: x0, y1: r, x2: x1, y2: r, major: Math.abs(r / major - Math.round(r / major)) < 1e-6 })
      }
      return { lines }
    })
    const scaleBar = computed(() => {
      const options = [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100]
      const L = options.find(v => v * editor.view.scale >= 70) ?? 100
      return { px: L * editor.view.scale, label: L < 1 ? `${Math.round(L * 100)} cm` : `${L} m` }
    })

    const toWorld = (event: { clientX: number; clientY: number }): Pt => {
      const el = svg.value as SVGSVGElement
      const point = el.createSVGPoint()
      point.x = event.clientX
      point.y = event.clientY
      const local = point.matrixTransform((el.getScreenCTM() as DOMMatrix).inverse())
      return { x: local.x, z: -local.y }
    }

    const fit = () => {
      const pts: Pt[] = [...scene.walls.flatMap(w => [w.a, w.b]), ...scene.rooms.flatMap(r => r.points), ...scene.items.map(i => ({ x: i.x, z: i.z }))]
      const b = boundsOf(pts)
      if (!b) return
      // Leave room for the toolbar across the top.
      const top = 110
      const w = Math.max(b.maxX - b.minX, 1) + 1.5
      const d = Math.max(b.maxZ - b.minZ, 1) + 1.5
      editor.view.scale = Math.min(editor.size.w / w, (editor.size.h - top) / d, 400)
      editor.view.cx = (b.minX + b.maxX) / 2
      editor.view.cz = (b.minZ + b.maxZ) / 2 + top / 2 / editor.view.scale
    }

    const onWheel = (event: WheelEvent) => {
      const before = toWorld(event)
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.0015))
      editor.view.scale = Math.min(800, Math.max(4, editor.view.scale * factor))
      // Keep the point under the cursor fixed.
      const after = toWorld(event)
      editor.view.cx += before.x - after.x
      editor.view.cz += before.z - after.z
    }

    // ── Snapping ──────────────────────────────────────────────────────────
    const snapPoint = (p: Pt, opts: { exclude?: Set<string>; from?: Pt; free?: boolean; coarseAngle?: boolean } = {}): Pt => {
      editor.snapPoint = null
      if (opts.free) return p
      if (editor.snap.objects) {
        const hit = nearestPoint(p, snapCandidates(opts.exclude), SNAP_PX * px.value)
        if (hit) {
          editor.snapPoint = hit
          return { ...hit }
        }
      }
      let q = p
      if (opts.from) {
        q = snapAngle(opts.from, p, opts.coarseAngle ? 45 : editor.snap.angle)
        if (editor.snap.grid) {
          const L = Math.round(dist(opts.from, q) / editor.snap.gridSize) * editor.snap.gridSize
          const d = dist(opts.from, q) || 1
          q = { x: opts.from.x + ((q.x - opts.from.x) / d) * L, z: opts.from.z + ((q.z - opts.from.z) / d) * L }
        }
        return { x: round3(q.x), z: round3(q.z) }
      }
      return editor.snap.grid ? snapToGrid(q, editor.snap.gridSize) : q
    }

    // Snap a move delta: pull a moved corner onto a nearby wall end/corner, else round to the grid.
    const snapDelta = (session: TransformSession, delta: Pt, free: boolean): Pt => {
      editor.snapPoint = null
      if (free) return delta
      if (editor.snap.objects) {
        const exclude = new Set(session.ids)
        const cands = snapCandidates(exclude)
        let best: { d: number; adjust: Pt; at: Pt } | null = null
        const origins: Pt[] = []
        session.walls.forEach(w => origins.push(w.a, w.b))
        session.rooms.forEach(pts => origins.push(...pts))
        origins.forEach(o => {
          const moved = addPt(o, delta)
          const hit = nearestPoint(moved, cands, SNAP_PX * px.value)
          if (hit) {
            const d = dist(moved, hit)
            if (!best || d < best.d) best = { d, adjust: sub(hit, moved), at: hit }
          }
        })
        if (best) {
          const b = best as { d: number; adjust: Pt; at: Pt }
          editor.snapPoint = b.at
          return addPt(delta, b.adjust)
        }
      }
      if (!editor.snap.grid) return delta
      const g = editor.snap.gridSize
      return { x: Math.round(delta.x / g) * g, z: Math.round(delta.z / g) * g }
    }

    // ── Tools & pointer ───────────────────────────────────────────────────
    const setTool = (tool: Tool) => {
      editor.tool = tool
      editor.openingPreview = null
      editor.draft = null
      editor.snapPoint = null
      lineStart.value = null
      if (tool !== 'measure') editor.measure = null
      if (tool === 'marks') {
        const sel = editor.selection.length === 1 ? getItem(editor.selection[0]) : undefined
        editor.markOwner = canHaveMarks(sel) && sel ? sel.id : editor.markOwner
      } else editor.markOwner = null
    }

    const entitiesIn = (a: Pt, b: Pt): string[] => {
      const minX = Math.min(a.x, b.x)
      const maxX = Math.max(a.x, b.x)
      const minZ = Math.min(a.z, b.z)
      const maxZ = Math.max(a.z, b.z)
      const inside = (p: Pt) => p.x >= minX && p.x <= maxX && p.z >= minZ && p.z <= maxZ
      const all = [...scene.walls, ...scene.openings, ...scene.rooms, ...scene.items].map(e => e.id)
      return all.filter(id => {
        const pts = selectionPoints([id])
        return pts.length > 0 && pts.every(inside)
      })
    }

    const onDown = (event: PointerEvent) => {
      const el = svg.value as SVGSVGElement
      el.setPointerCapture(event.pointerId)
      const p = toWorld(event)
      const panGesture = event.button === 1 || event.button === 2 || spaceHeld || editor.tool === 'pan'
      // Editing while blocking plays: stop the preview so what you edit is what you see.
      if (playback.active && !panGesture) stopPlayback()
      if (panGesture) {
        gesture = { type: 'pan', sx: event.clientX, sy: event.clientY, cx: editor.view.cx, cz: editor.view.cz }
        panning.value = true
        return
      }
      const target = event.target as Element
      const handle = target.closest('[data-handle]')?.getAttribute('data-handle')
      const id = target.closest('[data-id]')?.getAttribute('data-id') ?? null
      lastDownId = id
      const free = event.altKey

      switch (editor.tool) {
        case 'wall': {
          addWallAt(snapPoint(p, { free }))
          setTool('select')
          return
        }
        case 'room':
          gesture = { type: 'room', a: snapPoint(p, { free }) }
          editor.draft = { a: gesture.a, b: gesture.a }
          return
        case 'measure': {
          const a = snapPoint(p, { free })
          editor.measure = { a, b: a, done: false }
          gesture = { type: 'measure' }
          return
        }
        case 'marks': {
          if (handle === 'mark' || handle === 'mark-aim') break
          const clicked = id ? getItem(id) : undefined
          if (canHaveMarks(clicked) && clicked) {
            editor.markOwner = clicked.id
            setSelection([clicked.id])
            return
          }
          if (editor.markOwner) {
            const mark = addMark(editor.markOwner, snapPoint(p, { free }))
            if (mark) editor.activeMark = mark.id
          }
          return
        }
        case 'line': {
          const q = snapPoint(p, { free })
          if (!lineStart.value) lineStart.value = q
          else {
            const a = lineStart.value
            lineStart.value = null
            if (dist(a, q) > 0.1) {
              createLine(a, q, subjectNear(a), subjectNear(q))
              setTool('select')
              setSelection([LINE_ID])
            }
          }
          return
        }
        case 'door':
        case 'window':
        case 'opening': {
          const prev = editor.openingPreview
          if (prev && prev.fits) {
            addOpening(prev.kind, prev.wallId, prev.offset)
            setTool('select')
          }
          return
        }
      }

      // Select tool.
      if (handle) {
        const ids = expandSelection(editor.selection)
        const b = selectionBounds(ids)
        if (handle === 'rotate' && b) {
          const pivot = { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2 }
          gesture = { type: 'rotate', pivot, start: Math.atan2(p.x - pivot.x, p.z - pivot.z), session: beginTransform(ids) }
        } else if (handle.startsWith('scale-') && b) {
          const h = handle.slice(6)
          const ax = h.includes('w') ? b.maxX : h.includes('e') ? b.minX : (b.minX + b.maxX) / 2
          const az = h.includes('n') ? b.minZ : h.includes('s') ? b.maxZ : (b.minZ + b.maxZ) / 2
          const rx = h.includes('w') ? b.minX : h.includes('e') ? b.maxX : ax
          const rz = h.includes('n') ? b.maxZ : h.includes('s') ? b.minZ : az
          gesture = { type: 'scale', handle: h, anchor: { x: ax, z: az }, ref: { x: rx, z: rz }, session: beginTransform(ids), w: b.maxX - b.minX, d: b.maxZ - b.minZ }
        } else if (handle === 'wall-a' || handle === 'wall-b') {
          const wall = getWall(editor.selection[0])
          if (wall) {
            const end = handle === 'wall-a' ? 'a' : 'b'
            gesture = { type: 'wallEnd', wall, fixed: { ...(end === 'a' ? wall.b : wall.a) }, session: beginEndpointDrag(wall, end) }
          }
        } else if (handle === 'wall-thick') {
          const wall = getWall(editor.selection[0])
          if (wall) gesture = { type: 'wallThick', wall }
        } else if (handle === 'mark' || handle === 'mark-aim') {
          const markId = target.closest('[data-for]')?.getAttribute('data-for') ?? ''
          const mark = scene.marks.find(m => m.id === markId)
          if (mark) {
            editor.activeMark = mark.id
            if (!isSelected(mark.ownerId)) setSelection([mark.ownerId])
            gesture = handle === 'mark' ? { type: 'markMove', id: mark.id } : { type: 'markAim', id: mark.id }
          }
        } else if (handle === 'loa-a' || handle === 'loa-b') {
          gesture = { type: 'loaEnd', end: handle === 'loa-a' ? 'a' : 'b' }
        } else if (handle === 'aim') {
          const item = getItem(target.closest('[data-for]')?.getAttribute('data-for') ?? null)
          if (item) gesture = { type: 'aim', item }
        }
        if (gesture) editor.dragging = true
        return
      }
      editor.activeMark = null
      if (id) {
        if (event.shiftKey) {
          toggleSelection(id)
          return
        }
        const clickId = isSelected(id) ? id : null
        if (!isSelected(id)) setSelection([id])
        gesture = { type: 'move', start: p, ids: expandSelection(editor.selection), session: null, clickId }
        return
      }
      if (!event.shiftKey) clearSelection()
      gesture = { type: 'marquee', a: p, b: p, additive: event.shiftKey }
      marquee.value = { a: p, b: p }
    }

    const onMove = (event: PointerEvent) => {
      const p = toWorld(event)
      const free = event.altKey
      if (!gesture) {
        // Hover feedback for the placing tools.
        const kind = OPENING_TOOLS[editor.tool]
        if (kind) {
          const near = nearestWall(p, 0.5)
          if (near) {
            const width = openingDefaults(kind).width
            const offset = clampOffset(near.wall, near.along, width)
            editor.openingPreview = { wallId: near.wall.id, offset, kind, fits: openingFits(near.wall, offset, width) }
          } else editor.openingPreview = null
        } else if (editor.tool === 'wall' || editor.tool === 'room' || editor.tool === 'measure') {
          snapPoint(p, { free })
        }
        return
      }
      switch (gesture.type) {
        case 'pan': {
          const g = gesture
          editor.view.cx = g.cx - (event.clientX - g.sx) / editor.view.scale
          editor.view.cz = g.cz + (event.clientY - g.sy) / editor.view.scale
          break
        }
        case 'move': {
          const g = gesture
          const raw = sub(p, g.start)
          if (!g.session) {
            if (Math.hypot(raw.x, raw.z) * editor.view.scale < 3) return
            g.session = beginTransform(g.ids)
            editor.dragging = true
          }
          const delta = snapDelta(g.session, raw, free)
          applyTransform(g.session, translate(delta))
          slideOpenings(g.session, delta)
          editor.hud = { at: p, text: `Δ ${delta.x.toFixed(2)}, ${delta.z.toFixed(2)} m` }
          break
        }
        case 'marquee':
          gesture.b = p
          marquee.value = { a: gesture.a, b: p }
          break
        case 'rotate': {
          const g = gesture
          let deg = ((Math.atan2(p.x - g.pivot.x, p.z - g.pivot.z) - g.start) * 180) / Math.PI
          deg = ((deg + 540) % 360) - 180
          if (!event.shiftKey) deg = Math.round(deg / 15) * 15
          applyTransform(g.session, rotateAbout(g.pivot, deg), deg)
          editor.hud = { at: p, text: `${deg > 0 ? '+' : ''}${Math.round(deg)}°` }
          break
        }
        case 'scale': {
          const g = gesture
          const h = g.handle
          const grid = editor.snap.grid && !free ? editor.snap.gridSize : 0
          const size = (v: number) => (grid ? Math.max(grid, Math.round(v / grid) * grid) : Math.max(0.05, v))
          let sx = 1
          let sz = 1
          if (h.includes('e') || h.includes('w')) sx = size(Math.abs(p.x - g.anchor.x)) / Math.max(Math.abs(g.ref.x - g.anchor.x), 0.01)
          if (h.includes('n') || h.includes('s')) sz = size(Math.abs(p.z - g.anchor.z)) / Math.max(Math.abs(g.ref.z - g.anchor.z), 0.01)
          if (event.shiftKey && h.length === 2) { const u = Math.max(sx, sz); sx = u; sz = u }
          applyTransform(g.session, scaleAbout(g.anchor, sx, sz), 0, { sx, sz })
          editor.hud = { at: p, text: `${(g.w * sx).toFixed(2)} × ${(g.d * sz).toFixed(2)} m` }
          break
        }
        case 'markMove': {
          setMarkPosition(gesture.id, snapPoint(p, { free }))
          break
        }
        case 'markAim': {
          const mark = scene.marks.find(m => m.id === (gesture as { id: string }).id)
          if (mark) {
            const deg = headingTo(mark, p)
            setMarkHeading(mark.id, free || event.shiftKey ? deg : Math.round(deg / 15) * 15)
            editor.hud = { at: p, text: `${Math.round(((mark.rotationY % 360) + 360) % 360)}°` }
          }
          break
        }
        case 'loaEnd': {
          moveLineEnd(gesture.end, snapPoint(p, { free }))
          break
        }
        case 'wallEnd': {
          const g = gesture
          const q = snapPoint(p, { exclude: new Set([g.wall.id]), from: g.fixed, free, coarseAngle: event.shiftKey })
          moveEndpoint(g.session, q)
          editor.hud = { at: p, text: `${dist(g.fixed, q).toFixed(2)} m` }
          break
        }
        case 'wallThick': {
          const w = gesture.wall
          const off = Math.abs(projectOnWall(w, p).offset) - 16 * px.value
          w.thickness = Math.min(1, Math.max(0.03, Math.round(off * 2 * 100) / 100))
          editor.hud = { at: p, text: `${Math.round(w.thickness * 100)} cm thick` }
          break
        }
        case 'aim': {
          const item = gesture.item
          const angle = ((Math.atan2(p.x - item.x, p.z - item.z) * 180) / Math.PI + 360) % 360
          item.rotationY = Math.round(free ? angle : (Math.round(angle / 5) * 5) % 360)
          editor.hud = { at: p, text: `${item.rotationY}°` }
          break
        }
        case 'room': {
          const b = snapPoint(p, { free })
          editor.draft = { a: gesture.a, b }
          editor.hud = { at: p, text: `${Math.abs(b.x - gesture.a.x).toFixed(2)} × ${Math.abs(b.z - gesture.a.z).toFixed(2)} m` }
          break
        }
        case 'measure':
          if (editor.measure) editor.measure.b = snapPoint(p, { free })
          break
      }
    }

    const onUp = () => {
      const g = gesture
      gesture = null
      panning.value = false
      if (g?.type === 'move' && !g.session && g.clickId && editor.selection.length > 1) setSelection([g.clickId])
      if (g?.type === 'marquee') {
        const found = entitiesIn(g.a, g.b)
        setSelection(g.additive ? Array.from(new Set([...editor.selection, ...found])) : found)
      }
      if (g?.type === 'room' && editor.draft) {
        addRoomRect(editor.draft.a, editor.draft.b)
        editor.draft = null
        setTool('select')
      }
      if (g?.type === 'measure' && editor.measure) editor.measure.done = true
      if (g?.type === 'loaEnd') dropLineEnd(g.end)
      marquee.value = null
      editor.hud = null
      editor.snapPoint = null
      editor.dragging = false
    }

    const onDouble = () => {
      const e = getEntity(lastDownId)
      if (e?.kind === 'opening') toggleDoor(e.obj)
    }

    const marqueeRect = computed(() => {
      const m = marquee.value
      if (!m) return null
      return { x: Math.min(m.a.x, m.b.x), y: -Math.max(m.a.z, m.b.z), w: Math.abs(m.b.x - m.a.x), h: Math.abs(m.b.z - m.a.z) }
    })

    // ── Panels ────────────────────────────────────────────────────────────
    const panel = computed(() => {
      const sel = editor.selection
      if (!sel.length) return null
      // Props (one, or several of the same kind) get the prop panel.
      const first = getItem(sel[0])
      if (first?.kind === 'prop' && sel.every(id => { const i = getItem(id); return i?.kind === 'prop' && i.props.catalogId === first.props.catalogId })) return 'prop'
      if (sel.length > 1) return 'selection'
      if (sel[0] === LINE_ID) return 'line'
      const e = getEntity(sel[0])
      if (!e) return null
      return e.kind === 'item' ? 'item' : e.kind === 'wall' ? 'wall' : e.kind === 'opening' ? 'opening' : 'selection'
    })
    const hint = computed(() => HINTS[editor.tool])

    // ── Adding items ──────────────────────────────────────────────────────
    const placeInView = (item: SceneItem) => {
      item.x = round3(editor.view.cx)
      item.z = round3(editor.view.cz - 1)
      setSelection([item.id])
    }
    const add = (kind: Exclude<ItemKind, 'prop'>) => placeInView(addItem(kind))
    // From the Elements menu: subjects and cameras are added in view; Light opens the library.
    const onAdd = (kind: string) => {
      setTool('select')
      if (kind === 'light') { showProps.value = false; showLibrary.value = true }
      else if (kind === 'props') { showLibrary.value = false; showProps.value = true }
      else if (kind.startsWith('prop:')) addPropPicked(kind.slice(5))
      else if (kind === 'subject' || kind === 'camera') add(kind)
    }
    // Set dressing: the library stays open so several props can be added in a row.
    const showProps = ref(false)
    const addPropPicked = (defId: string) => {
      const prop = addProp(defId)
      if (prop) placeInView(prop)
    }
    const addLight = (fixtureId: string) => {
      placeInView(addItem('light', fixtureId))
      showLibrary.value = false
    }

    // ── Keyboard ──────────────────────────────────────────────────────────
    const onKey = (event: KeyboardEvent) => {
      if (!props.active) return
      // A dialog (capture, viewer) owns the keyboard while it's open.
      if (document.querySelector('[aria-modal="true"]')) return
      const target = event.target as HTMLElement
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)) return
      const mod = event.metaKey || event.ctrlKey
      const key = event.key.toLowerCase()
      if (key === ' ') { spaceHeld = true; event.preventDefault(); return }
      if (mod && key === 'z') { if (event.shiftKey) redo(); else undo(); event.preventDefault(); return }
      if (mod && key === 'y') { redo(); event.preventDefault(); return }
      if (mod && key === 'd') { duplicateSelection(editor.selection); event.preventDefault(); return }
      if (mod && key === 'c') { copySelection(editor.selection); return }
      if (mod && key === 'v') { pasteClipboard(); event.preventDefault(); return }
      if (mod && key === 'a') { setSelection([...scene.rooms, ...scene.walls, ...scene.openings, ...scene.items].map(e => e.id)); event.preventDefault(); return }
      if (mod) return
      if (key === 'escape') {
        showProps.value = false
        editor.activeMark = null
        setTool('select')
        editor.measure = null
        clearSelection()
        return
      }
      if (key === 'delete' || key === 'backspace') {
        if (editor.activeMark) { deleteMark(editor.activeMark); editor.activeMark = null }
        else if (editor.selection.includes(LINE_ID)) { removeLine(); clearSelection() }
        else if (editor.selection.length) deleteIds(editor.selection)
        event.preventDefault()
        return
      }
      if (key.startsWith('arrow') && editor.selection.length) {
        const step = event.altKey && event.shiftKey ? 1 : event.shiftKey ? 0.1 : 0.01
        const d = { x: key === 'arrowleft' ? -step : key === 'arrowright' ? step : 0, z: key === 'arrowup' ? step : key === 'arrowdown' ? -step : 0 }
        nudgeSelection(expandSelection(editor.selection), d)
        event.preventDefault()
        return
      }
      if (key === 'f') { fit(); return }
      if (key === 'c') { capture(); return }
      if (key === 'l') { lineToggle(); return }
      if (key === 'k') { setTool('marks'); return }
      if (key === 'j') { showLibrary.value = false; showProps.value = !showProps.value; return }
      if (key === 'p') { togglePlay(); return }
      const tool = KEY_TOOLS[key]
      if (tool) setTool(tool)
    }
    const onKeyUp = (event: KeyboardEvent) => { if (event.key === ' ') spaceHeld = false }

    let resizeObserver: ResizeObserver | null = null
    onMounted(() => {
      window.addEventListener('keydown', onKey)
      window.addEventListener('keyup', onKeyUp)
      // Track the canvas size; ignore zero sizes (hidden view) and fit once a real size is known.
      let fitted = false
      resizeObserver = new ResizeObserver(() => {
        const el = svg.value
        if (!el || !el.clientWidth || !el.clientHeight) return
        editor.size.w = el.clientWidth
        editor.size.h = el.clientHeight
        if (!fitted) {
          fitted = true
          fit()
        }
      })
      if (svg.value) resizeObserver.observe(svg.value)
      startHistory()
    })
    onBeforeUnmount(() => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKeyUp)
      resizeObserver?.disconnect()
    })

    // ── 180° line ─────────────────────────────────────────────────────────
    const lineToggle = () => {
      const result = toggleLine()
      if (result === 'need-points') setTool('line')
      else if (result === 'hidden' && editor.selection.includes(LINE_ID)) clearSelection()
    }

    // ── Capture to Setups ─────────────────────────────────────────────────
    let capturing = false
    const capture = async () => {
      if (capturing || !svg.value) return
      capturing = true
      try {
        await initSetups()
        requestCapture(await capturePlan(svg.value))
      } finally {
        capturing = false
      }
    }

    return {
      capture, lineToggle,
      svg, area, editor, setTool, showLibrary, showProps, addPropPicked, add, onAdd, addLight, undo, redo, fit, px, viewBox, grid, scaleBar,
      onDown, onMove, onUp, onWheel, onDouble, marqueeRect, panning, panel, hint
    }
  }
})
</script>

<style scoped>
.plan { display: flex; width: 100%; height: 100%; }
.canvas-area { position: relative; flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.canvas { flex: 1; width: 100%; min-height: 0; background: #15161a; user-select: none; touch-action: none; }
.canvas.tool-select { cursor: default; }
.canvas.tool-wall, .canvas.tool-room, .canvas.tool-measure { cursor: crosshair; }
.canvas.tool-door, .canvas.tool-window, .canvas.tool-opening { cursor: copy; }
.canvas.tool-pan { cursor: grab; }
.canvas.panning { cursor: grabbing; }
.grid line { stroke: #22242b; stroke-width: 1px; vector-effect: non-scaling-stroke; }
.grid line.major { stroke: #2f323b; }
.scalebar {
  position: absolute; left: 14px; bottom: 44px; height: 6px; border: 1px solid #8b8f99; border-top: none; pointer-events: none;
}
.scalebar span { position: absolute; left: 0; bottom: 8px; font-size: 11px; color: var(--muted); white-space: nowrap; }
.hint { padding: 8px 12px; font-size: 12px; color: var(--muted); border-top: 1px solid var(--line); }
.panel {
  width: 280px; flex-shrink: 0; padding: 16px; border-left: 1px solid var(--line); background: var(--panel);
  overflow-y: auto; font-size: 13px;
}
</style>

<style>
/* Shared styles for the plan's property panels (child components). */
.plan-panel .panel-body { display: flex; flex-direction: column; gap: 12px; }
.plan-panel h4 { margin: 0; font-size: 14px; }
.plan-panel label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); }
.plan-panel label > span { color: var(--text); }
.plan-panel label.check { flex-direction: row; align-items: center; gap: 6px; color: var(--text); }
.plan-panel input:not([type='range']):not([type='color']):not([type='checkbox']), .plan-panel select { width: 100%; box-sizing: border-box; }
.plan-panel .row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: end; }
.plan-panel .field { display: flex; flex-direction: column; gap: 6px; }
.plan-panel .field.centred { align-items: center; }
.plan-panel .caption { color: var(--muted); align-self: flex-start; }
.plan-panel .angle-row { display: flex; align-items: center; gap: 12px; }
.plan-panel .rot-buttons { display: flex; flex-direction: column; gap: 6px; flex: 1; }
.plan-panel .actions { display: flex; gap: 8px; }
.plan-panel .actions button { flex: 1; }
.plan-panel .modes { display: flex; gap: 4px; }
.plan-panel .modes button { flex: 1; font-size: 12px; }
.plan-panel .modes button.on, .plan-panel .toggle.on { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.plan-panel .readout { color: var(--muted); font-size: 12px; line-height: 1.5; margin: 0; }
.plan-panel .section { margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
.plan-panel .danger { color: #ff8a80; }
.plan-panel .meter-total { display: flex; flex-direction: column; gap: 2px; }
.plan-panel .meter-total strong { font-size: 20px; }
.plan-panel .meter-total span, .plan-panel .meter-row span { color: var(--muted); }
.plan-panel .meter-vs { font-size: 12px; padding: 4px 8px; border-radius: 4px; background: #23252c; }
.plan-panel .meter-vs.good { color: #8fdc8f; }
.plan-panel .meter-vs.over { color: #ffb547; }
.plan-panel .meter-vs.under { color: #7fb2ff; }
.plan-panel .meter-row { display: flex; align-items: center; gap: 6px; font-size: 12px; }
.plan-panel .meter-row span { margin-left: auto; }
.plan-panel .swatch { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
.plan-panel .exposure { display: flex; gap: 8px; }
.plan-panel .exposure label { flex: 1; }
</style>
