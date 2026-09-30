// Lens kits. Sigma Aizu Prime Line: E-mount cine primes, T1.3–T22, 13-blade iris, ⌀46.3 mm image circle.
// Close focus is published for the 35mm (0.35 m); the rest are estimates (`approx`).

export interface Lens {
  id: string
  kit: string
  name: string
  focalLength: number // mm
  maxT: number
  minT: number
  closeFocus: number // m
  blades: number
  approx?: boolean
}

const aizu = (focalLength: number, closeFocus: number, approx = true): Lens => ({
  id: `aizu-${focalLength}`,
  kit: 'Sigma Aizu Prime Line',
  name: `Aizu ${focalLength}mm T1.3`,
  focalLength,
  maxT: 1.3,
  minT: 22,
  closeFocus,
  blades: 13,
  approx
})

export const LENSES: Lens[] = [
  aizu(18, 0.3),
  aizu(21, 0.3),
  aizu(25, 0.3),
  aizu(27, 0.3),
  aizu(32, 0.35),
  aizu(35, 0.35, false),
  aizu(40, 0.4),
  aizu(50, 0.45),
  aizu(65, 0.6),
  aizu(75, 0.7),
  aizu(100, 0.9),
  aizu(125, 1.1)
]

export const DEFAULT_LENS = 'aizu-35'

export function getLens(id: string): Lens {
  return LENSES.find(lens => lens.id === id) ?? LENSES[5]
}
