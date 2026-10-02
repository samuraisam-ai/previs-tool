import { PatternKind } from '../scene/types'

// Seamless (tileable) pattern textures drawn on a canvas: the same art feeds the 3D materials and
// the swatch previews in the panel. One canvas covers one pattern tile (`Finish.scale` metres).

const mulberry = (seed: number) => () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

// Draw something at (x, y) and its wrapped copies so it tiles seamlessly.
function wrapped(S: number, x: number, y: number, r: number, draw: (x: number, y: number) => void): void {
  for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) {
    if (x + dx + r < 0 || x + dx - r > S || y + dy + r < 0 || y + dy - r > S) continue
    draw(x + dx, y + dy)
  }
}

export function drawPattern(g: CanvasRenderingContext2D, S: number, pattern: PatternKind, c1: string, c2: string): void {
  const rand = mulberry(S * 7 + pattern.length * 131)
  g.save()
  g.fillStyle = c1
  g.fillRect(0, 0, S, S)
  g.fillStyle = c2
  g.strokeStyle = c2
  switch (pattern) {
    case 'grain': {
      // Long wavy grain lines with varying weight and a few knots.
      g.globalAlpha = 0.35
      for (let i = 0; i < 46; i++) {
        const y0 = rand() * S
        const amp = 2 + rand() * 6
        g.lineWidth = 0.6 + rand() * 2.2
        g.globalAlpha = 0.12 + rand() * 0.35
        g.beginPath()
        for (let x = 0; x <= S; x += 8) {
          const y = y0 + Math.sin((x / S) * Math.PI * 2 * 2 + i) * amp + Math.sin((x / S) * Math.PI * 2 * 5) * amp * 0.3
          if (x === 0) g.moveTo(x, y); else g.lineTo(x, y)
        }
        g.stroke()
      }
      break
    }
    case 'weave': {
      g.globalAlpha = 0.18
      const step = S / 64
      for (let y = 0; y < S; y += step) for (let x = 0; x < S; x += step) {
        if (((x + y) / step) % 2 < 1) g.fillRect(x, y, step, step * 0.5)
        else g.fillRect(x, y, step * 0.5, step)
      }
      break
    }
    case 'boucle': {
      for (let i = 0; i < 900; i++) {
        const x = rand() * S
        const y = rand() * S
        const r = 1.5 + rand() * 3
        g.globalAlpha = 0.15 + rand() * 0.3
        wrapped(S, x, y, r, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, Math.PI * 2); g.fill() })
      }
      break
    }
    case 'stripes': g.fillRect(0, 0, S / 2, S); break
    case 'check': {
      g.globalAlpha = 0.55
      g.fillRect(0, 0, S / 2, S)
      g.fillRect(0, 0, S, S / 2)
      g.globalAlpha = 0.35
      g.lineWidth = S / 64
      ;[S * 0.75].forEach(v => { g.beginPath(); g.moveTo(v, 0); g.lineTo(v, S); g.moveTo(0, v); g.lineTo(S, v); g.stroke() })
      break
    }
    case 'herringbone': {
      const n = 4
      const u = S / n
      g.lineWidth = Math.max(1, S / 256)
      for (let i = -n; i < n * 2; i++) {
        for (let j = 0; j < n * 2; j++) {
          const x = i * u
          const y = j * (u / 2)
          g.globalAlpha = 0.3 + ((i + j) % 3) * 0.12
          g.beginPath()
          if (j % 2 === 0) { g.moveTo(x, y); g.lineTo(x + u / 2, y + u / 2); g.lineTo(x + u / 2, y + u); g.lineTo(x, y + u / 2) } else { g.moveTo(x + u, y); g.lineTo(x + u / 2, y + u / 2); g.lineTo(x + u / 2, y + u); g.lineTo(x + u, y + u / 2) }
          g.closePath()
          g.fill()
        }
      }
      break
    }
    case 'chevron': {
      const bands = 4
      const h = S / bands
      for (let b = 0; b < bands; b += 2) {
        g.beginPath()
        g.moveTo(0, b * h); g.lineTo(S / 2, b * h + h); g.lineTo(S, b * h); g.lineTo(S, b * h + h); g.lineTo(S / 2, b * h + 2 * h); g.lineTo(0, b * h + h)
        g.closePath()
        g.fill()
      }
      break
    }
    case 'polka': {
      const n = 4
      const u = S / n
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const x = i * u + (j % 2 ? u / 2 : 0) + u / 4
        const y = j * u + u / 2
        wrapped(S, x, y, u * 0.2, (px, py) => { g.beginPath(); g.arc(px, py, u * 0.18, 0, Math.PI * 2); g.fill() })
      }
      break
    }
    case 'floral': {
      for (let i = 0; i < 9; i++) {
        const x = rand() * S
        const y = rand() * S
        const r = S * (0.035 + rand() * 0.03)
        wrapped(S, x, y, r * 3, (px, py) => {
          g.globalAlpha = 0.85
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2
            g.beginPath(); g.ellipse(px + Math.cos(a) * r, py + Math.sin(a) * r, r, r * 0.6, a, 0, Math.PI * 2); g.fill()
          }
          g.globalAlpha = 0.5
          g.beginPath(); g.arc(px, py, r * 0.5, 0, Math.PI * 2); g.fillStyle = c1; g.fill(); g.fillStyle = c2
          g.globalAlpha = 0.45
          g.beginPath(); g.ellipse(px + r * 2.4, py + r * 1.2, r * 0.9, r * 0.35, 0.6, 0, Math.PI * 2); g.fill()
        })
      }
      break
    }
    case 'geometric': {
      const n = 4
      const u = S / n
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
        const k = (i * 3 + j * 5) % 4
        g.globalAlpha = k === 0 ? 0.9 : k === 1 ? 0.55 : k === 2 ? 0.25 : 0
        g.beginPath()
        if ((i + j) % 2) { g.moveTo(i * u, j * u); g.lineTo(i * u + u, j * u); g.lineTo(i * u, j * u + u) } else { g.moveTo(i * u + u, j * u); g.lineTo(i * u + u, j * u + u); g.lineTo(i * u, j * u + u) }
        g.closePath()
        g.fill()
      }
      break
    }
    case 'marble': {
      for (let v = 0; v < 7; v++) {
        let x = rand() * S
        let y = 0
        g.lineWidth = 0.5 + rand() * (v < 2 ? 3 : 1.4)
        g.globalAlpha = 0.25 + rand() * 0.45
        g.beginPath()
        g.moveTo(x, y)
        // Random walk down the tile; it ends where it started horizontally so the tile wraps.
        const startX = x
        const steps = 40
        for (let s = 1; s <= steps; s++) {
          y = (s / steps) * S
          x = s === steps ? startX : x + (rand() - 0.5) * S * 0.08
          g.lineTo(x, y)
        }
        g.stroke()
      }
      break
    }
    case 'terrazzo': {
      const chips = ['#b0634a', '#3c5641', '#c99b3b', '#4a4b4f', c2]
      for (let i = 0; i < 160; i++) {
        const x = rand() * S
        const y = rand() * S
        const r = S * (0.006 + rand() * 0.02)
        g.fillStyle = chips[Math.floor(rand() * chips.length)]
        g.globalAlpha = 0.85
        wrapped(S, x, y, r * 1.5, (px, py) => {
          g.beginPath()
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2 + rand()
            const rr = r * (0.6 + rand() * 0.6)
            if (p === 0) g.moveTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); else g.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr)
          }
          g.closePath()
          g.fill()
        })
      }
      break
    }
    case 'tiles': {
      // One tile per texture tile; colour2 is the grout.
      g.lineWidth = Math.max(2, S / 64)
      g.strokeRect(0, 0, S, S)
      break
    }
    case 'brick': {
      g.lineWidth = Math.max(2, S / 48)
      g.beginPath()
      g.moveTo(0, 0); g.lineTo(S, 0); g.moveTo(0, S / 2); g.lineTo(S, S / 2)
      g.moveTo(0, 0); g.lineTo(0, S / 2); g.moveTo(S / 2, S / 2); g.lineTo(S / 2, S)
      g.stroke()
      break
    }
    case 'planks': {
      // Six boards across the tile, staggered end joints, a little grain and tone variation.
      const n = 6
      const bw = S / n
      for (let i = 0; i < n; i++) {
        g.globalAlpha = 0.06 + rand() * 0.14
        g.fillRect(i * bw, 0, bw, S)
        g.globalAlpha = 0.18
        g.lineWidth = 0.6
        for (let k = 0; k < 4; k++) {
          const x = i * bw + rand() * bw
          g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (rand() - 0.5) * 4, S); g.stroke()
        }
        g.globalAlpha = 0.7
        g.lineWidth = Math.max(1, S / 256)
        g.beginPath(); g.moveTo(i * bw, 0); g.lineTo(i * bw, S); g.stroke()
        const joint = ((i * 0.37) % 1) * S
        g.beginPath(); g.moveTo(i * bw, joint); g.lineTo(i * bw + bw, joint); g.stroke()
      }
      break
    }
    case 'rattan': {
      g.lineWidth = S / 40
      g.globalAlpha = 0.6
      const n = 8
      for (let i = -n; i <= n * 2; i++) {
        g.beginPath(); g.moveTo((i * S) / n, 0); g.lineTo((i * S) / n + S, S); g.stroke()
        g.beginPath(); g.moveTo((i * S) / n, S); g.lineTo((i * S) / n + S, 0); g.stroke()
      }
      break
    }
  }
  g.restore()
}

// A data URL preview for the panel (small).
const previews = new Map<string, string>()
export function patternPreview(pattern: PatternKind, c1: string, c2: string, size = 48): string {
  const key = `${pattern}|${c1}|${c2}|${size}`
  const cached = previews.get(key)
  if (cached) return cached
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  drawPattern(canvas.getContext('2d') as CanvasRenderingContext2D, size, pattern, c1, c2)
  const url = canvas.toDataURL()
  previews.set(key, url)
  return url
}
