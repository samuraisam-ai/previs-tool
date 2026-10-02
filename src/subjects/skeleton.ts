// The canonical human skeleton every figure is posed on (mannequin and realistic characters).
// Units are fractions of standing height (multiply by the subject's height for metres), from
// standard adult proportions. Subject-local axes: +x = the person's right, +y = up, +z = forward.

export type V3 = [number, number, number]

export type JointId =
  | 'hips' | 'spine' | 'chest' | 'neck' | 'head'
  | 'shoulderL' | 'elbowL' | 'wristL' | 'shoulderR' | 'elbowR' | 'wristR'
  | 'hipL' | 'kneeL' | 'ankleL' | 'hipR' | 'kneeR' | 'ankleR'

export interface JointDef {
  id: JointId
  parent: JointId | null
  offset: V3 // rest position relative to the parent joint (parent's frame)
  tip: V3 // rest end of the segment this joint carries (its own frame), for drawing and grounding
  radius: number // segment thickness (for grounding and the plan symbol)
}

const side = (s: 'L' | 'R', x: number) => (s === 'R' ? x : -x)

function limbs(s: 'L' | 'R'): JointDef[] {
  return [
    { id: `shoulder${s}` as JointId, parent: 'chest', offset: [side(s, 0.115), 0.13, -0.01], tip: [0, -0.186, 0], radius: 0.03 },
    { id: `elbow${s}` as JointId, parent: `shoulder${s}` as JointId, offset: [0, -0.186, 0], tip: [0, -0.146, 0], radius: 0.025 },
    { id: `wrist${s}` as JointId, parent: `elbow${s}` as JointId, offset: [0, -0.146, 0], tip: [0, -0.1, 0.005], radius: 0.022 },
    { id: `hip${s}` as JointId, parent: 'hips', offset: [side(s, 0.05), -0.01, 0], tip: [0, -0.245, 0], radius: 0.05 },
    { id: `knee${s}` as JointId, parent: `hip${s}` as JointId, offset: [0, -0.245, 0], tip: [0, -0.246, 0], radius: 0.037 },
    { id: `ankle${s}` as JointId, parent: `knee${s}` as JointId, offset: [0, -0.246, 0], tip: [0, -0.03, 0.115], radius: 0.03 }
  ]
}

// Parents always come before their children.
export const JOINTS: JointDef[] = [
  { id: 'hips', parent: null, offset: [0, 0.53, 0], tip: [0, 0.02, 0], radius: 0.085 },
  { id: 'spine', parent: 'hips', offset: [0, 0.02, 0], tip: [0, 0.12, 0], radius: 0.075 },
  { id: 'chest', parent: 'spine', offset: [0, 0.12, 0], tip: [0, 0.16, -0.005], radius: 0.085 },
  { id: 'neck', parent: 'chest', offset: [0, 0.16, -0.005], tip: [0, 0.05, 0.005], radius: 0.03 },
  { id: 'head', parent: 'neck', offset: [0, 0.05, 0.005], tip: [0, 0.12, 0], radius: 0.06 },
  ...limbs('L'),
  ...limbs('R')
]

export const JOINT = Object.fromEntries(JOINTS.map(j => [j.id, j])) as Record<JointId, JointDef>

// Points on the head (head joint frame): eyes and the top of the skull.
export const EYES: V3 = [0, 0.055, 0.085]
export const HEAD_TOP: V3 = [0, 0.12, 0]
// Underside of the foot (ankle frame): heel and toe, for standing on the floor.
export const HEEL: V3 = [0, -0.039, -0.035]
export const TOE: V3 = [0, -0.039, 0.115]
// Hip joint height above a seat (the flesh under the pelvis), as a fraction of height.
export const SEAT_TO_HIP = 0.055
