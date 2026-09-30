// Scene document shared by the Floor Plan (2D editor) and the Live View (3D, read-only).
// Units are metres. Plan x maps to Babylon x; plan y (down the screen) maps to Babylon -z.
// rotationY is in degrees, 0 = pointing "up" the plan (Babylon +z), clockwise positive.

export type ItemKind = 'subject' | 'light' | 'camera'

export interface LightProps {
  fixtureId: string
  modifierId: string
  dimmer: number // 0–100 %
  cct: number // Kelvin
  gm: number // -100 green … +100 magenta
  mode: 'cct' | 'hsi'
  hue: number // 0–360
  sat: number // 0–100
  zoom: number // beam angle for fresnel / zoom projection
  tilt: number // degrees below horizontal
  orientation: 'vertical' | 'horizontal' // tubes
}

export interface CameraProps {
  focalLength: number // mm, full-frame 36mm sensor width
}

interface BaseItem {
  id: string
  name: string
  x: number
  z: number
  rotationY: number
  height: number
}

export interface SubjectItem extends BaseItem { kind: 'subject' }
export interface LightItem extends BaseItem { kind: 'light'; props: LightProps }
export interface CameraItem extends BaseItem { kind: 'camera'; props: CameraProps }

export type SceneItem = SubjectItem | LightItem | CameraItem

export interface Room {
  width: number
  depth: number
  height: number
}

// Camera exposure used by the Live View and the light meter. shutter is in seconds.
export interface Exposure {
  iso: number
  tStop: number
  shutter: number
}

export interface SceneDoc {
  room: Room
  items: SceneItem[]
  selectedId: string | null
  exposure: Exposure
  ambientLux: number
}

export const SENSOR_WIDTH_MM = 36

// Horizontal field of view in radians for a focal length on a full-frame sensor.
export function horizontalFov(focalLength: number): number {
  return 2 * Math.atan(SENSOR_WIDTH_MM / (2 * focalLength))
}
