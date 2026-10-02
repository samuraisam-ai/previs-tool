import { Finish, MaterialKind, PatternKind } from '../scene/types'

// A catalogue prop is a small generator: from real dimensions and options it builds the 3D parts
// (through the Kit, so catalogue files never touch Babylon) and the 2D plan symbol.
//
// Prop-local space, in metres: x across (−w/2 … w/2), y up from the prop's base, z front-to-back
// with +z the FRONT (the side you sit on / look at). Rotation 0 faces up the plan (+z).

export type V3 = [number, number, number]

export type RoomTag = 'bedroom' | 'living' | 'kitchen' | 'dining' | 'bathroom' | 'office' | 'hallway' | 'outdoor'
export type Category = RoomTag | 'decor' | 'plants' | 'practicals' | 'build'

export const ROOMS: Array<{ id: Category; label: string }> = [
  { id: 'bedroom', label: 'Bedroom' },
  { id: 'living', label: 'Living room' },
  { id: 'kitchen', label: 'Kitchen' },
  { id: 'dining', label: 'Dining' },
  { id: 'bathroom', label: 'Bathroom' },
  { id: 'office', label: 'Office / Study' },
  { id: 'hallway', label: 'Hallway & entry' },
  { id: 'outdoor', label: 'Outdoor' }
]
export const GROUPS: Array<{ id: Category; label: string }> = [
  { id: 'decor', label: 'Decor & art' },
  { id: 'plants', label: 'Plants & flowers' },
  { id: 'practicals', label: 'Practicals (lamps)' },
  { id: 'build', label: 'Build pieces' }
]

export interface PartOpts {
  rot?: V3 // degrees about x, y, z
  scale?: V3 // stretch the shape (applied before rotation)
  // Keep the shape's own 0–1 UVs (artwork, screens) instead of real-world-scaled pattern UVs.
  fit?: boolean
  // Small details are left out of shadow casting on the Lite tier.
  small?: boolean
}

// Shape-building helpers available to catalogue generators. Positions are part centres unless noted.
export interface Kit {
  box(slot: string, size: V3, at: V3, opts?: PartOpts): void
  // Rounded-edge box (cushions, mattresses, upholstery). radius in metres.
  soft(slot: string, size: V3, at: V3, radius?: number, opts?: PartOpts): void
  cylinder(slot: string, dims: { d?: number; dTop?: number; dBottom?: number; h: number; sides?: number }, at: V3, opts?: PartOpts): void
  // Ellipsoid with diameters (x, y, z).
  sphere(slot: string, d: V3, at: V3, opts?: PartOpts & { segments?: number }): void
  // Surface of revolution about the y axis; profile is [radius, y] pairs from bottom to top. `at` is the base centre.
  lathe(slot: string, profile: Array<[number, number]>, at: V3, opts?: PartOpts & { sides?: number }): void
  // Tube along a path of points with radius r.
  tube(slot: string, path: V3[], r: number, opts?: PartOpts & { sides?: number }): void
  torus(slot: string, dims: { d: number; thickness: number }, at: V3, opts?: PartOpts): void
  // An outline in the x/y plane (counter-clockwise points), extruded `depth` along z, centred on `at`.
  prism(slot: string, outline: Array<[number, number]>, depth: number, at: V3, opts?: PartOpts): void
  // Flat rectangle facing +z (before rotation).
  plane(slot: string, size: { w: number; h: number }, at: V3, opts?: PartOpts & { doubleSided?: boolean }): void
  // Leaf cards / foliage clump: a cheap cluster of crossed planes.
  foliage(slot: string, dims: { w: number; h: number; d: number }, at: V3, opts?: PartOpts & { count?: number; leaf?: number; seed?: number }): void
}

// ── 2D plan symbols ───────────────────────────────────────────────────────────
// 'body' = main outline, filled with a tint of the prop's colour; 'soft' = lighter fill (cushions,
// pillows, mattress); 'line' = detail line; 'glass' = blue-ish outline; 'hidden' = dashed (overhead).
export type PlanClass = 'body' | 'soft' | 'line' | 'glass' | 'hidden'
export type PlanShape =
  | { t: 'rect'; x: number; z: number; w: number; d: number; r?: number; rot?: number; cls?: PlanClass; tint?: string }
  | { t: 'circle'; x: number; z: number; r: number; cls?: PlanClass; tint?: string }
  | { t: 'ellipse'; x: number; z: number; rx: number; rz: number; cls?: PlanClass; tint?: string }
  | { t: 'path'; pts: Array<[number, number]>; closed?: boolean; cls?: PlanClass; tint?: string }

// ── Options and finish slots ──────────────────────────────────────────────────
export type OptionValue = string | number | boolean
export interface OptionDef {
  id: string
  label: string
  type: 'select' | 'number' | 'toggle'
  choices?: Array<{ value: string; label: string }>
  min?: number
  max?: number
  step?: number
  default: OptionValue
}

export interface SlotDef {
  id: string
  label: string
  default: Partial<Finish> & { material: MaterialKind }
}

export interface PropParams {
  w: number
  d: number
  h: number
  o: { [id: string]: OptionValue }
}

export interface PropDef {
  id: string
  name: string
  category: Category
  rooms: RoomTag[] // also listed under these rooms
  keywords?: string[]
  size: { w: number; d: number; h: number }
  min?: { w: number; d: number; h: number }
  options?: OptionDef[]
  slots: SlotDef[]
  mount: 'floor' | 'wall' | 'surface' | 'ceiling'
  elevation?: number // default base height (wall art, pendants…)
  // Height of the top surface other props can stand on, relative to the base.
  surfaceTop?: (p: PropParams) => number
  // Some options set the footprint (e.g. bed size, sofa seats): return the new size, or null when
  // the changed option doesn't affect it. `changed` is undefined when the prop is first created.
  sizeFor?: (o: { [id: string]: OptionValue }, current: { w: number; d: number; h: number }, changed?: string) => { w: number; d: number; h: number } | null
  // Slot that can show the user's own picture (paintings, posters, frames, screens).
  imageSlot?: string
  // Resize the prop to the picture's proportions when one is chosen (art, posters, photos).
  fitImage?: boolean
  // Practical lamps: where the bulb sits (prop-local), the fixture to use, and the slot that glows.
  bulb?: (p: PropParams) => V3
  practical?: { fixture: string; glowSlot: string }
  build(kit: Kit, p: PropParams): void
  plan(p: PropParams): PlanShape[]
}

export type { MaterialKind, PatternKind }
