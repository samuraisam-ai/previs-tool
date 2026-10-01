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

export type FrameLines = 'off' | '2.39' | '2.00' | '1.85' | '4:3' | '1:1' | '9:16' | '4:5'
export type GridType = 'off' | 'thirds' | 'square' | 'diagonal'
export type ScopeId = 'histogram' | 'waveform' | 'parade' | 'vectorscope'

// What the camera monitor shows. Mirrors the FX3's display/assist settings.
export interface CameraDisplay {
  osd: boolean // DISP: viewfinder overlay on/off
  frameLines: FrameLines
  grid: GridType
  centre: boolean
  safety: boolean
  zebras: boolean
  zebraLevel: number // IRE
  falseColour: boolean
  mm: boolean // metered-manual exposure scale
  scopes: ScopeId[] // up to two shown at once
}

export interface CameraProps {
  bodyId: string
  lensId: string
  fps: number
  profile: 'cinetone' | 'slog3'
  shutterMode: 'angle' | 'speed'
  shutterAngle: number // degrees
  shutterSpeed: number // denominator: 48 = 1/48 s
  iso: number
  tStop: number
  nd: { fitted: boolean; stops: number } // variable ND, 2–8 stops
  polarizer: { fitted: boolean; angle: number } // ring rotation 0–180°
  wb: number // Kelvin
  tint: number // -99 green … +99 magenta
  focus: { mode: 'subject' | 'manual'; subjectId: string | null; distance: number } // distance in m
  tilt: number // degrees below horizontal (negative = up)
  display: CameraDisplay
  recording: boolean
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

// ── Architecture ─────────────────────────────────────────────────────────────
export interface Pt {
  x: number
  z: number
}

export interface Wall {
  id: string
  a: Pt
  b: Pt
  thickness: number
  height: number
  // Ends unlinked from the corner they touch: they no longer drag (or get dragged by) other walls.
  detached?: { a?: boolean; b?: boolean }
}

export type OpeningKind = 'door' | 'double-door' | 'sliding-door' | 'opening' | 'window'

// A door, window or plain opening cut into a wall. `offset` is the centre's distance from wall.a.
export interface Opening {
  id: string
  wallId: string
  kind: OpeningKind
  offset: number
  width: number
  height: number
  sill: number
  hinge: 'left' | 'right'
  swing: 'in' | 'out'
  openAngle: number // current angle (deg), 0 = closed; sliding doors use it as 0–90 = shut–open
  openTo: number // angle it opens to when toggled open
}

export type FloorFinish = 'wood' | 'concrete' | 'tile' | 'carpet'

export interface RoomArea {
  id: string
  name: string
  points: Pt[]
  floor: FloorFinish
  ceiling: boolean
  ceilingHeight: number
}

export interface SceneDoc {
  walls: Wall[]
  openings: Opening[]
  rooms: RoomArea[]
  items: SceneItem[]
  selectedId: string | null
  // The camera whose exposure drives the orbit view and the light meter.
  activeCameraId: string | null
  // Ambient light from outside (time of day), and the Blackout switch.
  world: WorldLight
  // The 180° line (line of action), if one has been placed.
  lineOfAction: LineOfAction | null
  // Blocking: numbered T marks for subjects and cameras.
  marks: Mark[]
}

export type MarkPace = 'slow' | 'normal' | 'fast'
export interface Mark {
  id: string
  ownerId: string // subject or camera
  order: number // 1, 2, 3…
  x: number
  z: number
  rotationY: number // the way the owner faces on the mark (same convention as items)
  note: string
  hold: number // seconds spent on the mark during playback
  pace: MarkPace // how fast the owner travels *to* this mark
}

export type WorldPreset = 'morning' | 'day' | 'evening' | 'night'
export interface WorldLight {
  preset: WorldPreset
  percent: number // 0–200 % of the preset's level
  kelvin: number
  blackout: boolean // ambient off (fixtures only); `percent` is kept for when it's turned back on
}

export interface LineOfAction {
  a: Pt
  b: Pt
  // While attached, an end follows that subject.
  aSubject: string | null
  bSubject: string | null
  visible: boolean
  // Which side cameras belong on: 0 = automatic (where most cameras are), ±1 = chosen.
  side: number
}
