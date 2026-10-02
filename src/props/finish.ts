import { Finish, MaterialKind, PatternKind } from '../scene/types'

// Material types: physical defaults, the patterns that suit them, and curated swatches.

export interface MaterialInfo {
  label: string
  roughness: number
  metalness: number
  opacity: number
  pattern: PatternKind
  scale: number // metres per pattern tile by default
  swatches: Array<{ name: string; colour: string; colour2?: string }>
}

export const MATERIALS: Record<MaterialKind, MaterialInfo> = {
  wood: {
    label: 'Wood', roughness: 0.55, metalness: 0, opacity: 1, pattern: 'grain', scale: 0.6,
    swatches: [
      { name: 'Oak', colour: '#b98a5a', colour2: '#9c6f43' }, { name: 'White oak', colour: '#d2b48c', colour2: '#b89a72' },
      { name: 'Walnut', colour: '#5d4030', colour2: '#45301f' }, { name: 'Ash', colour: '#d9c7a8', colour2: '#c1ad8c' },
      { name: 'Teak', colour: '#a0703d', colour2: '#825829' }, { name: 'Cherry', colour: '#8f4a32', colour2: '#723622' },
      { name: 'Pine', colour: '#dcb27a', colour2: '#c39860' }, { name: 'Ebonised', colour: '#2a2522', colour2: '#1c1816' }
    ]
  },
  painted: {
    label: 'Painted', roughness: 0.6, metalness: 0, opacity: 1, pattern: 'none', scale: 1,
    swatches: [
      { name: 'Warm white', colour: '#efeae0' }, { name: 'Off-black', colour: '#2b2b2d' }, { name: 'Sage', colour: '#9aa88f' },
      { name: 'Navy', colour: '#2f3b55' }, { name: 'Terracotta', colour: '#b5654a' }, { name: 'Mustard', colour: '#c99b3b' },
      { name: 'Dusty pink', colour: '#d2a3a0' }, { name: 'Forest', colour: '#3c5641' }
    ]
  },
  fabric: {
    label: 'Fabric', roughness: 0.95, metalness: 0, opacity: 1, pattern: 'weave', scale: 0.08,
    swatches: [
      { name: 'Oatmeal linen', colour: '#d8cdb8' }, { name: 'Charcoal', colour: '#4a4b4f' }, { name: 'Stone', colour: '#a9a294' },
      { name: 'Indigo', colour: '#33456b' }, { name: 'Rust', colour: '#a5532f' }, { name: 'Olive', colour: '#6f6f45' },
      { name: 'Blush', colour: '#d9b2a8' }, { name: 'White', colour: '#f1eee8' }
    ]
  },
  velvet: {
    label: 'Velvet', roughness: 0.75, metalness: 0, opacity: 1, pattern: 'none', scale: 0.2,
    swatches: [
      { name: 'Emerald', colour: '#1f5a46' }, { name: 'Oxblood', colour: '#5e1f24' }, { name: 'Midnight', colour: '#1f2742' },
      { name: 'Ochre', colour: '#b0802c' }, { name: 'Dusty rose', colour: '#b9827f' }, { name: 'Teal', colour: '#1f5d63' }
    ]
  },
  leather: {
    label: 'Leather', roughness: 0.45, metalness: 0, opacity: 1, pattern: 'none', scale: 0.3,
    swatches: [
      { name: 'Tan', colour: '#a86b3c' }, { name: 'Cognac', colour: '#8a4a26' }, { name: 'Black', colour: '#1f1d1c' },
      { name: 'Chocolate', colour: '#4a2f22' }, { name: 'Cream', colour: '#e6d8bf' }
    ]
  },
  metal: {
    label: 'Metal', roughness: 0.35, metalness: 1, opacity: 1, pattern: 'none', scale: 1,
    swatches: [
      { name: 'Brass', colour: '#c9a04f' }, { name: 'Bronze', colour: '#8c6a43' }, { name: 'Chrome', colour: '#d6d8db' },
      { name: 'Brushed steel', colour: '#a7a9ac' }, { name: 'Black steel', colour: '#2a2b2d' }, { name: 'Copper', colour: '#b5714a' }
    ]
  },
  stone: {
    label: 'Stone / marble', roughness: 0.3, metalness: 0, opacity: 1, pattern: 'marble', scale: 0.8,
    swatches: [
      { name: 'Carrara', colour: '#ecebe8', colour2: '#9fa3a8' }, { name: 'Nero', colour: '#1f1f21', colour2: '#e0dcd2' },
      { name: 'Travertine', colour: '#d9c9a8', colour2: '#bfa983' }, { name: 'Green marble', colour: '#2f4a3c', colour2: '#d6dccf' },
      { name: 'Terrazzo', colour: '#e6e1d8', colour2: '#b0634a' }
    ]
  },
  concrete: {
    label: 'Concrete', roughness: 0.85, metalness: 0, opacity: 1, pattern: 'none', scale: 1,
    swatches: [{ name: 'Grey', colour: '#9a9893' }, { name: 'Light', colour: '#c4c1ba' }, { name: 'Dark', colour: '#5f5e5a' }]
  },
  glass: {
    label: 'Glass', roughness: 0.05, metalness: 0, opacity: 0.25, pattern: 'none', scale: 1,
    swatches: [{ name: 'Clear', colour: '#e8f0f2' }, { name: 'Smoked', colour: '#4a4f52' }, { name: 'Green', colour: '#8fb59a' }, { name: 'Amber', colour: '#c98a3a' }]
  },
  mirror: {
    label: 'Mirror', roughness: 0.03, metalness: 1, opacity: 1, pattern: 'none', scale: 1,
    swatches: [{ name: 'Silver', colour: '#e4e7ea' }, { name: 'Antique', colour: '#b9b19c' }, { name: 'Smoked', colour: '#6d7174' }]
  },
  ceramic: {
    label: 'Ceramic', roughness: 0.25, metalness: 0, opacity: 1, pattern: 'none', scale: 0.3,
    swatches: [
      { name: 'White', colour: '#f2f1ec' }, { name: 'Sand', colour: '#d8c4a4' }, { name: 'Celadon', colour: '#a9c2ad' },
      { name: 'Cobalt', colour: '#2d4a8a' }, { name: 'Black', colour: '#252527' }, { name: 'Terracotta', colour: '#b5653f' }
    ]
  },
  plastic: {
    label: 'Plastic', roughness: 0.4, metalness: 0, opacity: 1, pattern: 'none', scale: 1,
    swatches: [{ name: 'White', colour: '#f2f2f0' }, { name: 'Black', colour: '#202022' }, { name: 'Grey', colour: '#8d8f93' }, { name: 'Red', colour: '#c0392b' }, { name: 'Yellow', colour: '#e8b923' }]
  },
  rattan: {
    label: 'Rattan / wicker', roughness: 0.8, metalness: 0, opacity: 1, pattern: 'rattan', scale: 0.12,
    swatches: [{ name: 'Natural', colour: '#c8a273', colour2: '#9c7a4f' }, { name: 'Honey', colour: '#b98b4c', colour2: '#8e6532' }, { name: 'Black', colour: '#2b2724', colour2: '#171513' }]
  },
  paper: {
    label: 'Paper / canvas', roughness: 0.9, metalness: 0, opacity: 1, pattern: 'none', scale: 1,
    swatches: [{ name: 'Canvas', colour: '#ece6d8' }, { name: 'Kraft', colour: '#b48e62' }, { name: 'White', colour: '#f7f6f2' }]
  },
  plant: {
    label: 'Plant', roughness: 0.7, metalness: 0, opacity: 1, pattern: 'none', scale: 1,
    swatches: [
      { name: 'Leaf green', colour: '#4f7a3a' }, { name: 'Deep green', colour: '#2f5230' }, { name: 'Olive', colour: '#7d8a55' },
      { name: 'Variegated', colour: '#8fae5c' }, { name: 'Dried', colour: '#b39a6a' }
    ]
  },
  glow: {
    label: 'Glow (screen / shade)', roughness: 0.9, metalness: 0, opacity: 1, pattern: 'none', scale: 1,
    swatches: [{ name: 'Warm', colour: '#ffd9a0' }, { name: 'Neutral', colour: '#fff4e6' }, { name: 'Screen blue', colour: '#9cc6ff' }]
  }
}

export const MATERIAL_ORDER: MaterialKind[] = ['wood', 'painted', 'fabric', 'velvet', 'leather', 'metal', 'stone', 'concrete', 'glass', 'mirror', 'ceramic', 'plastic', 'rattan', 'paper', 'plant', 'glow']

export const PATTERNS: Array<{ id: PatternKind; label: string }> = [
  { id: 'none', label: 'Plain' }, { id: 'grain', label: 'Wood grain' }, { id: 'weave', label: 'Weave' },
  { id: 'boucle', label: 'Bouclé' }, { id: 'stripes', label: 'Stripes' }, { id: 'check', label: 'Check / plaid' },
  { id: 'herringbone', label: 'Herringbone' }, { id: 'chevron', label: 'Chevron' }, { id: 'polka', label: 'Polka dot' },
  { id: 'floral', label: 'Floral' }, { id: 'geometric', label: 'Geometric' }, { id: 'marble', label: 'Marble' },
  { id: 'terrazzo', label: 'Terrazzo' }, { id: 'tiles', label: 'Tiles' }, { id: 'brick', label: 'Brick' },
  { id: 'rattan', label: 'Rattan weave' }, { id: 'planks', label: 'Planks' }, { id: 'image', label: 'My image…' }
]

// A complete finish for a material, with anything given overriding the material's defaults.
export function makeFinish(partial: Partial<Finish> & { material: MaterialKind }): Finish {
  const m = MATERIALS[partial.material]
  const sw = m.swatches[0]
  return {
    material: partial.material,
    colour: partial.colour ?? sw.colour,
    pattern: partial.pattern ?? m.pattern,
    colour2: partial.colour2 ?? sw.colour2 ?? shade(partial.colour ?? sw.colour, -0.18),
    scale: partial.scale ?? m.scale,
    rotation: partial.rotation ?? 0,
    roughness: partial.roughness ?? m.roughness,
    metalness: partial.metalness ?? m.metalness,
    opacity: partial.opacity ?? m.opacity,
    imageId: partial.imageId ?? null
  }
}

// Switching material keeps the colour only when it makes sense (e.g. not a fabric colour on chrome).
export function changeMaterial(f: Finish, material: MaterialKind): Finish {
  return makeFinish({ material, colour: MATERIALS[material].swatches[0].colour })
}

// Lighten (+) or darken (−) a hex colour.
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', ''), 16)
  const ch = (s: number) => {
    const v = (n >> s) & 255
    return Math.round(Math.min(255, Math.max(0, amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))))
  }
  return '#' + [16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')
}

// Finishes for the plain floor presets, so a room's floor can be opened up in the finish editor.
export const FLOOR_PRESETS: Record<'wood' | 'tile' | 'concrete' | 'carpet', Finish> = {
  wood: makeFinish({ material: 'wood', colour: '#8a5a3a', colour2: '#6e4429', pattern: 'planks', scale: 1.1 }),
  tile: makeFinish({ material: 'ceramic', colour: '#d9d6cf', colour2: '#9a958c', pattern: 'tiles', scale: 0.6, roughness: 0.3 }),
  concrete: makeFinish({ material: 'concrete', colour: '#6b6a67' }),
  carpet: makeFinish({ material: 'fabric', colour: '#4d4741', pattern: 'weave', scale: 0.05 })
}
export const PLAIN_WALL: Finish = makeFinish({ material: 'painted', colour: '#c9c8c4', roughness: 0.85 })
export const PLAIN_CEILING: Finish = makeFinish({ material: 'painted', colour: '#d7d6d2', roughness: 0.9 })
