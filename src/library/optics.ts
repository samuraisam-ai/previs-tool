import { getBody } from './cameras'
import { getLens } from './lenses'
import { CameraItem, CameraProps, SceneDoc } from '../scene/types'

const DEG = Math.PI / 180
// Incident-meter calibration constant (lux): N² / t = E·S / C.
export const INCIDENT_C = 250
// Light lost to a circular polarizer, in stops.
export const POLARIZER_LOSS = 1.5
// Acceptable circle of confusion on a full-frame sensor (mm), for DOF limits.
export const COC_LIMIT = 0.03

export function frameRate(p: CameraProps) {
  const body = getBody(p.bodyId)
  return body.frameRates.find(r => r.fps === p.fps) ?? body.frameRates[0]
}

export function shutterSeconds(p: CameraProps): number {
  return p.shutterMode === 'angle' ? p.shutterAngle / 360 / p.fps : 1 / p.shutterSpeed
}

export function angleFromSpeed(speed: number, fps: number): number {
  return Math.min(360, (360 * fps) / speed)
}

export function filterStops(p: CameraProps): number {
  return (p.nd.fitted ? p.nd.stops : 0) + (p.polarizer.fitted ? POLARIZER_LOSS : 0)
}

// Incident illuminance (lux) that these settings expose as middle grey.
export function keyLux(p: CameraProps): number {
  return ((p.tStop * p.tStop * INCIDENT_C) / (p.iso * shutterSeconds(p))) * Math.pow(2, filterStops(p))
}

// Sensor width actually used for the image (crop at high frame rates).
export function imageWidthMm(p: CameraProps): number {
  return getBody(p.bodyId).sensorWidth / frameRate(p).crop
}

export function horizontalFov(p: CameraProps): number {
  return 2 * Math.atan(imageWidthMm(p) / (2 * getLens(p.lensId).focalLength))
}

// Thin-lens circle of confusion (mm on the sensor) for a point at depth D when focused at s (both metres).
export function cocMm(p: CameraProps, focus: number, depth: number): number {
  const f = getLens(p.lensId).focalLength
  const s = Math.max(focus * 1000, f + 1)
  const d = depth * 1000
  return ((f * f) / (p.tStop * (s - f))) * (Math.abs(d - s) / d)
}

// Near/far limits of acceptable sharpness (metres). far = Infinity beyond the hyperfocal distance.
export function dofLimits(p: CameraProps, focus: number): { near: number; far: number } {
  const f = getLens(p.lensId).focalLength
  const s = focus * 1000
  const h = (f * f) / (p.tStop * COC_LIMIT) + f
  const near = (s * (h - f)) / (h + s - 2 * f)
  const far = s < h ? (s * (h - f)) / (h - s) : Infinity
  return { near: near / 1000, far: far / 1000 }
}

// Optical axis of a camera (plan heading + tilt, down positive).
export function cameraDirection(item: CameraItem): [number, number, number] {
  const h = item.rotationY * DEG
  const t = item.props.tilt * DEG
  return [Math.sin(h) * Math.cos(t), -Math.sin(t), Math.cos(h) * Math.cos(t)]
}

// Focus distance in metres, measured along the optical axis (the focal plane), as a lens would.
export function focusDistance(item: CameraItem, doc: SceneDoc): number {
  const { focus } = item.props
  const lens = getLens(item.props.lensId)
  if (focus.mode === 'subject') {
    const subject = doc.items.find(i => i.id === focus.subjectId && i.kind === 'subject')
    if (subject) {
      const dir = cameraDirection(item)
      const v = [subject.x - item.x, subject.height - 0.12 - item.height, subject.z - item.z]
      const along = v[0] * dir[0] + v[1] * dir[1] + v[2] * dir[2]
      return Math.max(along, lens.closeFocus)
    }
  }
  return Math.max(focus.distance, lens.closeFocus)
}

export function formatShutter(p: CameraProps): string {
  return p.shutterMode === 'angle' ? `${p.shutterAngle.toFixed(1)}°` : `1/${p.shutterSpeed}`
}

export function formatDistance(m: number): string {
  if (!isFinite(m)) return '∞'
  return m < 10 ? `${m.toFixed(2)} m` : `${m.toFixed(1)} m`
}
