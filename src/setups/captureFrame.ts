import { getBody } from '../library/cameras'
import { getLens } from '../library/lenses'
import { formatShutter } from '../library/optics'
import { FrameCapture, LiveScene } from '../live/LiveScene'
import { snapshotScene } from '../plan/history'
import { CameraItem } from '../scene/types'
import { CaptureRequest, containIn, toBlob } from './capture'
import { ShotCamera } from './types'

// Captures the camera being looked through as a storyboard frame: the clean graded image (no
// zebras, false colour or viewfinder display) plus the camera settings that made it.

const MAX_WIDTH = 1920

function toCanvas(frame: FrameCapture): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = frame.width
  canvas.height = frame.height
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  const image = g.createImageData(frame.width, frame.height)
  const row = frame.width * 4
  // GPU rows are bottom-up.
  for (let y = 0; y < frame.height; y++) image.data.set(frame.data.subarray((frame.height - 1 - y) * row, (frame.height - y) * row), y * row)
  g.putImageData(image, 0, 0)
  return canvas
}

export function shotCamera(cam: CameraItem): ShotCamera {
  const p = cam.props
  return {
    name: `${cam.name} (${getBody(p.bodyId).model})`,
    lensMm: getLens(p.lensId).focalLength,
    tStop: p.tStop,
    iso: p.iso,
    shutter: formatShutter(p),
    nd: p.nd.fitted ? p.nd.stops : 0,
    wbK: p.wb,
    heightM: cam.height,
    tiltDeg: p.tilt
  }
}

export async function captureFrame(live: LiveScene, cam: CameraItem): Promise<CaptureRequest> {
  const sceneJson = snapshotScene()
  const camera = shotCamera(cam)
  const full = toCanvas(await live.captureStill())
  const image = full.width > MAX_WIDTH ? containIn(full, MAX_WIDTH, Math.round(MAX_WIDTH * full.height / full.width)) : full
  // A small preview encodes quickly; the full JPEG is made when the frame is saved.
  const preview = await toBlob(containIn(image, 960, Math.round(960 * image.height / image.width)), 'image/jpeg', 0.85)
  return {
    kind: 'frame',
    previewUrl: URL.createObjectURL(preview),
    sceneJson,
    shot: { camera },
    async render() {
      const [jpeg, thumb] = await Promise.all([
        toBlob(image, 'image/jpeg', 0.92),
        toBlob(containIn(image, 480, 270), 'image/jpeg', 0.85)
      ])
      return { image: jpeg, thumb }
    }
  }
}
