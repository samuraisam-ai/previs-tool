import { watch } from 'vue'
import { reserveIds, scene } from '../scene/store'
import { editor, setSelection } from './editor'

// Undo/redo for everything you build on the plan: snapshots of the document's content, taken once
// the scene has been quiet for a moment (so a drag or a burst of typing is one step).

const LIMIT = 100
const past: string[] = []
const future: string[] = []
let present = ''
let restoring = false
let timer: number | undefined

const snapshot = () => JSON.stringify({
  walls: scene.walls, openings: scene.openings, rooms: scene.rooms, items: scene.items
})

export function commit(): void {
  if (restoring) return
  const now = snapshot()
  if (now === present) return
  if (present) past.push(present)
  if (past.length > LIMIT) past.shift()
  present = now
  future.length = 0
}

function restore(state: string): void {
  restoring = true
  const doc = JSON.parse(state)
  scene.walls.splice(0, scene.walls.length, ...doc.walls)
  scene.openings.splice(0, scene.openings.length, ...doc.openings)
  scene.rooms.splice(0, scene.rooms.length, ...doc.rooms)
  scene.items.splice(0, scene.items.length, ...doc.items)
  const exists = (id: string) => [...scene.walls, ...scene.openings, ...scene.rooms, ...scene.items].some(e => e.id === id)
  setSelection(editor.selection.filter(exists))
  if (scene.activeCameraId && !exists(scene.activeCameraId)) scene.activeCameraId = scene.items.find(i => i.kind === 'camera')?.id ?? null
  present = state
  // Let the resulting watcher run before accepting new commits.
  setTimeout(() => { restoring = false }, 0)
}

export function undo(): void {
  commit()
  const prev = past.pop()
  if (!prev) return
  future.push(present)
  restore(prev)
}

export function redo(): void {
  const next = future.pop()
  if (!next) return
  past.push(present)
  restore(next)
}

export const canUndo = () => past.length > 0
export const canRedo = () => future.length > 0

export function startHistory(): void {
  present = snapshot()
  watch(() => [scene.walls, scene.openings, scene.rooms, scene.items], () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => { if (!editor.dragging) commit() }, 350)
  }, { deep: true })
  watch(() => editor.dragging, dragging => { if (!dragging) commit() })
}

// A whole scene as saved with a setup capture: content plus the lighting context.
export function snapshotScene(): string {
  return JSON.stringify({
    walls: scene.walls, openings: scene.openings, rooms: scene.rooms, items: scene.items,
    ambientLux: scene.ambientLux, activeCameraId: scene.activeCameraId
  })
}

// Replace the current scene with a saved one, as a single undoable step.
export function loadScene(json: string): void {
  commit()
  const doc = JSON.parse(json)
  reserveIds([...doc.walls, ...doc.openings, ...doc.rooms, ...doc.items].map((e: { id: string }) => e.id))
  scene.walls.splice(0, scene.walls.length, ...doc.walls)
  scene.openings.splice(0, scene.openings.length, ...doc.openings)
  scene.rooms.splice(0, scene.rooms.length, ...doc.rooms)
  scene.items.splice(0, scene.items.length, ...doc.items)
  if (typeof doc.ambientLux === 'number') scene.ambientLux = doc.ambientLux
  scene.activeCameraId = doc.activeCameraId ?? scene.items.find(i => i.kind === 'camera')?.id ?? null
  setSelection([])
  commit()
}
