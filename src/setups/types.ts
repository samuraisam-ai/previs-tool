// Pre-production records: Production → Scene → Captures (floor-plan setups and storyboard frames).
// Shaped to move to a server unchanged later: client-generated UUIDs, timestamps, a schema
// version and a (currently unused) owner.

export const SCHEMA_VERSION = 1

export interface Record {
  id: string
  schemaVersion: number
  ownerId?: string
  createdAt: number
  updatedAt: number
}

export interface Production extends Record {
  title: string
  sceneOrder: string[]
  // Set on the built-in sample productions (see samples.ts), so missing ones can be restored.
  sampleId?: string
}

export type Setting = 'INT' | 'EXT' | 'INT/EXT'
export type TimeOfDay = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | 'MORNING' | 'EVENING' | 'CONTINUOUS'
export const SETTINGS: Setting[] = ['INT', 'EXT', 'INT/EXT']
export const TIMES_OF_DAY: TimeOfDay[] = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'EVENING', 'CONTINUOUS']

export interface Scene extends Record {
  productionId: string
  number: string // "12", "12A"
  setting: Setting
  location: string
  timeOfDay: TimeOfDay
  synopsis: string
  setupOrder: string[]
  frameOrder: string[]
  // Storyboard panels in reading order → frame id; always a whole number of 6-panel pages.
  boardSlots: Array<string | null>
}

export type CaptureKind = 'setup' | 'frame'
export type ShotSize = 'EWS' | 'WS' | 'MWS' | 'MS' | 'MCU' | 'CU' | 'ECU' | 'INSERT'
export const SHOT_SIZES: ShotSize[] = ['EWS', 'WS', 'MWS', 'MS', 'MCU', 'CU', 'ECU', 'INSERT']

export interface ShotCamera {
  name: string
  lensMm: number
  tStop: number
  iso: number
  shutter: string
  nd: number
  wbK: number
  heightM: number
  tiltDeg: number
}

export interface Shot {
  size: ShotSize
  movement: string
  action: string
  dialogue: string
  camera: ShotCamera
}

export interface Capture extends Record {
  sceneId: string
  kind: CaptureKind
  number: string
  name: string
  description: string
  starred: boolean
  archived: boolean
  imageId: string
  thumbId: string
  // The whole scene (walls, openings, rooms, items, lux, active camera) so it can be reopened.
  sceneJson: string
  shot?: Shot
}

export const slugLine = (s: Pick<Scene, 'number' | 'setting' | 'location' | 'timeOfDay'>): string =>
  `${s.number} · ${s.setting}. ${(s.location || 'UNTITLED').toUpperCase()} — ${s.timeOfDay}`

export const captureLabel = (scene: Pick<Scene, 'number'>, c: Pick<Capture, 'kind' | 'number'>): string =>
  `Sc ${scene.number} · ${c.kind === 'setup' ? 'Setup' : 'Shot'} ${c.number}`

export function newRecordId(): string {
  const c = (typeof crypto !== 'undefined' ? crypto : null) as (Crypto & { randomUUID?: () => string }) | null
  if (c?.randomUUID) return c.randomUUID()
  // Non-secure contexts (plain http on a LAN address) lack randomUUID.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

export function stamp(): Record {
  const now = Date.now()
  return { id: newRecordId(), schemaVersion: SCHEMA_VERSION, createdAt: now, updatedAt: now }
}
