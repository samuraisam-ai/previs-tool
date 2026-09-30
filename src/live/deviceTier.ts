import { TierId } from './renderState'

// Picks a starting quality tier for this device. The Auto setting then fine-tunes render
// resolution from the measured frame rate, so this only needs to be roughly right.

export interface DeviceInfo {
  webgl2: boolean
  gpu: string
  memoryGB: number | null
  cores: number
  tier: TierId
  reason: string
}

export function detectDevice(): DeviceInfo {
  const canvas = document.createElement('canvas')
  const gl = canvas.getContext('webgl2')
  const memoryGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? null
  const cores = navigator.hardwareConcurrency || 4
  if (!gl) return { webgl2: false, gpu: 'none', memoryGB, cores, tier: 'lite', reason: 'WebGL2 unavailable' }
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  const gpu = String(info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER))
  gl.getExtension('WEBGL_lose_context')?.loseContext()

  const has = (re: RegExp) => re.test(gpu)
  let tier: TierId = 'standard'
  let reason = 'default'
  if (has(/SwiftShader|llvmpipe|Software|Microsoft Basic/i)) { tier = 'lite'; reason = 'software rendering' }
  else if (has(/GeForce|RTX|GTX|Quadro|Radeon (RX|Pro)|Arc A/i)) { tier = 'high'; reason = 'discrete GPU' }
  else if (has(/Apple M\d (Pro|Max|Ultra)/i)) { tier = 'high'; reason = 'Apple Pro/Max GPU' }
  else if (has(/Apple (M\d|GPU)/i)) { tier = 'standard'; reason = 'Apple integrated GPU' }
  else if (has(/Iris/i)) { tier = 'standard'; reason = 'Intel Iris' }
  else if (has(/Intel|UHD|HD Graphics|Mali|Adreno|PowerVR/i)) { tier = 'lite'; reason = 'entry-level integrated GPU' }
  if (memoryGB !== null && memoryGB <= 4 && tier !== 'lite') { tier = 'lite'; reason += ', ≤4 GB memory' }
  if (cores <= 2 && tier === 'high') { tier = 'standard'; reason += ', 2 cores' }
  return { webgl2: true, gpu, memoryGB, cores, tier, reason }
}
