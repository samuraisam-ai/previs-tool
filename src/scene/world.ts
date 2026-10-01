import { WorldLight, WorldPreset } from './types'

// Ambient light reaching an interior from outside, by time of day. Values are for the light
// falling inside a room (not open sky), with typical colour temperatures:
// - Morning: low sun + skylight, slightly warm.
// - Day: midday skylight through windows, neutral-cool.
// - Evening: sunset / golden hour, warm.
// - Night: moonlight. Real moonlight measures ≈ 4100 K, but film convention renders night cool
//   blue, so the preset follows the convention (type any Kelvin to override).
export const WORLD_PRESETS: Record<WorldPreset, { label: string; lux: number; kelvin: number; note: string }> = {
  morning: { label: 'Morning', lux: 150, kelvin: 4300, note: 'Low sun + skylight, slightly warm' },
  day: { label: 'Day', lux: 400, kelvin: 6000, note: 'Midday skylight through windows' },
  evening: { label: 'Evening', lux: 40, kelvin: 3000, note: 'Sunset / golden hour, warm' },
  night: { label: 'Night', lux: 1, kelvin: 7500, note: 'Moonlight (cool by film convention; real ≈ 4100 K)' }
}
export const WORLD_ORDER: WorldPreset[] = ['morning', 'day', 'evening', 'night']

// Matches the previous fixed 0.5 lux base fill, so existing scenes look the same.
export const defaultWorld = (): WorldLight => ({ preset: 'night', percent: 50, kelvin: WORLD_PRESETS.night.kelvin, blackout: false })

// Effective ambient illuminance in lux (0 in blackout).
export const worldLux = (w: WorldLight): number => (w.blackout ? 0 : (WORLD_PRESETS[w.preset].lux * w.percent) / 100)

export function formatLux(lux: number): string {
  if (lux === 0) return '0 lux'
  if (lux < 1) return `${lux.toFixed(2)} lux`
  if (lux < 10) return `${lux.toFixed(1)} lux`
  return `${Math.round(lux)} lux`
}

export const worldSummary = (w: WorldLight): string =>
  w.blackout ? 'Blackout (fixtures only)' : `${WORLD_PRESETS[w.preset].label} · ${Math.round(w.percent)}% ≈ ${formatLux(worldLux(w))} · ${w.kelvin} K`

// Older saved scenes had a bare `ambientLux`; map it onto the Night preset.
export function worldFrom(doc: { world?: WorldLight; ambientLux?: number }): WorldLight {
  if (doc.world) return { ...defaultWorld(), ...doc.world }
  if (typeof doc.ambientLux === 'number') return { ...defaultWorld(), percent: Math.min(200, Math.max(0, doc.ambientLux * 100)) }
  return defaultWorld()
}
