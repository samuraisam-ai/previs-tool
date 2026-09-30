// Types for the lighting library. Distances are metres, angles are full-cone degrees.

export type FixtureCategory = 'spot' | 'panel' | 'tube' | 'practical'
export type ColourType = 'daylight' | 'bicolor' | 'rgb'
export type Mount = 'bowens' | 'fm' | 'none'

// The light-emitting part of the fixture itself (before any modifier).
export type FixtureShape =
  | { type: 'cob'; size: number } // head size, used for the 3D body
  | { type: 'rect'; w: number; h: number }
  | { type: 'tube'; length: number }
  | { type: 'bulb' }

export interface Fixture {
  id: string
  brand: 'Nanlite' | 'Nanlux'
  family: string
  model: string
  category: FixtureCategory
  colour: ColourType
  cct: [number, number]
  watts: number
  // Illuminance on-axis at 1 m, 5600K. COBs: with the included reflector. Equals candela.
  luxAt1m: number
  // Omni sources (bulbs) are specified in lumens instead.
  lumens?: number
  // Beam angle of the bare fixture (panels, tubes, pocket lights).
  beam: number
  shape: FixtureShape
  mount: Mount
  // true when a spec was estimated from sibling models rather than confirmed.
  approx?: boolean
  note?: string
}

export type ModifierKind =
  | 'bare' | 'reflector' | 'softbox' | 'strip' | 'octa' | 'parabolic'
  | 'lantern' | 'dish' | 'fresnel' | 'projection' | 'panel-softbox' | 'grid'

export interface Modifier {
  id: string
  name: string
  code?: string
  kind: ModifierKind
  // Which fixtures accept it: a mount, or a specific fixture family (panel accessories).
  mount?: Mount
  family?: string
  // Front face in metres (w × h), or diameter for round modifiers.
  w: number
  h: number
  depth: number
  // Fixed beam angle, or a [spot, flood] zoom range.
  beam: number | [number, number]
  // On-axis output relative to the fixture's luxAt1m spec. For zoomable modifiers this is at `transmissionAt`.
  transmission: number
  transmissionAt?: number
  omni?: boolean
  hardEdge?: boolean
  // Panel accessories grow with the panel they fit.
  sizeFromFixture?: boolean
  approx?: boolean
}

export const CATEGORY_LABELS: Record<FixtureCategory, string> = {
  spot: 'Spotlights',
  panel: 'Panels',
  tube: 'Tubes',
  practical: 'Practicals & Pocket'
}

export const COLOUR_LABELS: Record<ColourType, string> = {
  daylight: 'Daylight',
  bicolor: 'Bi-colour',
  rgb: 'Full colour'
}
