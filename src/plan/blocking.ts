import { reactive } from 'vue'
import { getItem, scene } from '../scene/store'
import { SceneDoc, SceneItem } from '../scene/types'
import { headingTo, marksOf, owners, PACES } from './marks'

// Plays the blocking: every owner walks (or dollies) along its marks at the same time.
// Playback is a preview overlay — it never edits the scene, so there are no undo steps and
// Stop puts everyone back where they were.

interface Pose { x: number; z: number; rotationY: number }
interface Leg { from: Pose; to: Pose; t0: number; travel: number; hold: number; length: number; distBefore: number }
interface Timeline { ownerId: string; camera: boolean; legs: Leg[]; duration: number; pathLength: number }

const TURN_TIME = 0.35 // seconds to settle into a mark's facing

export const playback = reactive({
  active: false, // playing or paused (the overlay is shown)
  playing: false,
  time: 0,
  duration: 0,
  speed: 1,
  loop: false,
  poses: {} as { [ownerId: string]: Pose },
  // Distance travelled along each owner's path (for brightening the traced line).
  travelled: {} as { [ownerId: string]: number }
})

let timelines: Timeline[] = []
let raf = 0
let last = 0

const angleLerp = (a: number, b: number, t: number) => {
  const d = ((((b - a) % 360) + 540) % 360) - 180
  return a + d * t
}

function build(): void {
  timelines = owners().map(owner => {
    const kind = owner.kind === 'camera' ? 'camera' : 'subject'
    const legs: Leg[] = []
    let from: Pose = { x: owner.x, z: owner.z, rotationY: owner.rotationY }
    let t = 0
    let dist = 0
    marksOf(owner.id).forEach(m => {
      const length = Math.hypot(m.x - from.x, m.z - from.z)
      const travel = length / PACES[kind][m.pace].speed
      const to = { x: m.x, z: m.z, rotationY: m.rotationY }
      legs.push({ from, to, t0: t, travel, hold: Math.max(0, m.hold), length, distBefore: dist })
      t += travel + Math.max(0, m.hold)
      dist += length
      from = to
    })
    return { ownerId: owner.id, camera: owner.kind === 'camera', legs, duration: t, pathLength: dist }
  })
  playback.duration = timelines.reduce((d, tl) => Math.max(d, tl.duration), 0)
}

function sample(tl: Timeline, t: number): { pose: Pose; travelled: number } {
  const owner = getItem(tl.ownerId) as SceneItem
  let pose: Pose = { x: owner.x, z: owner.z, rotationY: owner.rotationY }
  let travelled = 0
  for (const leg of tl.legs) {
    if (t < leg.t0) break
    const local = t - leg.t0
    if (local < leg.travel) {
      const k = leg.travel > 0 ? local / leg.travel : 1
      // People face the way they walk (turning in over the first moments); a camera eases its
      // pan from one mark's aim to the next while it dollies.
      const eased = k * k * (3 - 2 * k)
      const heading = tl.camera
        ? angleLerp(leg.from.rotationY, leg.to.rotationY, eased)
        : angleLerp(leg.from.rotationY, leg.length > 0.01 ? headingTo(leg.from, leg.to) : leg.to.rotationY, Math.min(1, local / TURN_TIME))
      pose = {
        x: leg.from.x + (leg.to.x - leg.from.x) * eased,
        z: leg.from.z + (leg.to.z - leg.from.z) * eased,
        rotationY: heading
      }
      return { pose, travelled: leg.distBefore + leg.length * eased }
    }
    // Arrived: settle into the mark's facing during the hold.
    const settled = Math.min(1, (local - leg.travel) / TURN_TIME)
    const arriveHeading = tl.camera ? leg.to.rotationY : leg.length > 0.01 ? headingTo(leg.from, leg.to) : leg.from.rotationY
    pose = { ...leg.to, rotationY: angleLerp(arriveHeading, leg.to.rotationY, settled) }
    travelled = leg.distBefore + leg.length
  }
  return { pose, travelled }
}

function apply(): void {
  const poses: typeof playback.poses = {}
  const travelled: typeof playback.travelled = {}
  timelines.forEach(tl => {
    const s = sample(tl, playback.time)
    poses[tl.ownerId] = s.pose
    travelled[tl.ownerId] = s.travelled
  })
  playback.poses = poses
  playback.travelled = travelled
}

function tick(now: number): void {
  const dt = Math.min(0.1, (now - last) / 1000)
  last = now
  playback.time += dt * playback.speed
  if (playback.time >= playback.duration) {
    if (playback.loop && playback.duration > 0) playback.time = 0
    else {
      playback.time = playback.duration
      playback.playing = false
    }
  }
  apply()
  if (playback.playing) raf = requestAnimationFrame(tick)
}

export function play(): void {
  if (!scene.marks.length) return
  build()
  if (!playback.active || playback.time >= playback.duration) playback.time = 0
  playback.active = true
  playback.playing = true
  last = performance.now()
  cancelAnimationFrame(raf)
  apply()
  raf = requestAnimationFrame(tick)
}

export function pause(): void {
  playback.playing = false
  cancelAnimationFrame(raf)
}

export function togglePlay(): void {
  if (playback.playing) pause()
  else play()
}

// Back to the start: the overlay goes and everyone is where the scene says.
export function stop(): void {
  pause()
  playback.active = false
  playback.time = 0
  playback.poses = {}
  playback.travelled = {}
}

// Jump to a time (scrubbing).
export function seek(t: number): void {
  if (!playback.active) { build(); playback.active = true }
  playback.time = Math.min(Math.max(0, t), playback.duration)
  apply()
}

// An item as it should be drawn right now (its playback pose while blocking plays).
export function posed<T extends SceneItem>(item: T): T {
  const pose = playback.active ? playback.poses[item.id] : undefined
  return pose ? { ...item, ...pose } : item
}

// The scene as the Live View should show it right now.
export function playbackDoc(doc: SceneDoc): SceneDoc {
  if (!playback.active) return doc
  return { ...doc, items: doc.items.map(i => posed(i)) }
}
