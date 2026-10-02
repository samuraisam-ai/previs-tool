import { reactive } from 'vue'
import { storage } from '../setups/storage'
import { Finish } from '../scene/types'

// Finish clipboard (copy/paste between props), saved "My materials" presets, and image uploads.

export const finishTools = reactive({
  clipboard: null as Finish | null,
  presets: read()
})

function read(): Array<{ name: string; finish: Finish }> {
  try { return JSON.parse(localStorage.getItem('previs.props.materials') ?? '[]') } catch { return [] }
}
function save(): void {
  try { localStorage.setItem('previs.props.materials', JSON.stringify(finishTools.presets)) } catch { /* private mode */ }
}

export function savePreset(name: string, finish: Finish): void {
  finishTools.presets = [{ name, finish: { ...finish } }, ...finishTools.presets.filter(p => p.name !== name)].slice(0, 60)
  save()
}

export function deletePreset(name: string): void {
  finishTools.presets = finishTools.presets.filter(p => p.name !== name)
  save()
}

// Pick an image, shrink it (≤ maxSize px on the long side) and store it; returns its id and size.
export function uploadImage(maxSize = 1024): Promise<{ id: string; w: number; h: number } | null> {
  return new Promise(resolve => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) { resolve(null); return }
      try {
        const bitmap = await createImageBitmap(file)
        const s = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.round(bitmap.width * s))
        canvas.height = Math.max(1, Math.round(bitmap.height * s))
        ;(canvas.getContext('2d') as CanvasRenderingContext2D).drawImage(bitmap, 0, 0, canvas.width, canvas.height)
        const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
        resolve(blob ? { id: await storage.putImage(blob), w: bitmap.width, h: bitmap.height } : null)
      } catch {
        resolve(null)
      }
    }
    input.click()
  })
}

const urls = reactive<{ [id: string]: string }>({})
export function imagePreview(id: string | null): string | undefined {
  if (!id) return undefined
  if (!(id in urls)) {
    urls[id] = ''
    storage.getImageUrl(id).then(u => { if (u) urls[id] = u })
  }
  return urls[id] || undefined
}
