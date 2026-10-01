import { commit } from './history'
import { getItem, scene } from '../scene/store'
import { CameraItem, LineOfAction, Pt } from '../scene/types'
import { dist, roundPt } from './geometry'

// The 180° line (line of action). Each end follows a subject while attached, or sits where it was
// dragged. Cameras belong on one side; any camera on the other side "crosses the line".

export const LINE_ID = 'line-of-action'
const ATTACH_REACH = 0.35

// One undo step: capture pending edits, apply, capture the result.
function step(action: () => void): void {
  commit()
  action()
  commit()
}

export function lineEnd(line: LineOfAction, end: 'a' | 'b'): Pt {
  const id = end === 'a' ? line.aSubject : line.bSubject
  const subject = id ? getItem(id) : undefined
  return subject && subject.kind === 'subject' ? { x: subject.x, z: subject.z } : line[end]
}

// Which side of the line a point is on: +1 left of a→b, −1 right, 0 on it.
export function sideOf(line: LineOfAction, p: Pt): number {
  const a = lineEnd(line, 'a')
  const b = lineEnd(line, 'b')
  const cross = (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x)
  return Math.abs(cross) < 1e-6 ? 0 : Math.sign(cross)
}

const cameras = () => scene.items.filter((i): i is CameraItem => i.kind === 'camera')

// The camera side: chosen, or wherever most cameras are (left when tied or none).
export function cameraSide(line: LineOfAction): number {
  if (line.side) return line.side
  const sum = cameras().reduce((s, c) => s + sideOf(line, c), 0)
  return sum < 0 ? -1 : 1
}

export function crossesLine(cam: { x: number; z: number }): boolean {
  const line = scene.lineOfAction
  if (!line || !line.visible) return false
  const s = sideOf(line, cam)
  return s !== 0 && s !== cameraSide(line)
}

const subjects = () => scene.items.filter(i => i.kind === 'subject')

// Toolbar toggle. Returns 'need-points' when there aren't two subjects to put the line between.
export function toggleLine(): 'shown' | 'hidden' | 'need-points' {
  const line = scene.lineOfAction
  if (line) {
    step(() => { line.visible = !line.visible })
    return line.visible ? 'shown' : 'hidden'
  }
  const [s1, s2] = subjects()
  if (!s1 || !s2) return 'need-points'
  createLine({ x: s1.x, z: s1.z }, { x: s2.x, z: s2.z }, s1.id, s2.id)
  return 'shown'
}

export function createLine(a: Pt, b: Pt, aSubject: string | null = null, bSubject: string | null = null): void {
  step(() => { scene.lineOfAction = { a: roundPt(a), b: roundPt(b), aSubject, bSubject, visible: true, side: 0 } })
}

// The subject (if any) within reach of a point, for attaching an end.
export function subjectNear(p: Pt): string | null {
  let best: string | null = null
  let bestD = ATTACH_REACH
  subjects().forEach(s => {
    const d = dist(p, { x: s.x, z: s.z })
    if (d <= bestD) { best = s.id; bestD = d }
  })
  return best
}

// Dragging an end frees it; dropping it on a subject attaches it.
export function moveLineEnd(end: 'a' | 'b', p: Pt): void {
  const line = scene.lineOfAction
  if (!line) return
  line[end] = roundPt(p)
  if (end === 'a') line.aSubject = null
  else line.bSubject = null
}

export function dropLineEnd(end: 'a' | 'b'): void {
  const line = scene.lineOfAction
  if (!line) return
  const id = subjectNear(line[end])
  if (id) {
    if (end === 'a') line.aSubject = id
    else line.bSubject = id
  }
  commit()
}

export function setLineSubject(end: 'a' | 'b', subjectId: string | null): void {
  const line = scene.lineOfAction
  if (!line) return
  step(() => {
    // Keep the end where it is visually when detaching.
    if (!subjectId) line[end] = roundPt(lineEnd(line, end))
    if (end === 'a') line.aSubject = subjectId
    else line.bSubject = subjectId
  })
}

export function flipLineSide(): void {
  const line = scene.lineOfAction
  if (!line) return
  step(() => { line.side = -cameraSide(line) })
}

export function removeLine(): void {
  step(() => { scene.lineOfAction = null })
}
