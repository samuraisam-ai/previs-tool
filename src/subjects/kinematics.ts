import { SceneItem, SubjectItem, SubjectProps } from '../scene/types'
import { blendValues, Contact, getPose, PoseValues } from './poses'
import { EYES, HEAD_TOP, HEEL, JointId, JOINTS, SEAT_TO_HIP, TOE, V3 } from './skeleton'

// Forward kinematics: pose angles → where every joint is, in subject-local metres (+x = their right,
// +y = up, +z = forward). Pure maths, shared by the 3D figure, the plan symbol, the light meter,
// autofocus and look-at.

// 3×3 rotation, row-major, acting on column vectors (v' = M v).
export type M3 = number[]
const DEG = Math.PI / 180
const I3: M3 = [1, 0, 0, 0, 1, 0, 0, 0, 1]
const mul = (a: M3, b: M3): M3 => {
  const o = new Array(9).fill(0)
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]
  return o
}
export const apply = (m: M3, v: V3): V3 => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]]
const transpose = (m: M3): M3 => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
// + pitch turns +y towards +z; + yaw turns +z towards +x; + roll turns +y towards +x.
const rx = (d: number): M3 => { const c = Math.cos(d * DEG); const s = Math.sin(d * DEG); return [1, 0, 0, 0, c, -s, 0, s, c] }
const ry = (d: number): M3 => { const c = Math.cos(d * DEG); const s = Math.sin(d * DEG); return [c, 0, s, 0, 1, 0, -s, 0, c] }
const rz = (d: number): M3 => { const c = Math.cos(d * DEG); const s = Math.sin(d * DEG); return [c, s, 0, -s, c, 0, 0, 0, 1] }
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]

// Anatomical angles → the joint's rotation relative to its parent.
function localRotation(id: JointId, v: PoseValues): M3 {
  const g = (k: string) => v[k] ?? 0
  const ypr = (p: string) => mul(mul(ry(g(`${p}.yaw`)), rx(g(`${p}.pitch`))), rz(g(`${p}.roll`)))
  const s = id.endsWith('R') ? 1 : -1 // mirror for the left side
  switch (id) {
    case 'hips': return ypr('root')
    case 'spine': case 'chest': case 'neck': case 'head': return ypr(id)
    case 'shoulderL': case 'shoulderR': {
      const a = `arm${id.slice(-1)}`
      return mul(mul(rx(-g(`${a}.flex`)), rz(-s * g(`${a}.abduct`))), ry(-s * g(`${a}.twist`)))
    }
    case 'elbowL': case 'elbowR': return rx(-g(`arm${id.slice(-1)}.elbow`))
    case 'wristL': case 'wristR': return rx(-g(`arm${id.slice(-1)}.wrist`))
    case 'hipL': case 'hipR': {
      const l = `leg${id.slice(-1)}`
      return mul(mul(rx(-g(`${l}.flex`)), rz(-s * g(`${l}.abduct`))), ry(-s * g(`${l}.twist`)))
    }
    case 'kneeL': case 'kneeR': return rx(g(`leg${id.slice(-1)}.knee`))
    case 'ankleL': case 'ankleR': return rx(-g(`leg${id.slice(-1)}.ankle`))
  }
  return I3
}

export interface Posed {
  height: number
  pos: Record<JointId, V3> // metres, subject-local
  world: Record<JointId, M3> // joint orientation in subject space
  local: Record<JointId, M3> // joint rotation relative to its parent (for the 3D bones)
  eye: V3
  headTop: V3
  contact: Contact
}

export interface SolveOptions {
  height: number
  // Seat or surface height (m) the figure sits/lies on; default: a 45 cm chair, or the floor.
  surface?: number
}

const DEFAULT_SEAT = 0.45

export function solve(values: PoseValues, contact: Contact, opts: SolveOptions): Posed {
  const H = opts.height
  const local = {} as Record<JointId, M3>
  const world = {} as Record<JointId, M3>
  const pos = {} as Record<JointId, V3> // in height units until scaled
  JOINTS.forEach(j => {
    local[j.id] = localRotation(j.id, values)
    if (!j.parent) {
      world[j.id] = local[j.id]
      pos[j.id] = j.offset
    } else {
      world[j.id] = mul(world[j.parent], local[j.id])
      pos[j.id] = add(pos[j.parent], apply(world[j.parent], j.offset))
    }
  })
  const at = (id: JointId, p: V3) => add(pos[id], apply(world[id], p))
  // Rest the figure on its support.
  let lift: number
  if (contact === 'seat') {
    lift = ((opts.surface ?? DEFAULT_SEAT) / H + SEAT_TO_HIP) - pos.hips[1]
  } else {
    let lowest = Infinity
    JOINTS.forEach(j => {
      if (j.id === 'ankleL' || j.id === 'ankleR') return // feet stand on heel and toe
      lowest = Math.min(lowest, pos[j.id][1] - j.radius * 0.8, at(j.id, j.tip)[1] - j.radius * 0.8)
    })
    ;(['ankleL', 'ankleR'] as JointId[]).forEach(a => { lowest = Math.min(lowest, at(a, HEEL)[1], at(a, TOE)[1]) })
    lowest = Math.min(lowest, at('head', HEAD_TOP)[1] - 0.01)
    lift = (opts.surface ?? 0) / H - lowest
  }
  const metres = {} as Record<JointId, V3>
  JOINTS.forEach(j => { metres[j.id] = scale(add(pos[j.id], [0, lift, 0]), H) })
  const toM = (p: V3) => scale(add(p, [0, lift, 0]), H)
  return { height: H, pos: metres, world, local, eye: toM(at('head', EYES)), headTop: toM(at('head', HEAD_TOP)), contact }
}

// Each joint's segment as a line in subject space (start, end, radius), for the plan symbol.
export function segments(p: Posed): Array<{ id: JointId; a: V3; b: V3; r: number }> {
  return JOINTS.map(j => ({ id: j.id, a: p.pos[j.id], b: add(p.pos[j.id], scale(apply(p.world[j.id], j.tip), p.height)), r: j.radius * p.height }))
}

// ── Subjects in a scene ────────────────────────────────────────────────────────────────────────

export const SKIN_TONES = ['#f1d3bd', '#e6bc98', '#d4a07a', '#c68a62', '#a8704b', '#8d5a3b', '#6b4430', '#4a2f22']
const TOPS = ['#5b6b82', '#9c4f3d', '#3f5f4f', '#c9a14a', '#6b4f7a', '#d8d2c4', '#2f3542']

export function defaultSubjectProps(index = 0): SubjectProps {
  return {
    look: 'mannequin', character: '', skin: SKIN_TONES[(2 + index * 3) % SKIN_TONES.length], top: TOPS[index % TOPS.length],
    bottom: '#3d4049', shoes: '#26231f', pose: 'stand', headYaw: 0, headPitch: 0, lean: 0, lookAt: null, seat: null
  }
}

// Subjects saved before people could pose get the defaults.
export function subjectProps(s: SubjectItem): SubjectProps {
  return s.props ?? defaultSubjectProps()
}
export function ensureSubjectProps(items: SceneItem[]): void {
  let n = 0
  items.forEach(i => { if (i.kind === 'subject' && !i.props) (i as SubjectItem).props = defaultSubjectProps(n++) })
}

// Subject-local point → world.
export function toWorld(s: { x: number; z: number; rotationY: number }, p: V3): V3 {
  const c = Math.cos(s.rotationY * DEG)
  const n = Math.sin(s.rotationY * DEG)
  return [s.x + c * p[0] + n * p[2], p[1], s.z - n * p[0] + c * p[2]]
}
function toLocal(s: { x: number; z: number; rotationY: number }, p: V3): V3 {
  const c = Math.cos(s.rotationY * DEG)
  const n = Math.sin(s.rotationY * DEG)
  const dx = p[0] - s.x
  const dz = p[2] - s.z
  return [c * dx - n * dz, p[1], n * dx + c * dz]
}

// Where something being looked at is: another subject's eyes or a camera.
type Lookable = SceneItem
function targetPoint(id: string, items: Lookable[], depth: number): V3 | null {
  const t = items.find(i => i.id === id)
  if (!t) return null
  if (t.kind === 'subject') return depth > 0 ? faceOf(t, items, depth - 1) : [t.x, t.height * 0.93, t.z]
  if (t.kind === 'camera' || t.kind === 'light') return [t.x, t.height, t.z]
  return [t.x, 1, t.z]
}

export interface SubjectState {
  pose?: string // overrides (blocking marks)
  lookAt?: string | null
  values?: PoseValues // a blended pose (blocking transitions, walking)
  contact?: Contact
  surface?: number
}

// The subject's pose with tweaks and look-at applied.
export function solveSubject(s: SubjectItem, items: Lookable[] = [], state: SubjectState = {}, depth = 1): Posed {
  const p = subjectProps(s)
  const pose = getPose(state.pose ?? p.pose)
  const v: PoseValues = { ...(state.values ?? pose.v) }
  const contact = state.contact ?? pose.contact
  const addTo = (k: string, d: number) => { v[k] = (v[k] ?? 0) + d }
  addTo('spine.pitch', p.lean * 0.6)
  addTo('chest.pitch', p.lean * 0.4)
  addTo('neck.yaw', p.headYaw * 0.4)
  addTo('head.yaw', p.headYaw * 0.6)
  addTo('neck.pitch', p.headPitch * 0.35)
  addTo('head.pitch', p.headPitch * 0.65)
  const opts = { height: s.height, surface: state.surface }
  let posed = solve(v, contact, opts)
  const lookId = state.lookAt !== undefined ? state.lookAt : p.lookAt
  const target = lookId && lookId !== s.id ? targetPoint(lookId, items, depth) : null
  if (target) {
    // Aim the eyes: the direction to the target in the chest's frame → yaw and pitch, shared
    // between neck and head (and the chest, past what a neck can turn).
    const d = apply(transpose(posed.world.chest), [...sub(toLocal(s, target), posed.eye)] as V3)
    const yaw = Math.atan2(d[0], d[2]) / DEG
    const pitch = -Math.atan2(d[1], Math.hypot(d[0], d[2])) / DEG
    const headYaw = Math.max(-75, Math.min(75, yaw))
    const chestYaw = Math.max(-30, Math.min(30, yaw - headYaw))
    addTo('chest.yaw', chestYaw)
    addTo('neck.yaw', headYaw * 0.4)
    addTo('head.yaw', headYaw * 0.6)
    const look = Math.max(-50, Math.min(60, pitch))
    addTo('neck.pitch', look * 0.35)
    addTo('head.pitch', look * 0.65)
    posed = solve(v, contact, opts)
  }
  return posed
}
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

// The face in world space (what the light meter reads and autofocus tracks).
export function faceOf(s: SubjectItem, items: Lookable[] = [], depth = 1): V3 {
  return toWorld(s, solveSubject(s, items, {}, depth).eye)
}

export { blendValues }
