import { Kit, PlanShape, PropDef } from '../types'
import { circle, legs, rect } from './parts'
import { tableTop } from './living'

// Dining. Tables can bring their own chairs (handy for blocking); chairs are also a prop of their own.

function chair(kit: Kit, style: string, x: number, z: number, turn: number, seatSlot: string, frameSlot: string): void {
  // Build a chair at (x, z), facing `turn` degrees (0 = facing +z). Rotation is applied per part.
  const rot = (px: number, pz: number): [number, number] => {
    const r = (turn * Math.PI) / 180
    return [x + px * Math.cos(r) + pz * Math.sin(r), z - px * Math.sin(r) + pz * Math.cos(r)]
  }
  const seatH = 0.46
  const w = 0.44
  const d = 0.46
  const at = (px: number, py: number, pz: number): [number, number, number] => { const [a, b] = rot(px, pz); return [a, py, b] }
  ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
    const [lx, lz] = rot(sx * (w / 2 - 0.03), sz * (d / 2 - 0.03))
    kit.cylinder(frameSlot, { dTop: 0.032, dBottom: 0.024, h: seatH - 0.03, sides: 8 }, [lx, (seatH - 0.03) / 2, lz])
  })
  if (style === 'upholstered') {
    kit.soft(seatSlot, [w, 0.08, d], at(0, seatH - 0.02, 0), 0.025, { rot: [0, turn, 0] })
    kit.soft(seatSlot, [w, 0.46, 0.07], at(0, seatH + 0.25, -d / 2 + 0.04), 0.03, { rot: [-6, turn, 0] })
  } else {
    kit.box(frameSlot, [w, 0.03, d], at(0, seatH - 0.015, 0), { rot: [0, turn, 0] })
    kit.box(seatSlot, [w - 0.04, 0.025, d - 0.06], at(0, seatH + 0.012, 0.01), { rot: [0, turn, 0] })
    if (style === 'spindle') {
      for (let i = 0; i < 5; i++) kit.cylinder(frameSlot, { d: 0.016, h: 0.38, sides: 6 }, at(-w / 2 + 0.06 + i * ((w - 0.12) / 4), seatH + 0.2, -d / 2 + 0.03), { small: true })
      kit.box(frameSlot, [w, 0.06, 0.03], at(0, seatH + 0.4, -d / 2 + 0.03), { rot: [0, turn, 0] })
    } else kit.box(frameSlot, [w, 0.16, 0.025], at(0, seatH + 0.3, -d / 2 + 0.03), { rot: [-5, turn, 0] })
    ;[-1, 1].forEach(s => kit.box(frameSlot, [0.03, 0.42, 0.03], at(s * (w / 2 - 0.03), seatH + 0.2, -d / 2 + 0.03), { rot: [0, turn, 0] }))
  }
}

const CHAIR_STYLE = { id: 'chairStyle', label: 'Chair style', type: 'select' as const, default: 'upholstered', choices: [
  { value: 'upholstered', label: 'Upholstered' }, { value: 'spindle', label: 'Spindle back' }, { value: 'slat', label: 'Slat back' }] }

// Chair positions around a table (x, z, facing).
function seating(shape: string, w: number, d: number, seats: number): Array<[number, number, number]> {
  const out: Array<[number, number, number]> = []
  if (shape !== 'rect') {
    for (let i = 0; i < seats; i++) {
      const a = (i / seats) * Math.PI * 2
      out.push([Math.sin(a) * (w / 2 + 0.22), Math.cos(a) * (d / 2 + 0.22), (a * 180) / Math.PI + 180])
    }
    return out
  }
  const ends = seats >= 6 ? 2 : seats % 2
  const perSide = Math.ceil((seats - ends) / 2)
  for (let i = 0; i < perSide; i++) {
    const x = -w / 2 + (w / perSide) * (i + 0.5)
    out.push([x, d / 2 + 0.22, 180])
    if (out.length < seats - ends) out.push([x, -d / 2 - 0.22, 0])
  }
  if (ends >= 1) out.push([-w / 2 - 0.22, 0, 90])
  if (ends >= 2) out.push([w / 2 + 0.22, 0, -90])
  return out.slice(0, seats)
}

export const diningTable: PropDef = {
  id: 'dining-table', name: 'Dining table', category: 'dining', rooms: ['dining', 'kitchen'], keywords: ['table', 'kitchen table'],
  size: { w: 1.8, d: 0.9, h: 0.75 }, mount: 'floor',
  options: [
    { id: 'shape', label: 'Top', type: 'select', default: 'rect', choices: [{ value: 'rect', label: 'Rectangle' }, { value: 'round', label: 'Round' }, { value: 'oval', label: 'Oval' }] },
    { id: 'seats', label: 'Seats', type: 'number', min: 2, max: 12, step: 1, default: 6 },
    { id: 'base', label: 'Base', type: 'select', default: 'legs', choices: [{ value: 'legs', label: 'Four legs' }, { value: 'pedestal', label: 'Pedestal' }, { value: 'trestle', label: 'Trestle' }] },
    { id: 'chairs', label: 'With chairs', type: 'toggle', default: true },
    { ...CHAIR_STYLE }
  ],
  slots: [
    { id: 'top', label: 'Top', default: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43' } },
    { id: 'base', label: 'Legs / base', default: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43' } },
    { id: 'chairSeat', label: 'Chair seats', default: { material: 'fabric', colour: '#d8cdb8' } },
    { id: 'chairFrame', label: 'Chair frames', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } }
  ],
  sizeFor: (o, cur, changed) => {
    if (changed !== 'seats' && changed !== 'shape') return null
    const n = Number(o.seats)
    if (o.shape === 'round') { const r = Math.max(0.9, (n * 0.6) / Math.PI); return { w: r, d: r, h: cur.h } }
    const len = Math.max(0.8, Math.ceil(Math.max(2, n - (n >= 6 ? 2 : 0)) / 2) * 0.7 + 0.2)
    return { w: Math.round(len * 100) / 100, d: o.shape === 'oval' ? 1.0 : 0.9, h: cur.h }
  },
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    tableTop(kit, 'top', String(o.shape), w, d, h, 0.035)
    if (o.base === 'pedestal') {
      kit.cylinder('base', { d: 0.14, h: h - 0.04, sides: 20 }, [0, (h - 0.04) / 2, 0])
      kit.cylinder('base', { d: Math.min(w, d) * 0.55, h: 0.04, sides: 28 }, [0, 0.02, 0])
    } else if (o.base === 'trestle') {
      [-1, 1].forEach(s => {
        kit.box('base', [0.08, h - 0.035, 0.08], [s * w * 0.35, (h - 0.035) / 2, 0])
        kit.box('base', [0.08, 0.06, d * 0.8], [s * w * 0.35, 0.03, 0])
      })
      kit.box('base', [w * 0.7, 0.06, 0.04], [0, 0.3, 0])
    } else legs(kit, 'base', o.shape === 'rect' ? w : w * 0.72, o.shape === 'rect' ? d : d * 0.72, h - 0.035, 'block', 0.05)
    if (o.chairs) seating(String(o.shape), w, d, Number(o.seats)).forEach(([x, z, t]) => chair(kit, String(o.chairStyle), x, z, t, 'chairSeat', 'chairFrame'))
  },
  plan: ({ w, d, o }) => {
    const out: PlanShape[] = []
    if (o.chairs) seating(String(o.shape), w, d, Number(o.seats)).forEach(([x, z, t]) => out.push({ t: 'rect', x, z, w: 0.44, d: 0.46, r: 0.04, rot: t, cls: 'soft', tint: 'chairSeat' }))
    out.push(o.shape === 'rect' ? rect(0, 0, w, d, 'body', 0.01, 'top') : { t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'top' })
    return out
  }
}

export const diningChair: PropDef = {
  id: 'dining-chair', name: 'Dining chair', category: 'dining', rooms: ['dining', 'kitchen', 'office', 'bedroom'], keywords: ['chair', 'side chair'],
  size: { w: 0.46, d: 0.5, h: 0.86 }, mount: 'floor',
  options: [{ ...CHAIR_STYLE }],
  slots: [
    { id: 'seat', label: 'Seat', default: { material: 'fabric', colour: '#d8cdb8' } },
    { id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } }
  ],
  build(kit, { o }) { chair(kit, String(o.chairStyle), 0, 0, 0, 'seat', 'frame') },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.04, 'seat'), rect(0, -d / 2 + 0.03, w, 0.04, 'line')]
}

export const placeSetting: PropDef = {
  id: 'place-setting', name: 'Place setting', category: 'dining', rooms: ['dining', 'kitchen'], keywords: ['plate', 'cutlery', 'glass', 'tableware', 'dinner'],
  size: { w: 0.5, d: 0.36, h: 0.16 }, mount: 'surface',
  options: [{ id: 'wine', label: 'Wine glass', type: 'toggle', default: true }],
  slots: [
    { id: 'plate', label: 'Plate', default: { material: 'ceramic', colour: '#f2f1ec' } },
    { id: 'cutlery', label: 'Cutlery', default: { material: 'metal', colour: '#d6d8db' } },
    { id: 'glass', label: 'Glass', default: { material: 'glass', colour: '#e8f0f2' } },
    { id: 'napkin', label: 'Napkin', default: { material: 'fabric', colour: '#9aa88f' } }
  ],
  build(kit, { o }) {
    kit.lathe('plate', [[0, 0], [0.09, 0], [0.13, 0.012], [0.135, 0.018], [0.13, 0.016], [0.09, 0.006], [0, 0.006]], [0, 0, 0.02], { sides: 32 })
    kit.box('cutlery', [0.015, 0.004, 0.2], [-0.17, 0.003, 0.02], { small: true })
    kit.box('cutlery', [0.015, 0.004, 0.2], [0.17, 0.003, 0.02], { small: true })
    kit.box('napkin', [0.08, 0.012, 0.18], [-0.22, 0.006, 0.02], { small: true })
    kit.lathe('glass', [[0, 0], [0.035, 0], [0.04, 0.1], [0.038, 0.1]], [0.16, 0, -0.12], { sides: 18, small: true })
    if (o.wine) kit.lathe('glass', [[0, 0], [0.035, 0.002], [0.005, 0.01], [0.005, 0.09], [0.04, 0.12], [0.042, 0.16], [0.04, 0.16]], [0.06, 0, -0.14], { sides: 18, small: true })
  },
  plan: () => [circle(0, 0.02, 0.135, 'body', 'plate'), circle(0.16, -0.12, 0.04, 'glass')]
}

export const DINING: PropDef[] = [diningTable, diningChair, placeSetting]
