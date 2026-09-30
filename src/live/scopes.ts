import { FrameCapture } from './LiveScene'

// Video scopes drawn from a captured frame (display-referred 8-bit RGB, bottom-up rows as read
// from WebGL). Each frame is decimated to at most ~256×144 samples.

const MAX_COLS = 256
const MAX_ROWS = 144

interface Samples {
  cols: number
  rows: number
  // r, g, b in 0–1 per sample, row-major top-down.
  rgb: Float32Array
}

export function sample(frame: FrameCapture): Samples {
  const sx = Math.max(1, Math.ceil(frame.width / MAX_COLS))
  const sy = Math.max(1, Math.ceil(frame.height / MAX_ROWS))
  const cols = Math.floor(frame.width / sx)
  const rows = Math.floor(frame.height / sy)
  const rgb = new Float32Array(cols * rows * 3)
  for (let row = 0; row < rows; row++) {
    const srcRow = frame.height - 1 - row * sy
    for (let col = 0; col < cols; col++) {
      const i = (srcRow * frame.width + col * sx) * 4
      const o = (row * cols + col) * 3
      rgb[o] = frame.data[i] / 255
      rgb[o + 1] = frame.data[i + 1] / 255
      rgb[o + 2] = frame.data[i + 2] / 255
    }
  }
  return { cols, rows, rgb }
}

const luma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b

function graticule(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'
  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '8px sans-serif'
  ctx.lineWidth = 1
  for (let ire = 0; ire <= 100; ire += 10) {
    const y = Math.round((1 - ire / 100) * (h - 1)) + 0.5
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(w, y)
    ctx.stroke()
    if (ire % 50 === 0) ctx.fillText(String(ire), 2, Math.min(h - 2, Math.max(8, y - 2)))
  }
}

export function drawHistogram(ctx: CanvasRenderingContext2D, s: Samples): void {
  const { width: w, height: h } = ctx.canvas
  const bins = [new Float32Array(w), new Float32Array(w), new Float32Array(w), new Float32Array(w)]
  for (let i = 0; i < s.rgb.length; i += 3) {
    const r = s.rgb[i], g = s.rgb[i + 1], b = s.rgb[i + 2]
    bins[0][Math.min(w - 1, Math.floor(r * w))]++
    bins[1][Math.min(w - 1, Math.floor(g * w))]++
    bins[2][Math.min(w - 1, Math.floor(b * w))]++
    bins[3][Math.min(w - 1, Math.floor(luma(r, g, b) * w))]++
  }
  let max = 1
  for (let i = 0; i < w; i++) max = Math.max(max, bins[3][i])
  ctx.clearRect(0, 0, w, h)
  const draw = (bin: Float32Array, style: string) => {
    ctx.fillStyle = style
    for (let x = 0; x < w; x++) {
      const bh = Math.sqrt(bin[x] / max) * (h - 2)
      ctx.fillRect(x, h - bh, 1, bh)
    }
  }
  ctx.globalCompositeOperation = 'lighter'
  draw(bins[0], 'rgba(255,60,60,0.35)')
  draw(bins[1], 'rgba(60,255,60,0.35)')
  draw(bins[2], 'rgba(80,120,255,0.35)')
  ctx.globalCompositeOperation = 'source-over'
  draw(bins[3], 'rgba(235,235,235,0.55)')
  // Clipping markers.
  ctx.fillStyle = 'rgba(255,255,255,0.15)'
  ctx.fillRect(w - 1, 0, 1, h)
}

// Waveform: overlay = R, G, B traced on one graticule; parade = R | G | B side by side.
export function drawWaveform(ctx: CanvasRenderingContext2D, s: Samples, parade: boolean): void {
  const { width: w, height: h } = ctx.canvas
  const counts = new Float32Array(w * h * 3)
  const panelW = parade ? Math.floor(w / 3) : w
  for (let row = 0; row < s.rows; row++) {
    for (let col = 0; col < s.cols; col++) {
      const o = (row * s.cols + col) * 3
      const x = Math.floor((col / s.cols) * panelW)
      for (let c = 0; c < 3; c++) {
        const y = Math.round((1 - s.rgb[o + c]) * (h - 1))
        const px = parade ? x + c * panelW : x
        counts[(y * w + px) * 3 + c]++
      }
    }
  }
  // Soft exposure curve like a phosphor trace: sparse samples glow faintly, dense ones saturate.
  const glow = (n: number) => 255 * (1 - Math.exp(-n / 4))
  const image = ctx.createImageData(w, h)
  for (let i = 0; i < w * h; i++) {
    image.data[i * 4] = glow(counts[i * 3])
    image.data[i * 4 + 1] = glow(counts[i * 3 + 1])
    image.data[i * 4 + 2] = glow(counts[i * 3 + 2])
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)
  graticule(ctx, w, h)
  if (parade) {
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ;[1, 2].forEach(i => {
      ctx.beginPath()
      ctx.moveTo(i * panelW + 0.5, 0)
      ctx.lineTo(i * panelW + 0.5, h)
      ctx.stroke()
    })
  }
}

// Rec.709 colour difference; Cb right, Cr up. ±0.5 maps to the graticule edge.
const cbcr = (r: number, g: number, b: number): [number, number] => {
  const y = luma(r, g, b)
  return [(b - y) / 1.8556, (r - y) / 1.5748]
}

const TARGETS: Array<[string, number, number, number]> = [
  ['R', 0.75, 0, 0], ['Mg', 0.75, 0, 0.75], ['B', 0, 0, 0.75],
  ['Cy', 0, 0.75, 0.75], ['G', 0, 0.75, 0], ['Yl', 0.75, 0.75, 0]
]

export function drawVectorscope(ctx: CanvasRenderingContext2D, s: Samples): void {
  const { width: w, height: h } = ctx.canvas
  const size = Math.min(w, h)
  const cx = w / 2
  const cy = h / 2
  const radius = size / 2 - 4
  const scale = radius / 0.5
  const counts = new Float32Array(w * h)
  for (let i = 0; i < s.rgb.length; i += 3) {
    const [cb, cr] = cbcr(s.rgb[i], s.rgb[i + 1], s.rgb[i + 2])
    const x = Math.round(cx + cb * scale)
    const y = Math.round(cy - cr * scale)
    if (x >= 0 && x < w && y >= 0 && y < h) counts[y * w + x]++
  }
  const image = ctx.createImageData(w, h)
  const gain = 40 / Math.max(1, s.cols * s.rows / 4000)
  for (let i = 0; i < w * h; i++) {
    const v = Math.min(1, counts[i] * gain / 10)
    image.data[i * 4] = 120 * v
    image.data[i * 4 + 1] = 255 * v
    image.data[i * 4 + 2] = 140 * v
    image.data[i * 4 + 3] = 255
  }
  ctx.putImageData(image, 0, 0)

  ctx.strokeStyle = 'rgba(255,255,255,0.2)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.arc(cx, cy, radius, 0, Math.PI * 2)
  ctx.moveTo(cx - radius, cy)
  ctx.lineTo(cx + radius, cy)
  ctx.moveTo(cx, cy - radius)
  ctx.lineTo(cx, cy + radius)
  ctx.stroke()
  // Skin-tone line (~123° from +Cb).
  ctx.strokeStyle = 'rgba(255,190,150,0.45)'
  ctx.beginPath()
  ctx.moveTo(cx, cy)
  ctx.lineTo(cx + Math.cos(123 * Math.PI / 180) * radius, cy - Math.sin(123 * Math.PI / 180) * radius)
  ctx.stroke()
  // 75% colour-bar targets.
  ctx.font = '8px sans-serif'
  TARGETS.forEach(([name, r, g, b]) => {
    const [cb, cr] = cbcr(r, g, b)
    const x = cx + cb * scale
    const y = cy - cr * scale
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'
    ctx.strokeRect(x - 3, y - 3, 6, 6)
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.fillText(name, x + 5, y + 3)
  })
}
