import { nextTick } from 'vue'
import { getLens } from '../library/lenses'
import { getBody } from '../library/cameras'
import { lightColour, toHex } from '../library/colour'
import { getFixture } from '../library/fixtures'
import { getModifier } from '../library/modifiers'
import { formatShutter } from '../library/optics'
import { clearSelection, editor, setSelection } from '../plan/editor'
import { boundsOf } from '../plan/geometry'
import { snapshotScene } from '../plan/history'
import { scene } from '../scene/store'
import { CameraItem, LightItem, Pt, SceneDoc } from '../scene/types'
import { CaptureMeta, CaptureRequest, containIn, toBlob, wrapText } from './capture'

// Captures the Floor Plan as a lighting diagram: the plan framed to fit, without selection or
// editing overlays, plus a legend of every light, camera and subject.

// Output layout in logical px (drawn at RES× for detail): plan on the left, legend on the right.
const OUT_W = 1920
const OUT_H = 1080
const LEGEND_W = 520
const PLAN_W = OUT_W - LEGEND_W
const PLAN_H = OUT_H
const RES = 1.5
const BG = '#15161a'
// Plan labels are sized for the screen; render at a smaller logical size and scale up so they
// stay readable in the saved image.
const LABEL_BOOST = 1.35

const STYLE_PROPS = [
  'fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-opacity', 'stroke-dasharray', 'stroke-linecap', 'stroke-linejoin',
  'opacity', 'display', 'visibility', 'font-family', 'font-size', 'font-weight', 'text-anchor', 'dominant-baseline',
  'paint-order', 'vector-effect'
]

// Scoped CSS doesn't travel with a serialized SVG, so copy the computed styles inline.
function inlineStyles(live: Element, copy: Element): void {
  const computed = getComputedStyle(live)
  let style = ''
  STYLE_PROPS.forEach(p => {
    const v = computed.getPropertyValue(p)
    if (v) style += `${p}:${v};`
  })
  copy.setAttribute('style', style)
  for (let i = 0; i < live.children.length; i++) inlineStyles(live.children[i], copy.children[i])
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not render the plan'))
    img.src = url
  })
}

// A standalone SVG of the plan, framed on the whole scene. Cheap: it doubles as the dialog preview,
// and is only rasterised (the slow part, with JPEG encoding) when the capture is saved.
async function planSvg(svg: SVGSVGElement): Promise<{ url: string; scale: number }> {
  const pts: Pt[] = [...scene.walls.flatMap(w => [w.a, w.b]), ...scene.rooms.flatMap(r => r.points), ...scene.items.map(i => ({ x: i.x, z: i.z }))]
  const b = boundsOf(pts) ?? { minX: -3, maxX: 3, minZ: -3, maxZ: 3 }
  const margin = 0.9
  const scale = Math.min(PLAN_W / (b.maxX - b.minX + 2 * margin), PLAN_H / (b.maxZ - b.minZ + 2 * margin), 400)

  // Re-render the live plan at capture framing with nothing selected, copy it, then put
  // everything back before the browser paints (no visible flicker).
  const saved = { view: { ...editor.view }, size: { ...editor.size }, selection: [...editor.selection], snapPoint: editor.snapPoint }
  clearSelection()
  editor.snapPoint = null
  editor.size.w = PLAN_W / LABEL_BOOST
  editor.size.h = PLAN_H / LABEL_BOOST
  editor.view.scale = scale / LABEL_BOOST
  editor.view.cx = (b.minX + b.maxX) / 2
  editor.view.cz = (b.minZ + b.maxZ) / 2
  await nextTick()
  const copy = svg.cloneNode(true) as SVGSVGElement
  try {
    inlineStyles(svg, copy)
  } finally {
    Object.assign(editor.view, saved.view)
    Object.assign(editor.size, saved.size)
    setSelection(saved.selection)
    editor.snapPoint = saved.snapPoint
  }
  copy.querySelectorAll('.overlay, [data-handle]').forEach(el => el.remove())
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  copy.setAttribute('width', String(PLAN_W * RES))
  copy.setAttribute('height', String(PLAN_H * RES))
  copy.setAttribute('style', `background:${BG}`)
  return { url: URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml' })), scale }
}

async function rasterise(url: string, scale: number): Promise<HTMLCanvasElement> {
  const img = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = PLAN_W * RES
  canvas.height = PLAN_H * RES
  const g = canvas.getContext('2d') as CanvasRenderingContext2D
  g.fillStyle = BG
  g.fillRect(0, 0, canvas.width, canvas.height)
  g.drawImage(img, 0, 0, canvas.width, canvas.height)
  drawScaleBar(g, scale * RES)
  return canvas
}

function drawScaleBar(g: CanvasRenderingContext2D, pxPerMetre: number): void {
  const L = [0.5, 1, 2, 5, 10, 20].find(v => v * pxPerMetre >= 90 * RES) ?? 20
  const x = 24 * RES
  const y = g.canvas.height - 28 * RES
  g.strokeStyle = '#8b8f99'
  g.lineWidth = 2 * RES
  g.beginPath()
  g.moveTo(x, y - 6 * RES); g.lineTo(x, y); g.lineTo(x + L * pxPerMetre, y); g.lineTo(x + L * pxPerMetre, y - 6 * RES)
  g.stroke()
  g.fillStyle = '#8b8f99'
  g.font = `${12 * RES}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
  g.fillText(L < 1 ? `${L * 100} cm` : `${L} m`, x + 6 * RES, y - 10 * RES)
}

// ── Legend ───────────────────────────────────────────────────────────────
export function lightLine(light: LightItem): string {
  const p = light.props
  const fixture = getFixture(p.fixtureId)
  const modifier = getModifier(p.modifierId)
  const colour = p.mode === 'hsi' ? `HSI ${Math.round(p.hue)}° ${Math.round(p.sat)}%` : `${p.cct}K`
  return [`${fixture.brand} ${fixture.model}`, modifier.id !== 'bare' ? modifier.name : '', `${Math.round(p.dimmer)}%`, colour, `${light.height.toFixed(2)} m`]
    .filter(Boolean).join(' · ')
}

export function cameraLine(cam: CameraItem): string {
  const p = cam.props
  const body = getBody(p.bodyId)
  return [`${body.model}`, `${getLens(p.lensId).focalLength}mm`, `T${p.tStop}`, `ISO ${p.iso}`, formatShutter(p), `${p.wb}K`,
    p.nd.fitted ? `ND ${p.nd.stops}` : '', `${cam.height.toFixed(2)} m`].filter(Boolean).join(' · ')
}

function drawLegend(g: CanvasRenderingContext2D, doc: SceneDoc, meta: CaptureMeta): void {
  const font = (size: number, weight = 400) => `${weight} ${size}px -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`
  const x = PLAN_W + 32
  const w = LEGEND_W - 64
  g.fillStyle = '#17181c'
  g.fillRect(PLAN_W, 0, LEGEND_W, OUT_H)
  g.fillStyle = '#2a2c33'
  g.fillRect(PLAN_W, 0, 1, OUT_H)
  let y = 52
  g.textBaseline = 'alphabetic'
  g.fillStyle = '#8b8f99'
  g.font = font(15)
  y = wrapText(g, meta.productionTitle, x, y, w, 20, 1) + 6
  g.fillStyle = '#e6e7ea'
  g.font = font(20, 600)
  y = wrapText(g, meta.sceneSlug, x, y, w, 26, 2) + 10
  g.fillStyle = '#ffb547'
  g.font = font(17, 600)
  y = wrapText(g, `${meta.label}${meta.name ? ` — ${meta.name}` : ''}`, x, y, w, 23, 2)
  if (meta.description) {
    g.fillStyle = '#c3c6cd'
    g.font = font(15)
    y = wrapText(g, meta.description, x, y + 4, w, 21, 4)
  }

  const section = (title: string) => {
    y += 22
    g.fillStyle = '#8b8f99'
    g.font = font(12, 600)
    g.fillText(title.toUpperCase(), x, y)
    y += 24
  }
  const entry = (name: string, detail: string, swatch?: string) => {
    if (y > OUT_H - 60) return
    if (swatch) {
      g.fillStyle = swatch
      g.beginPath()
      g.arc(x + 6, y - 5, 6, 0, Math.PI * 2)
      g.fill()
    }
    const tx = swatch ? x + 20 : x
    g.fillStyle = '#e6e7ea'
    g.font = font(15, 600)
    g.fillText(name, tx, y)
    g.fillStyle = '#a4a8b1'
    g.font = font(13.5)
    y = wrapText(g, detail, tx, y + 19, w - (tx - x), 18, 2) + 8
  }

  const lights = doc.items.filter((i): i is LightItem => i.kind === 'light')
  const cameras = doc.items.filter((i): i is CameraItem => i.kind === 'camera')
  const subjects = doc.items.filter(i => i.kind === 'subject')
  if (lights.length) {
    section(`Lights (${lights.length})`)
    lights.forEach(l => entry(l.name, lightLine(l), toHex(lightColour(l.props.mode, l.props.cct, l.props.gm, l.props.hue, l.props.sat))))
  }
  if (cameras.length) {
    section(`Camera${cameras.length > 1 ? 's' : ''}`)
    cameras.forEach(c => entry(c.name, cameraLine(c)))
  }
  if (subjects.length) {
    section('Subjects')
    g.fillStyle = '#e6e7ea'
    g.font = font(15)
    y = wrapText(g, subjects.map(s => s.name).join(', '), x, y, w, 20, 2)
  }
  g.fillStyle = '#5d616b'
  g.font = font(12)
  g.fillText(`Previs · ${new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}`, x, OUT_H - 28)
}

// Capture the current Floor Plan; the legend is drawn once the dialog knows where it's going.
export async function capturePlan(svg: SVGSVGElement): Promise<CaptureRequest> {
  const sceneJson = snapshotScene()
  const doc = JSON.parse(sceneJson) as SceneDoc
  const { url, scale } = await planSvg(svg)
  return {
    kind: 'setup',
    previewUrl: url, // revoked when the dialog closes, after render()
    sceneJson,
    async render(meta) {
      const plan = await rasterise(url, scale)
      const out = document.createElement('canvas')
      out.width = OUT_W * RES
      out.height = OUT_H * RES
      const g = out.getContext('2d') as CanvasRenderingContext2D
      g.drawImage(plan, 0, 0)
      g.save()
      g.scale(RES, RES)
      drawLegend(g, doc, meta)
      g.restore()
      // Cards show the plan itself; the legend is unreadable at thumbnail size.
      const [image, thumb] = await Promise.all([toBlob(out, 'image/jpeg', 0.9), toBlob(containIn(plan, 480, 270, BG), 'image/jpeg', 0.85)])
      return { image, thumb }
    }
  }
}
