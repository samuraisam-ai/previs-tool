import { reactive } from 'vue'

// Rendering status the UI shows (written by the Live View's scene, read by panels and overlays).
export const renderState = reactive({
  // Shaders are compiling for a new light setup; the last good frame stays on screen.
  preparing: false,
  // Set dressing still being built (large scenes build over several frames): props left / total.
  building: { left: 0, total: 0 },
  // Fixtures currently casting shadows (the rest are over the shadow budget).
  shadowed: [] as string[],
  // Active quality tier and how many shadowed lights it allows.
  tier: 'standard' as TierId,
  shadowBudget: 2
})

export type TierId = 'lite' | 'standard' | 'high'

export interface Tier {
  id: TierId
  label: string
  renderScale: number // × CSS pixels (capped at the display's density)
  msaa: number
  shadowSpots: number
  shadowPoints: number
  shadowMapSize: number
  softShadows: boolean
  bokehTaps: number
  scopeIntervalMs: number
}

// Colour, exposure, bokeh size and meters are identical on every tier; only smoothness and shadow
// detail change.
export const TIERS: Record<TierId, Tier> = {
  lite: { id: 'lite', label: 'Lite', renderScale: 1, msaa: 1, shadowSpots: 1, shadowPoints: 0, shadowMapSize: 1024, softShadows: false, bokehTaps: 24, scopeIntervalMs: 500 },
  standard: { id: 'standard', label: 'Standard', renderScale: 1.5, msaa: 2, shadowSpots: 2, shadowPoints: 0, shadowMapSize: 2048, softShadows: true, bokehTaps: 48, scopeIntervalMs: 200 },
  high: { id: 'high', label: 'High', renderScale: 2, msaa: 4, shadowSpots: 4, shadowPoints: 1, shadowMapSize: 2048, softShadows: true, bokehTaps: 48, scopeIntervalMs: 200 }
}
