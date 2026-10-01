import { getItem, newId, scene } from '../scene/store'
import { Mark, MarkPace, Pt, SceneItem } from '../scene/types'
import { round3 } from './geometry'
import { editor } from './editor'
import { commit } from './history'

// Blocking: numbered T marks per subject or camera, walked in order.

// One undo step: capture pending edits, apply, capture the result.
function step<T>(action: () => T): T {
  commit()
  const result = action()
  commit()
  return result
}

// Owner colours: subjects get warm/bright tape colours, cameras cooler ones (as on set).
const SUBJECT_COLOURS = ['#ffb547', '#ff6fb5', '#7ee07e', '#ffe14d', '#c49bff', '#ff8a5c']
const CAMERA_COLOURS = ['#4cc3ff', '#5cf2d6', '#8fa8ff', '#b0e0ff']

export function ownerColour(ownerId: string): string {
  const owner = getItem(ownerId)
  const list = scene.items.filter(i => i.kind === owner?.kind)
  const i = Math.max(0, list.findIndex(o => o.id === ownerId))
  const palette = owner?.kind === 'camera' ? CAMERA_COLOURS : SUBJECT_COLOURS
  return palette[i % palette.length]
}

export const canHaveMarks = (item: SceneItem | undefined): boolean => !!item && (item.kind === 'subject' || item.kind === 'camera')

export function marksOf(ownerId: string): Mark[] {
  return scene.marks.filter(m => m.ownerId === ownerId).sort((a, b) => a.order - b.order)
}

export function owners(): SceneItem[] {
  const ids = new Set(scene.marks.map(m => m.ownerId))
  return scene.items.filter(i => ids.has(i.id))
}

// Heading (items' rotationY convention: 0 = +z, clockwise on the plan) from one point to another.
export function headingTo(from: Pt, to: Pt): number {
  return round3((Math.atan2(to.x - from.x, to.z - from.z) * 180) / Math.PI)
}

export function addMark(ownerId: string, p: Pt): Mark | null {
  const owner = getItem(ownerId)
  if (!canHaveMarks(owner) || !owner) return null
  return step(() => {
    const list = marksOf(ownerId)
    const prev = list.length ? list[list.length - 1] : { x: owner.x, z: owner.z, rotationY: owner.rotationY }
    // People arrive facing the way they walked; a camera keeps its aim (a dolly, not a turn).
    // Either can be adjusted with the mark's aim handle.
    const rotationY = owner.kind === 'camera' ? prev.rotationY : headingTo(prev, p)
    const mark: Mark = {
      id: newId('mark'), ownerId, order: list.length + 1, x: round3(p.x), z: round3(p.z),
      rotationY, note: '', hold: 1, pace: 'normal'
    }
    scene.marks.push(mark)
    return scene.marks[scene.marks.length - 1]
  })
}

const getMark = (id: string) => scene.marks.find(m => m.id === id)

function renumber(ownerId: string): void {
  marksOf(ownerId).forEach((m, i) => { m.order = i + 1 })
}

export function deleteMark(id: string): void {
  const mark = getMark(id)
  if (!mark) return
  step(() => {
    scene.marks.splice(scene.marks.indexOf(mark), 1)
    renumber(mark.ownerId)
  })
}

export function moveMarkOrder(id: string, delta: number): void {
  const mark = getMark(id)
  if (!mark) return
  const list = marksOf(mark.ownerId)
  const i = list.indexOf(mark)
  const j = i + delta
  if (j < 0 || j >= list.length) return
  step(() => {
    list.splice(i, 1)
    list.splice(j, 0, mark)
    list.forEach((m, k) => { m.order = k + 1 })
  })
}

export function updateMark(id: string, patch: Partial<Pick<Mark, 'note' | 'hold' | 'pace' | 'rotationY'>>): void {
  const mark = getMark(id)
  if (mark) step(() => Object.assign(mark, patch))
}

// Live edits while dragging (committed by the drag's end).
export function setMarkPosition(id: string, p: Pt): void {
  const mark = getMark(id)
  if (mark) { mark.x = round3(p.x); mark.z = round3(p.z) }
}

export function setMarkHeading(id: string, deg: number): void {
  const mark = getMark(id)
  if (mark) mark.rotationY = round3(((deg % 360) + 360) % 360)
}

// Put the owner on a mark (its position and facing), as one undo step.
export function goToMark(id: string): void {
  const mark = getMark(id)
  const owner = mark && getItem(mark.ownerId)
  if (!mark || !owner) return
  step(() => {
    owner.x = mark.x
    owner.z = mark.z
    owner.rotationY = mark.rotationY
  })
}

export function clearMarks(ownerId: string): void {
  step(() => {
    for (let i = scene.marks.length - 1; i >= 0; i--) if (scene.marks[i].ownerId === ownerId) scene.marks.splice(i, 1)
  })
}

// Switch to the Marks tool for this owner (subsequent clicks on the plan place its marks).
export function startMarks(ownerId: string): void {
  editor.tool = 'marks'
  editor.markOwner = ownerId
  editor.openingPreview = null
  editor.draft = null
}

export const PACES: Record<'subject' | 'camera', Record<MarkPace, { label: string; speed: number }>> = {
  // Metres per second. A normal walk is ≈ 1.4 m/s; a dolly move is much slower.
  subject: { slow: { label: 'Slow walk', speed: 0.8 }, normal: { label: 'Walk', speed: 1.4 }, fast: { label: 'Run', speed: 3.5 } },
  camera: { slow: { label: 'Slow push', speed: 0.3 }, normal: { label: 'Dolly', speed: 0.6 }, fast: { label: 'Fast move', speed: 1.5 } }
}
