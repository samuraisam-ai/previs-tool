// The pose library. A pose is a set of anatomical angles in degrees (missing = 0), so poses can be
// blended number by number. Keys:
//   root.yaw/pitch/roll                     whole body (lying down)
//   spine|chest|neck|head .pitch/yaw/roll   + pitch = bend forward / look down, + yaw = turn right
//   armL|armR .flex/abduct/twist/elbow/wrist  + flex = raise forward, + abduct = out to the side,
//                                           + twist = rotate inwards, + elbow = bend
//   legL|legR .flex/abduct/twist/knee/ankle   + flex = thigh forward, + knee = bend, + ankle = toes up
// Contact says how the figure meets the world: standing/kneeling on the floor, sitting on a seat,
// or lying on a surface (floor, bed, sofa).

export type Contact = 'floor' | 'seat' | 'lie'
export type PoseValues = { [key: string]: number }
export type PoseGroup = 'Standing' | 'Seated' | 'Low' | 'Lying' | 'Moving'
export interface Pose { id: string; name: string; group: PoseGroup; contact: Contact; v: PoseValues }

// Both arms / both legs at once.
const arms = (v: PoseValues): PoseValues => Object.fromEntries(Object.entries(v).flatMap(([k, n]) => [[`armL.${k}`, n], [`armR.${k}`, n]]))
const legs = (v: PoseValues): PoseValues => Object.fromEntries(Object.entries(v).flatMap(([k, n]) => [[`legL.${k}`, n], [`legR.${k}`, n]]))
const side = (s: 'L' | 'R', limb: 'arm' | 'leg', v: PoseValues): PoseValues => Object.fromEntries(Object.entries(v).map(([k, n]) => [`${limb}${s}.${k}`, n]))

const HANG = arms({ abduct: 7, elbow: 12, twist: 10 })

export const POSES: Pose[] = [
  // ── Standing ─────────────────────────────────────────────────────────────
  { id: 'stand', name: 'Stand', group: 'Standing', contact: 'floor', v: { ...HANG } },
  {
    id: 'relaxed', name: 'Relaxed', group: 'Standing', contact: 'floor',
    v: { ...HANG, 'root.roll': 2, 'spine.roll': -3, 'head.roll': 3, 'head.pitch': 3, ...side('L', 'leg', { flex: 6, knee: 12, abduct: 3 }), 'armR.elbow': 18 }
  },
  {
    id: 'arms-crossed', name: 'Arms crossed', group: 'Standing', contact: 'floor',
    v: { ...arms({ flex: 34, abduct: 14, twist: 92, elbow: 118 }), 'armL.flex': 38, 'chest.pitch': -2 }
  },
  { id: 'hands-hips', name: 'Hands on hips', group: 'Standing', contact: 'floor', v: { ...arms({ flex: -18, abduct: 38, twist: 62, elbow: 100 }), ...legs({ abduct: 4 }) } },
  { id: 'pockets', name: 'Hands in pockets', group: 'Standing', contact: 'floor', v: { ...arms({ flex: -8, abduct: 12, twist: 22, elbow: 32 }), 'head.pitch': 4 } },
  { id: 'point', name: 'Pointing', group: 'Standing', contact: 'floor', v: { ...HANG, ...side('R', 'arm', { flex: 82, abduct: 12, elbow: 4, twist: 0 }), 'chest.yaw': -6 } },
  { id: 'phone', name: 'On the phone', group: 'Standing', contact: 'floor', v: { ...HANG, ...side('R', 'arm', { flex: 40, abduct: 24, twist: 16, elbow: 154 }), 'head.roll': 6, 'head.pitch': 6 } },
  { id: 'drink', name: 'Drinking', group: 'Standing', contact: 'floor', v: { ...HANG, ...side('R', 'arm', { flex: 32, abduct: 14, twist: 34, elbow: 128 }), 'head.pitch': -8 } },
  { id: 'wave', name: 'Waving', group: 'Standing', contact: 'floor', v: { ...HANG, ...side('R', 'arm', { abduct: 78, twist: -88, elbow: 80, flex: 10 }), 'head.roll': -3 } },
  { id: 'lean-back', name: 'Lean on wall', group: 'Standing', contact: 'floor', v: { 'root.pitch': -9, 'spine.pitch': 2, 'head.pitch': 6, ...arms({ flex: -10, abduct: 8, elbow: 18 }), ...legs({ flex: 12 }), 'legR.knee': 6 } },
  { id: 'lean-counter', name: 'Lean on counter', group: 'Standing', contact: 'floor', v: { 'spine.pitch': 22, 'chest.pitch': 12, 'head.pitch': -18, ...arms({ flex: 62, abduct: 12, twist: 30, elbow: 62 }), ...legs({ flex: -8 }), 'legR.knee': 10 } },

  // ── Seated ───────────────────────────────────────────────────────────────
  { id: 'sit', name: 'Sit', group: 'Seated', contact: 'seat', v: { 'spine.pitch': -6, 'head.pitch': 4, ...arms({ flex: 30, abduct: 10, twist: 18, elbow: 52 }), ...legs({ flex: 88, knee: 88, abduct: 4 }) } },
  { id: 'sit-back', name: 'Sit back', group: 'Seated', contact: 'seat', v: { 'spine.pitch': -18, 'chest.pitch': -4, 'head.pitch': 14, ...arms({ flex: 16, abduct: 22, twist: 8, elbow: 40 }), ...legs({ flex: 78, knee: 62, abduct: 8 }) } },
  { id: 'sit-forward', name: 'Sit forward', group: 'Seated', contact: 'seat', v: { 'spine.pitch': 26, 'chest.pitch': 10, 'head.pitch': -22, ...arms({ flex: 46, abduct: 8, twist: 26, elbow: 84 }), ...legs({ flex: 96, knee: 104, abduct: 8 }) } },
  { id: 'sit-crossed', name: 'Sit, legs crossed', group: 'Seated', contact: 'seat', v: { 'spine.pitch': -6, ...arms({ flex: 34, abduct: 8, twist: 30, elbow: 64 }), ...side('L', 'leg', { flex: 88, knee: 88 }), ...side('R', 'leg', { flex: 108, abduct: -18, knee: 96, twist: 10 }) } },

  // ── Low ──────────────────────────────────────────────────────────────────
  { id: 'sit-floor', name: 'Sit on floor', group: 'Low', contact: 'floor', v: { 'spine.pitch': 12, 'head.pitch': -6, ...arms({ flex: 26, abduct: 12, twist: 20, elbow: 44 }), ...legs({ flex: 82, abduct: 42, twist: -48, knee: 140 }) } },
  { id: 'kneel', name: 'Kneel', group: 'Low', contact: 'floor', v: { ...HANG, ...legs({ knee: 92, ankle: -88 }) } },
  { id: 'crouch', name: 'Crouch', group: 'Low', contact: 'floor', v: { 'spine.pitch': 30, 'chest.pitch': 6, 'head.pitch': -30, ...arms({ flex: 40, abduct: 12, elbow: 40 }), ...legs({ flex: 118, knee: 140, ankle: 30, abduct: 10 }) } },

  // ── Lying ────────────────────────────────────────────────────────────────
  { id: 'lie-back', name: 'Lie on back', group: 'Lying', contact: 'lie', v: { 'root.yaw': 180, 'root.pitch': -90, 'head.pitch': -8, ...arms({ abduct: 12, elbow: 14 }), ...legs({ flex: 4, knee: 6, ankle: -20 }) } },
  {
    id: 'lie-side', name: 'Lie on side', group: 'Lying', contact: 'lie',
    v: { 'root.yaw': -90, 'root.roll': 90, 'head.roll': -8, ...arms({ flex: 60, elbow: 70, twist: 20 }), ...legs({ flex: 38, knee: 58 }), 'legL.flex': 26, 'legL.knee': 44 }
  },

  // ── Moving ───────────────────────────────────────────────────────────────
  { id: 'walk', name: 'Walk', group: 'Moving', contact: 'floor', v: { 'spine.pitch': 3, ...side('L', 'arm', { flex: 22, abduct: 7, elbow: 26 }), ...side('R', 'arm', { flex: -16, abduct: 7, elbow: 14 }), ...side('R', 'leg', { flex: 24, knee: 6, ankle: 8 }), ...side('L', 'leg', { flex: -14, knee: 22, ankle: -12 }) } },
  { id: 'run', name: 'Run', group: 'Moving', contact: 'floor', v: { 'spine.pitch': 12, 'head.pitch': -10, ...side('L', 'arm', { flex: 50, abduct: 10, elbow: 92 }), ...side('R', 'arm', { flex: -34, abduct: 10, elbow: 80 }), ...side('R', 'leg', { flex: 56, knee: 70, ankle: 6 }), ...side('L', 'leg', { flex: -22, knee: 84, ankle: -24 }) } }
]

export const DEFAULT_POSE = 'stand'
const byId = new Map(POSES.map(p => [p.id, p]))
export const getPose = (id: string | undefined): Pose => byId.get(id ?? DEFAULT_POSE) ?? (byId.get(DEFAULT_POSE) as Pose)
export const POSE_GROUPS: PoseGroup[] = ['Standing', 'Seated', 'Low', 'Lying', 'Moving']

// Number-by-number blend (t = 0 → a, 1 → b). Angles are small enough that linear blending reads well.
export function blendValues(a: PoseValues, b: PoseValues, t: number): PoseValues {
  const out: PoseValues = {}
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => { out[k] = (a[k] ?? 0) + ((b[k] ?? 0) - (a[k] ?? 0)) * t })
  return out
}
