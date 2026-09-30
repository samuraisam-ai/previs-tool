// Scene document shared by the Floor Plan (2D editor) and the Live View (3D, read-only).
// Units are metres. Plan x maps to Babylon x; plan y (down the screen) maps to Babylon -z.
// rotationY is in degrees, 0 = pointing "up" the plan (Babylon +z), clockwise positive.

export type ItemKind = 'subject' | 'light' | 'camera'

export interface LightProps {
  intensity: number
  color: string
  angle: number // beam angle in degrees
  tilt: number // degrees below horizontal
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

export interface SceneDoc {
  room: Room
  items: SceneItem[]
  selectedId: string | null
}

export const SENSOR_WIDTH_MM = 36

// Horizontal field of view in radians for a focal length on a full-frame sensor.
export function horizontalFov(focalLength: number): number {
  return 2 * Math.atan(SENSOR_WIDTH_MM / (2 * focalLength))
}
