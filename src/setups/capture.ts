import { markRaw, reactive } from 'vue'
import { CaptureKind, Shot } from './types'

// One capture waiting for the save dialog, and the confirmation toast afterwards.

// What the final image needs to know once the user has chosen where it goes.
export interface CaptureMeta {
  productionTitle: string
  sceneSlug: string
  label: string // "Sc 12 · Setup 3"
  name: string
  description: string
}

export interface CaptureRequest {
  kind: CaptureKind
  previewUrl: string // shown in the dialog (revoked when it closes)
  sceneJson: string
  shot?: Omit<Shot, 'size' | 'movement' | 'action' | 'dialogue'> // auto-filled camera data for frames
  render(meta: CaptureMeta): Promise<{ image: Blob; thumb: Blob }>
}

export const captureState = reactive({
  request: null as CaptureRequest | null,
  toast: null as { text: string; state: 'saving' | 'saved' | 'error'; productionId: string; sceneId: string; tab: 'setups' | 'storyboard' } | null
})

// Where the last capture went, so repeated captures are one click (per session).
export const lastTarget = { productionId: null as string | null, sceneId: null as string | null }

export function requestCapture(request: CaptureRequest): void {
  if (captureState.request) closeCapture()
  captureState.request = markRaw(request)
}

// `keepPreview`: the image is still being rendered in the background; it revokes the URL itself.
export function closeCapture(keepPreview = false): void {
  if (captureState.request && !keepPreview) URL.revokeObjectURL(captureState.request.previewUrl)
  captureState.request = null
}

// Saves run one at a time, so quick repeated captures number correctly (1, 2, 3…).
let queue: Promise<unknown> = Promise.resolve()
export function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const next = queue.then(job)
  queue = next.catch(() => undefined)
  return next
}

let toastTimer: number | undefined
export function showToast(toast: NonNullable<typeof captureState.toast>): void {
  captureState.toast = toast
  window.clearTimeout(toastTimer)
  if (toast.state !== 'saving') toastTimer = window.setTimeout(() => { captureState.toast = null }, toast.state === 'error' ? 10000 : 6000)
}

// ── Canvas helpers shared by plan and frame captures ────────────────────
export const toBlob = (canvas: HTMLCanvasElement, type = 'image/jpeg', quality = 0.9) =>
  new Promise<Blob>((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not encode image'))), type, quality))

// Fit `source` inside a w × h canvas (letterboxed on `background`).
export function containIn(source: CanvasImageSource & { width: number; height: number }, w: number, h: number, background = '#0b0c0f'): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = background
  g.fillRect(0, 0, w, h)
  const s = Math.min(w / source.width, h / source.height)
  const dw = source.width * s
  const dh = source.height * s
  g.imageSmoothingQuality = 'high'
  g.drawImage(source, (w - dw) / 2, (h - dh) / 2, dw, dh)
  return canvas
}

// Word-wrap `text` into at most `maxLines` lines of `width` px; returns the y after the block.
export function wrapText(g: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, lineHeight: number, maxLines = 3): number {
  const words = text.split(/\s+/).filter(Boolean)
  let line = ''
  let lines = 0
  for (let i = 0; i < words.length; i++) {
    const test = line ? `${line} ${words[i]}` : words[i]
    if (g.measureText(test).width > width && line) {
      lines++
      if (lines === maxLines) {
        let cut = line
        while (cut && g.measureText(`${cut}…`).width > width) cut = cut.slice(0, -1)
        g.fillText(`${cut}…`, x, y)
        return y + lineHeight
      }
      g.fillText(line, x, y)
      y += lineHeight
      line = words[i]
    } else line = test
  }
  if (line) { g.fillText(line, x, y); y += lineHeight }
  return y
}
