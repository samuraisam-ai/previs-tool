// Light colour helpers. Output colours are linear RGB normalised to unit luminance, so changing
// colour never changes brightness — output is handled separately in candela.

export type RGB = [number, number, number]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Tanner Helland's blackbody approximation (1000–40000K), sRGB 0–1.
export function kelvinToSrgb(kelvin: number): RGB {
  const t = kelvin / 100
  const r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592)
  const g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492)
  const b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307
  return [clamp01(r / 255), clamp01(g / 255), clamp01(b / 255)]
}

export function hsvToSrgb(hue: number, sat: number): RGB {
  const h = ((hue % 360) + 360) % 360 / 60
  const s = clamp01(sat)
  const c = s
  const x = c * (1 - Math.abs((h % 2) - 1))
  const [r, g, b] = h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x]
  const m = 1 - s
  return [r + m, g + m, b + m]
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4))
const toSrgb = (v: number) => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)

export function srgbToLinear(rgb: RGB): RGB {
  return [toLinear(rgb[0]), toLinear(rgb[1]), toLinear(rgb[2])]
}

export function luminance(rgb: RGB): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]
}

// gm: -100 (full green) … +100 (full magenta), roughly ±1/4 stop of green.
export function lightColour(mode: 'cct' | 'hsi', cct: number, gm: number, hue: number, sat: number): RGB {
  const srgb = mode === 'hsi' ? hsvToSrgb(hue, sat / 100) : kelvinToSrgb(cct)
  const linear = srgbToLinear(srgb)
  if (mode === 'cct') linear[1] *= 1 - gm * 0.0025
  const lum = luminance(linear) || 1
  return [linear[0] / lum, linear[1] / lum, linear[2] / lum]
}

// Display hex for UI swatches (max channel scaled to 1).
export function toHex(linear: RGB): string {
  const max = Math.max(...linear) || 1
  return '#' + linear.map(v => Math.round(clamp01(toSrgb(v / max)) * 255).toString(16).padStart(2, '0')).join('')
}
