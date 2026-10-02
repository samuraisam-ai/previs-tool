import { getDef } from '../props/catalog'
import { paramsOf } from '../props/create'
import { shade } from '../props/finish'
import { PlanShape } from '../props/types'
import { SceneDoc } from '../scene/types'
import { toBlob } from './capture'
import { addCapture, createProduction, createScene, markSample, SceneFields, setups } from './store'

// Built-in sample productions: furnished houses anyone can open from Setups and play with. They
// are ordinary productions once seeded (edit or delete freely); "Restore samples" brings back any
// that are missing. The houses themselves live in public/samples (npm run make:samples).

interface SampleSetup { name: string; description: string; camera: string }
interface Sample { id: string; title: string; file: string; scene: SceneFields; setups: SampleSetup[] }

export const SAMPLES: Sample[] = [
  {
    id: 'house-1bed',
    title: 'Sample – 1-bedroom apartment',
    file: 'house-1bed.json',
    scene: { number: '1', setting: 'INT', location: 'Apartment', timeOfDay: 'EVENING', synopsis: 'A small, dressed 1-bedroom apartment: open-plan lounge and kitchen, bedroom and bathroom. A good place to start.' },
    setups: [
      { name: 'Lounge — wide', description: 'Camera A from the kitchen across the lounge. Table lamp and pendant are lit practicals.', camera: 'Camera A' },
      { name: 'Bedroom — doorway', description: 'Camera B from the bedroom door towards the bed.', camera: 'Camera B' }
    ]
  },
  {
    id: 'house-3bed',
    title: 'Sample – 3-bedroom house',
    file: 'house-3bed.json',
    scene: { number: '1', setting: 'INT', location: 'Family house', timeOfDay: 'EVENING', synopsis: 'A fully dressed 3-bedroom house (~150 props): living room, kitchen-dining, hallway, master bedroom, bathroom and two bedrooms.' },
    setups: [
      { name: 'Living room — wide', description: 'Camera A across the living room on Maya.', camera: 'Camera A' },
      { name: 'Kitchen — Sam', description: 'Camera B from the kitchen on Sam.', camera: 'Camera B' }
    ]
  }
]

const SEEDED_KEY = 'previs.samplesSeeded'

export const missingSamples = (): Sample[] => SAMPLES.filter(s => !setups.productions.some(p => p.sampleId === s.id))

// First visit in this browser: add the samples. Afterwards, deleting one is respected.
export async function ensureSamples(): Promise<void> {
  if (!setups.available) return
  let seeded = false
  try { seeded = localStorage.getItem(SEEDED_KEY) === '1' } catch { /* storage blocked */ }
  if (seeded) return
  await restoreSamples()
  try { localStorage.setItem(SEEDED_KEY, '1') } catch { /* storage blocked */ }
}

let restoring: Promise<void> | null = null
export function restoreSamples(): Promise<void> {
  if (!restoring) {
    restoring = (async () => {
      // Oldest first, so the 1-bedroom (the easier start) ends up at the top of the list.
      for (const sample of missingSamples().reverse()) {
        try { await addSample(sample) } catch (e) { console.warn('Samples: could not add', sample.id, e) }
      }
    })().finally(() => { restoring = null })
  }
  return restoring
}

async function addSample(sample: Sample): Promise<void> {
  const res = await fetch(`${process.env.BASE_URL ?? '/'}samples/${sample.file}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.text()
  const doc = JSON.parse(json) as SceneDoc
  const production = createProduction(sample.title)
  markSample(production, sample.id)
  const scene = createScene(production, sample.scene)
  for (const s of sample.setups) {
    // Each setup reopens the house with its own camera active.
    const cam = doc.items.find(i => i.kind === 'camera' && i.name === s.camera)
    const setupDoc: SceneDoc = { ...doc, activeCameraId: cam?.id ?? doc.activeCameraId }
    const image = await drawPlan(setupDoc, 1920, 1080, `${sample.title.replace('Sample – ', '')} · ${s.name}`)
    const thumb = await drawPlan(setupDoc, 480, 270)
    await addCapture(scene, { kind: 'setup', name: s.name, description: s.description, image, thumb, sceneJson: JSON.stringify(setupDoc) })
  }
}

// ── A plan picture straight from the scene data (no editor needed) ─────────────────────────────
const BG = '#14151a'

function drawShape(g: CanvasRenderingContext2D, s: PlanShape, colour: string, px: number): void {
  const cls = s.cls ?? (s.t === 'path' && !s.closed ? 'line' : 'body')
  g.beginPath()
  if (s.t === 'rect') {
    g.save()
    g.translate(s.x, -s.z)
    if (s.rot) g.rotate((s.rot * Math.PI) / 180)
    g.rect(-s.w / 2, -s.d / 2, s.w, s.d)
    g.restore()
  } else if (s.t === 'circle') g.arc(s.x, -s.z, s.r, 0, Math.PI * 2)
  else if (s.t === 'ellipse') g.ellipse(s.x, -s.z, s.rx, s.rz, 0, 0, Math.PI * 2)
  else {
    s.pts.forEach(([x, z], i) => (i ? g.lineTo(x, -z) : g.moveTo(x, -z)))
    if (s.closed) g.closePath()
  }
  if (cls === 'body' || cls === 'soft') {
    g.globalAlpha = cls === 'soft' ? 0.8 : 0.55
    g.fillStyle = cls === 'soft' ? shade(colour, 0.15) : colour
    g.fill()
    g.globalAlpha = 1
  }
  if (cls !== 'hidden') {
    g.strokeStyle = cls === 'glass' ? '#7fb2ff' : cls === 'body' ? '#c9ccd4' : 'rgba(230,231,234,0.55)'
    g.lineWidth = (cls === 'body' ? 1 : 0.75) * px
    g.stroke()
  }
}

async function drawPlan(doc: SceneDoc, w: number, h: number, caption?: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = BG
  g.fillRect(0, 0, w, h)
  const pts = [...doc.walls.flatMap(wl => [wl.a, wl.b]), ...doc.rooms.flatMap(r => r.points)]
  if (!pts.length) return toBlob(canvas, 'image/jpeg', 0.88)
  const minX = Math.min(...pts.map(p => p.x))
  const maxX = Math.max(...pts.map(p => p.x))
  const minZ = Math.min(...pts.map(p => p.z))
  const maxZ = Math.max(...pts.map(p => p.z))
  const top = caption ? h * 0.08 : 0
  const scale = Math.min((w * 0.9) / (maxX - minX), ((h - top) * 0.88) / (maxZ - minZ))
  const px = 1 / scale * (w / 1280) * 1.4 // a "screen pixel" in metres, a little bolder on big images
  g.save()
  g.translate(w / 2, top + (h - top) / 2)
  g.scale(scale, scale)
  g.translate(-(minX + maxX) / 2, (minZ + maxZ) / 2)
  // Floors, tinted with their finish.
  doc.rooms.forEach(r => {
    g.beginPath()
    r.points.forEach((p, i) => (i ? g.lineTo(p.x, -p.z) : g.moveTo(p.x, -p.z)))
    g.closePath()
    g.globalAlpha = 0.22
    g.fillStyle = r.floorFinish?.colour ?? '#6b6a67'
    g.fill()
    g.globalAlpha = 1
  })
  // Props, with their own plan symbols and colours.
  doc.items.forEach(item => {
    if (item.kind !== 'prop') return
    const def = getDef(item.props.catalogId)
    let shapes: PlanShape[] = []
    try { shapes = def ? def.plan(paramsOf(item.props)) : [] } catch { shapes = [] }
    if (!shapes.length) shapes = [{ t: 'rect', x: 0, z: 0, w: item.props.w, d: item.props.d }]
    const first = def?.slots[0]?.id
    const main = (first && item.props.finishes[first]?.colour) || '#8b8f99'
    g.save()
    g.translate(item.x, -item.z)
    g.rotate((item.rotationY * Math.PI) / 180)
    shapes.forEach(s => drawShape(g, s, (s.tint && item.props.finishes[s.tint]?.colour) || main, px))
    g.restore()
  })
  // Walls.
  g.lineCap = 'square'
  g.strokeStyle = '#d7d9de'
  doc.walls.forEach(wl => {
    g.lineWidth = wl.thickness
    g.beginPath()
    g.moveTo(wl.a.x, -wl.a.z)
    g.lineTo(wl.b.x, -wl.b.z)
    g.stroke()
  })
  // Openings: a gap in the wall; windows keep a thin glass line.
  doc.openings.forEach(o => {
    const wl = doc.walls.find(x => x.id === o.wallId)
    if (!wl) return
    const len = Math.hypot(wl.b.x - wl.a.x, wl.b.z - wl.a.z) || 1
    const ux = (wl.b.x - wl.a.x) / len
    const uz = (wl.b.z - wl.a.z) / len
    const p = (t: number) => [wl.a.x + ux * t, -(wl.a.z + uz * t)] as const
    const [x0, y0] = p(o.offset - o.width / 2)
    const [x1, y1] = p(o.offset + o.width / 2)
    g.lineCap = 'butt'
    g.strokeStyle = BG
    g.lineWidth = wl.thickness + 0.02
    g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
    if (o.kind === 'window') {
      g.strokeStyle = '#7fb2ff'
      g.lineWidth = 0.05
      g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke()
    }
  })
  // Subjects and cameras (the active camera in the accent colour).
  doc.items.forEach(item => {
    if (item.kind === 'subject') {
      g.beginPath()
      g.arc(item.x, -item.z, 0.22, 0, Math.PI * 2)
      g.fillStyle = '#e6e7ea'
      g.fill()
    } else if (item.kind === 'camera') {
      const active = item.id === doc.activeCameraId
      g.save()
      g.translate(item.x, -item.z)
      g.rotate((item.rotationY * Math.PI) / 180)
      g.beginPath()
      g.moveTo(0, 0); g.lineTo(-1.6, -3.2); g.lineTo(1.6, -3.2); g.closePath()
      g.fillStyle = active ? 'rgba(255,181,71,0.16)' : 'rgba(120,170,255,0.1)'
      g.fill()
      g.fillStyle = active ? '#ffb547' : '#78aaff'
      g.fillRect(-0.18, -0.12, 0.36, 0.3)
      g.restore()
    }
  })
  g.restore()
  if (caption) {
    g.fillStyle = '#e6e7ea'
    g.font = `600 ${Math.round(h * 0.03)}px -apple-system, "Segoe UI", sans-serif`
    g.fillText(caption, w * 0.04, h * 0.06)
  }
  return toBlob(canvas, 'image/jpeg', 0.88)
}
