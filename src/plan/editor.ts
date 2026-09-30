import { reactive } from 'vue'
import { scene } from '../scene/store'
import { OpeningKind, Pt } from '../scene/types'

// UI state of the Floor Plan editor (not part of the scene document, not undoable).

export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'opening' | 'measure'

export const OPENING_TOOLS: Record<string, OpeningKind> = { door: 'door', window: 'window', opening: 'opening' }

export interface OpeningPreview {
  wallId: string
  offset: number
  kind: OpeningKind
  fits: boolean
}

export const editor = reactive({
  tool: 'select' as Tool,
  selection: [] as string[],
  // Viewport: centre of the view in plan metres and zoom in screen px per metre.
  view: { cx: 0, cz: 0, scale: 80 },
  size: { w: 800, h: 600 },
  snap: { grid: true, gridSize: 0.1, objects: true, angle: 15 },
  // Room rectangle being dragged, or the tape measure.
  draft: null as { a: Pt; b: Pt } | null,
  measure: null as { a: Pt; b: Pt; done: boolean } | null,
  openingPreview: null as OpeningPreview | null,
  snapPoint: null as Pt | null,
  // Live readout next to the pointer while dragging (length, angle, size).
  hud: null as { at: Pt; text: string } | null,
  // True while a pointer drag is in progress (history waits until it ends).
  dragging: false,
  // Orbit view shows walls cut at hip height so you can see in.
  cutaway: true
})

export function isSelected(id: string): boolean {
  return editor.selection.includes(id)
}

export function setSelection(ids: string[]): void {
  editor.selection.splice(0, editor.selection.length, ...ids)
  scene.selectedId = ids.length ? ids[ids.length - 1] : null
}

export function toggleSelection(id: string): void {
  const i = editor.selection.indexOf(id)
  if (i >= 0) editor.selection.splice(i, 1)
  else editor.selection.push(id)
  scene.selectedId = editor.selection.length ? editor.selection[editor.selection.length - 1] : null
}

export function clearSelection(): void {
  setSelection([])
}
