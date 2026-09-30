// Camera bodies. Only the Sony FX3 for now.

export interface FrameRate {
  label: string
  fps: number
  // Sensor crop factor at this frame rate (FX3 4K 100/120p reads a ~1.1× window).
  crop: number
}

export interface PictureProfile {
  id: 'cinetone' | 'slog3'
  label: string
  minIso: number
  baseIsos: number[]
}

export interface CameraBody {
  id: string
  brand: string
  model: string
  sensorWidth: number // mm
  sensorHeight: number // mm
  format: { label: string; width: number; height: number; codec: string }
  frameRates: FrameRate[]
  isos: number[]
  profiles: PictureProfile[]
  shutterSpeeds: number[] // denominators: 50 = 1/50
  shutterAngles: number[] // standard detents; any 1–360° is allowed
  wbRange: [number, number]
}

// ISO 80–102400 in 1/3 stops, as the camera steps them.
const THIRD_STOP_ISOS = [
  80, 100, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000,
  6400, 8000, 10000, 12800, 16000, 20000, 25600, 32000, 40000, 51200, 64000, 80000, 102400
]

export const FX3: CameraBody = {
  id: 'fx3',
  brand: 'Sony',
  model: 'FX3',
  sensorWidth: 35.6,
  sensorHeight: 23.8,
  format: { label: '4K', width: 3840, height: 2160, codec: 'XAVC S-I 4K 4:2:2 10bit' },
  frameRates: [
    { label: '23.98p', fps: 23.976, crop: 1 },
    { label: '24p', fps: 24, crop: 1 },
    { label: '25p', fps: 25, crop: 1 },
    { label: '29.97p', fps: 29.97, crop: 1 },
    { label: '50p', fps: 50, crop: 1 },
    { label: '59.94p', fps: 59.94, crop: 1 },
    { label: '100p', fps: 100, crop: 1.1 },
    { label: '119.88p', fps: 119.88, crop: 1.1 }
  ],
  isos: THIRD_STOP_ISOS,
  profiles: [
    { id: 'cinetone', label: 'S-Cinetone', minIso: 80, baseIsos: [] },
    { id: 'slog3', label: 'S-Log3', minIso: 800, baseIsos: [800, 12800] }
  ],
  shutterSpeeds: [24, 25, 30, 40, 48, 50, 60, 80, 100, 120, 125, 160, 200, 250, 320, 400, 500, 640, 800, 1000, 1250, 1600, 2000, 2500, 3200, 4000, 5000, 6400, 8000],
  shutterAngles: [11.25, 22.5, 45, 90, 144, 172.8, 180, 216, 270, 360],
  wbRange: [2500, 9900]
}

export const CAMERA_BODIES = [FX3]

export function getBody(id: string): CameraBody {
  return CAMERA_BODIES.find(body => body.id === id) ?? FX3
}
