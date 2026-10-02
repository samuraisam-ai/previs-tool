import { Kit, PlanShape, PropDef } from '../types'
import { circle, fronts, HANDLE_OPTION, LEG_OPTION, legs, line, rect } from './parts'

// Living room. Front (+z) is the seating / viewing side.

const ARM = 0.16

export const sofa: PropDef = {
  id: 'sofa', name: 'Sofa', category: 'living', rooms: ['living', 'office'], keywords: ['couch', 'settee', 'sectional', 'chaise', 'loveseat'],
  size: { w: 2.2, d: 0.95, h: 0.82 }, mount: 'floor',
  options: [
    { id: 'seats', label: 'Seats', type: 'number', min: 1, max: 5, step: 1, default: 3 },
    { id: 'arms', label: 'Arms', type: 'select', default: 'track', choices: [
      { value: 'track', label: 'Track (square)' }, { value: 'rolled', label: 'Rolled' }, { value: 'slope', label: 'Low slope' }, { value: 'none', label: 'Armless' }] },
    { id: 'chaise', label: 'Chaise / L-shape', type: 'select', default: 'none', choices: [
      { value: 'none', label: 'None' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] },
    { id: 'back', label: 'Back cushions', type: 'select', default: 'loose', choices: [
      { value: 'loose', label: 'Loose cushions' }, { value: 'tight', label: 'Tight back' }] },
    { id: 'pillows', label: 'Scatter cushions', type: 'number', min: 0, max: 6, step: 1, default: 2 },
    { ...LEG_OPTION, default: 'block' }
  ],
  slots: [
    { id: 'upholstery', label: 'Upholstery', default: { material: 'fabric', colour: '#a9a294' } },
    { id: 'cushions', label: 'Seat & back cushions', default: { material: 'fabric', colour: '#a9a294' } },
    { id: 'pillows', label: 'Scatter cushions', default: { material: 'velvet', colour: '#b0802c' } },
    { id: 'legs', label: 'Legs', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } }
  ],
  sizeFor: (o, cur, changed) => {
    if (changed && changed !== 'seats' && changed !== 'chaise' && changed !== 'arms') return null
    const arms = o.arms === 'none' ? 0 : ARM * 2
    return { w: Math.round((Number(o.seats) * 0.66 + arms) * 100) / 100, d: o.chaise === 'none' ? 0.95 : 1.6, h: cur.h }
  },
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.04 : 0.12
    const baseD = Math.min(d, 0.95)
    const zb = -d / 2 + baseD / 2 // main body centre (back against the wall)
    const armW = o.arms === 'none' ? 0 : ARM
    const seatH = 0.44
    const seats = Math.max(1, Number(o.seats))
    legs(kit, 'legs', w, baseD, legH, String(o.legs), 0.07)
    if (o.chaise !== 'none') {
      const cx = o.chaise === 'left' ? -w / 2 + 0.4 : w / 2 - 0.4
      legs(kit, 'legs', 0.8, d - baseD, legH, String(o.legs), 0.07)
      kit.soft('upholstery', [0.8, seatH - legH - 0.12, d - baseD + 0.05], [cx, (seatH - 0.12 + legH) / 2, d / 2 - (d - baseD) / 2], 0.03)
      kit.soft('cushions', [0.78 - (o.chaise === 'left' ? armW : armW), 0.13, d - baseD + 0.02], [cx + (o.chaise === 'left' ? armW / 2 : -armW / 2), seatH - 0.06, d / 2 - (d - baseD) / 2 + 0.01], 0.05)
    }
    // Base and seat cushions
    kit.soft('upholstery', [w, seatH - legH - 0.12, baseD], [0, (seatH - 0.12 + legH) / 2, zb], 0.03)
    const inner = w - armW * 2
    const cw = inner / seats
    for (let i = 0; i < seats; i++) {
      const x = -inner / 2 + cw * (i + 0.5)
      kit.soft('cushions', [cw - 0.015, 0.13, baseD - 0.22], [x, seatH - 0.06, zb + 0.1], 0.05)
      if (o.back === 'loose') kit.soft('cushions', [cw - 0.02, h - seatH - 0.05, 0.2], [x, (h + seatH) / 2 - 0.02, -d / 2 + 0.24], 0.06, { rot: [-10, 0, 0] })
    }
    // Back
    kit.soft('upholstery', [w, h - legH - (o.back === 'tight' ? 0 : 0.12), 0.18], [0, (h - (o.back === 'tight' ? 0 : 0.12) + legH) / 2, -d / 2 + 0.09], 0.05)
    if (o.back === 'tight') kit.soft('upholstery', [inner, h - seatH - 0.05, 0.12], [0, (h + seatH) / 2, -d / 2 + 0.22], 0.06)
    // Arms
    if (armW) {
      const armH = o.arms === 'slope' ? 0.55 : 0.64
      ;[-1, 1].forEach(s => {
        if (o.chaise !== 'none' && ((o.chaise === 'left' && s < 0) || (o.chaise === 'right' && s > 0))) {
          kit.soft('upholstery', [armW, armH - legH, d], [s * (w / 2 - armW / 2), (armH + legH) / 2, 0], 0.04)
        } else kit.soft('upholstery', [armW, armH - legH, baseD], [s * (w / 2 - armW / 2), (armH + legH) / 2, zb], 0.04)
        if (o.arms === 'rolled') kit.cylinder('upholstery', { d: armW + 0.06, h: (o.chaise !== 'none' && ((o.chaise === 'left' && s < 0) || (o.chaise === 'right' && s > 0)) ? d : baseD) - 0.02, sides: 14 }, [s * (w / 2 - armW / 2), armH, o.chaise !== 'none' && ((o.chaise === 'left' && s < 0) || (o.chaise === 'right' && s > 0)) ? 0 : zb], { rot: [90, 0, 0] })
      })
    }
    // Scatter cushions against the arms
    const n = Number(o.pillows)
    for (let i = 0; i < n; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const k = Math.floor(i / 2)
      kit.soft('pillows', [0.42, 0.42, 0.13], [side * (inner / 2 - 0.25 - k * 0.32), seatH + 0.26, -d / 2 + 0.36], 0.06, { rot: [-14, side * 12, 0], small: true })
    }
  },
  plan({ w, d, o }) {
    const baseD = Math.min(d, 0.95)
    const zb = -d / 2 + baseD / 2
    const armW = o.arms === 'none' ? 0 : ARM
    const seats = Math.max(1, Number(o.seats))
    const inner = w - armW * 2
    const out: PlanShape[] = []
    if (o.chaise !== 'none') {
      const cx = o.chaise === 'left' ? -w / 2 + 0.4 : w / 2 - 0.4
      out.push(rect(cx, d / 2 - (d - baseD) / 2, 0.8, d - baseD + 0.02, 'body', 0.03))
    }
    out.push(rect(0, zb, w, baseD, 'body', 0.04), rect(0, -d / 2 + 0.09, w, 0.18, 'soft', 0.04, 'upholstery'))
    for (let i = 0; i < seats; i++) out.push(rect(-inner / 2 + (inner / seats) * (i + 0.5), zb + 0.1, inner / seats - 0.02, baseD - 0.24, 'soft', 0.04, 'cushions'))
    if (armW) [-1, 1].forEach(s => out.push(rect(s * (w / 2 - armW / 2), zb, armW, baseD, 'soft', 0.03, 'upholstery')))
    return out
  }
}

function tableTop(kit: Kit, slot: string, shape: string, w: number, d: number, y: number, t: number): void {
  if (shape === 'round' || shape === 'oval') kit.cylinder(slot, { d: 1, h: t, sides: 40 }, [0, y - t / 2, 0], { scale: [w, 1, d] })
  else kit.box(slot, [w, t, d], [0, y - t / 2, 0])
}

export const coffeeTable: PropDef = {
  id: 'coffee-table', name: 'Coffee table', category: 'living', rooms: ['living'], keywords: ['table', 'low table', 'cocktail table'],
  size: { w: 1.2, d: 0.6, h: 0.42 }, mount: 'floor',
  options: [
    { id: 'shape', label: 'Top', type: 'select', default: 'rect', choices: [{ value: 'rect', label: 'Rectangle' }, { value: 'round', label: 'Round' }, { value: 'oval', label: 'Oval' }] },
    { id: 'base', label: 'Base', type: 'select', default: 'legs', choices: [{ value: 'legs', label: 'Four legs' }, { value: 'pedestal', label: 'Pedestal' }, { value: 'block', label: 'Solid block' }] },
    { id: 'shelf', label: 'Lower shelf', type: 'toggle', default: false }
  ],
  slots: [
    { id: 'top', label: 'Top', default: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43' } },
    { id: 'base', label: 'Base', default: { material: 'metal', colour: '#2a2b2d' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const t = 0.03
    tableTop(kit, 'top', String(o.shape), w, d, h, t)
    if (o.base === 'pedestal') {
      kit.cylinder('base', { d: Math.min(w, d) * 0.45, h: h - t, sides: 28 }, [0, (h - t) / 2, 0])
    } else if (o.base === 'block') {
      if (o.shape === 'rect') kit.box('base', [w * 0.8, h - t, d * 0.8], [0, (h - t) / 2, 0])
      else kit.cylinder('base', { d: 1, h: h - t, sides: 32 }, [0, (h - t) / 2, 0], { scale: [w * 0.8, 1, d * 0.8] })
    } else legs(kit, 'base', w * (o.shape === 'rect' ? 1 : 0.75), d * (o.shape === 'rect' ? 1 : 0.75), h - t, 'block', 0.04)
    if (o.shelf) tableTop(kit, 'top', String(o.shape), w * 0.9, d * 0.85, 0.14, 0.02)
  },
  plan: ({ w, d, o }) => [o.shape === 'rect' ? rect(0, 0, w, d, 'body', 0.01, 'top') : { t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'top' }]
}

export const sideTable: PropDef = {
  id: 'side-table', name: 'Side table', category: 'living', rooms: ['living', 'bedroom'], keywords: ['end table', 'occasional table', 'lamp table'],
  size: { w: 0.5, d: 0.5, h: 0.55 }, mount: 'floor',
  options: [
    { id: 'shape', label: 'Top', type: 'select', default: 'round', choices: [{ value: 'round', label: 'Round' }, { value: 'rect', label: 'Square' }] },
    { id: 'base', label: 'Base', type: 'select', default: 'pedestal', choices: [{ value: 'legs', label: 'Legs' }, { value: 'pedestal', label: 'Pedestal' }] }
  ],
  slots: [
    { id: 'top', label: 'Top', default: { material: 'stone', colour: '#ecebe8', colour2: '#9fa3a8' } },
    { id: 'base', label: 'Base', default: { material: 'metal', colour: '#c9a04f' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    tableTop(kit, 'top', String(o.shape), w, d, h, 0.025)
    if (o.base === 'pedestal') {
      kit.cylinder('base', { d: 0.06, h: h - 0.04, sides: 16 }, [0, (h - 0.04) / 2 + 0.015, 0])
      kit.cylinder('base', { d: Math.min(w, d) * 0.6, h: 0.02, sides: 24 }, [0, 0.01, 0])
    } else legs(kit, 'base', w * 0.8, d * 0.8, h - 0.025, 'tapered', 0.03)
  },
  plan: ({ w, d, o }) => [o.shape === 'rect' ? rect(0, 0, w, d, 'body', 0, 'top') : { t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'top' }]
}

const TV_SIZES: { [k: string]: [number, number] } = { '32': [0.73, 0.43], '43': [0.96, 0.56], '50': [1.12, 0.65], '55': [1.23, 0.71], '65': [1.45, 0.84], '75': [1.68, 0.97], '85': [1.9, 1.09] }

export const tv: PropDef = {
  id: 'tv', name: 'TV', category: 'living', rooms: ['living', 'bedroom', 'office'], keywords: ['television', 'screen', 'monitor', 'display'],
  size: { w: 1.23, d: 0.25, h: 0.78 }, mount: 'surface', imageSlot: 'screen',
  options: [
    { id: 'inches', label: 'Size', type: 'select', default: '55', choices: Object.keys(TV_SIZES).map(k => ({ value: k, label: `${k}″` })) },
    { id: 'stand', label: 'Mounting', type: 'select', default: 'feet', choices: [{ value: 'feet', label: 'On feet' }, { value: 'pedestal', label: 'Pedestal stand' }, { value: 'wall', label: 'Wall-mounted' }] }
  ],
  slots: [
    { id: 'body', label: 'Frame', default: { material: 'plastic', colour: '#202022', roughness: 0.3 } },
    { id: 'screen', label: 'Screen', default: { material: 'glass', colour: '#0d0f12', opacity: 1, roughness: 0.08 } }
  ],
  sizeFor: (o, cur, changed) => {
    if (changed && changed !== 'inches' && changed !== 'stand') return null
    const [w, h] = TV_SIZES[String(o.inches)] ?? TV_SIZES['55']
    return { w, d: o.stand === 'wall' ? 0.05 : 0.25, h: o.stand === 'wall' ? h : h + 0.07 }
  },
  build(kit, { w, d, h, o }) {
    const lift = o.stand === 'wall' ? 0 : 0.07
    const sh = h - lift
    const z = o.stand === 'wall' ? 0 : -d / 2 + 0.06
    kit.box('body', [w, sh, 0.04], [0, lift + sh / 2, z])
    kit.plane('screen', { w: w - 0.02, h: sh - 0.02 }, [0, lift + sh / 2, z + 0.021], { fit: true })
    if (o.stand === 'feet') [-1, 1].forEach(s => kit.box('body', [0.05, 0.012, d * 0.9], [s * w * 0.38, 0.006, 0], { small: true }))
    if (o.stand === 'pedestal') {
      kit.box('body', [w * 0.3, 0.012, d * 0.9], [0, 0.006, 0])
      kit.box('body', [0.05, lift + 0.1, 0.03], [0, (lift + 0.1) / 2, z - 0.03])
    }
  },
  plan: ({ w, d, o }) => [rect(0, o.stand === 'wall' ? 0 : -d / 2 + 0.06, w, 0.04, 'body', 0, 'body'), ...(o.stand === 'wall' ? [] : [rect(0, 0, w * 0.6, d, 'hidden')])]
}

export const mediaUnit: PropDef = {
  id: 'media-unit', name: 'TV unit / media console', category: 'living', rooms: ['living', 'bedroom'], keywords: ['tv stand', 'console', 'credenza'],
  size: { w: 1.8, d: 0.42, h: 0.5 }, mount: 'floor',
  options: [
    { id: 'doors', label: 'Doors / drawers', type: 'number', min: 1, max: 6, step: 1, default: 3 },
    { id: 'kind', label: 'Fronts', type: 'select', default: 'doors', choices: [{ value: 'doors', label: 'Doors' }, { value: 'drawers', label: 'Drawers' }, { value: 'open', label: 'Open shelves' }] },
    { ...LEG_OPTION }, { ...HANDLE_OPTION, default: 'recessed' }
  ],
  slots: [
    { id: 'body', label: 'Body', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } },
    { id: 'fronts', label: 'Fronts', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } },
    { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#c9a04f' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.05 : 0.14
    legs(kit, 'body', w, d, legH, String(o.legs), 0.05)
    const n = Number(o.doors)
    if (o.kind === 'open') {
      kit.box('body', [w, 0.025, d], [0, h - 0.0125, 0])
      kit.box('body', [w, 0.025, d], [0, legH + 0.0125, 0])
      kit.box('body', [w, h - legH, 0.015], [0, (h + legH) / 2, -d / 2 + 0.0075])
      for (let i = 0; i <= n; i++) kit.box('body', [0.022, h - legH, d], [-w / 2 + 0.011 + (w - 0.022) * (i / n), (h + legH) / 2, 0])
    } else {
      kit.box('body', [w, h - legH, d], [0, (h + legH) / 2, 0])
      fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.03, h: h - legH - 0.03, y0: legH + 0.015, faceZ: d / 2 }, n, 1, o.kind === 'doors')
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body'), line([-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03])]
}

// Rows of books on a shelf: varied heights/widths, coloured around the slot colour.
export function booksRow(kit: Kit, slot: string, x0: number, x1: number, y: number, zBack: number, depth: number, maxH: number, seed: number): void {
  let s = seed
  const rand = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
  let x = x0 + 0.01
  while (x < x1 - 0.03) {
    if (rand() < 0.08) { x += 0.04 + rand() * 0.08; continue }
    const bw = 0.018 + rand() * 0.035
    if (x + bw > x1) break
    const bh = Math.min(maxH, maxH * (0.62 + rand() * 0.38))
    const bd = depth * (0.7 + rand() * 0.3)
    kit.box(`${slot}${Math.floor(rand() * 4)}`, [bw, bh, bd], [x + bw / 2, y + bh / 2, zBack + bd / 2], { small: true })
    x += bw + 0.002
  }
}

export const bookshelf: PropDef = {
  id: 'bookshelf', name: 'Bookshelf', category: 'living', rooms: ['living', 'office', 'bedroom'], keywords: ['bookcase', 'shelving', 'shelves', 'library'],
  size: { w: 0.9, d: 0.32, h: 1.9 }, mount: 'floor',
  options: [
    { id: 'shelves', label: 'Shelves', type: 'number', min: 2, max: 8, step: 1, default: 5 },
    { id: 'books', label: 'Books', type: 'select', default: 'full', choices: [{ value: 'full', label: 'Full' }, { value: 'some', label: 'Some + objects' }, { value: 'none', label: 'Empty' }] },
    { id: 'back', label: 'Back panel', type: 'toggle', default: true }
  ],
  slots: [
    { id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } },
    { id: 'books0', label: 'Books (1)', default: { material: 'paper', colour: '#7a2e2a' } },
    { id: 'books1', label: 'Books (2)', default: { material: 'paper', colour: '#2f3b55' } },
    { id: 'books2', label: 'Books (3)', default: { material: 'paper', colour: '#d8cdb8' } },
    { id: 'books3', label: 'Books (4)', default: { material: 'paper', colour: '#3c5641' } }
  ],
  build(kit, { w, d, h, o }) {
    const t = 0.022
    kit.box('frame', [t, h, d], [-w / 2 + t / 2, h / 2, 0])
    kit.box('frame', [t, h, d], [w / 2 - t / 2, h / 2, 0])
    if (o.back) kit.box('frame', [w - t * 2, h, 0.008], [0, h / 2, -d / 2 + 0.004])
    const n = Number(o.shelves)
    const gap = (h - t) / n
    for (let i = 0; i <= n; i++) kit.box('frame', [w - t * 2, t, d], [0, t / 2 + gap * i, 0])
    if (o.books === 'none') return
    for (let i = 0; i < n; i++) {
      const y = t + gap * i
      const half = o.books === 'some' && i % 2 === 1
      booksRow(kit, 'books', -w / 2 + t, half ? 0 : w / 2 - t, y, -d / 2 + 0.01, d - 0.03, Math.min(0.3, gap - 0.03), 11 + i * 7)
      if (half) kit.lathe('books2', [[0.0, 0], [0.05, 0.005], [0.06, 0.08], [0.03, 0.16], [0.025, 0.2]], [w / 4, y, 0], { sides: 14, small: true })
    }
  },
  plan: ({ w, d, o }) => {
    const out: PlanShape[] = [rect(0, 0, w, d, 'body', 0, 'frame')]
    if (o.books !== 'none') out.push(rect(0, -0.01, w - 0.06, d - 0.06, 'soft', 0, 'books1'))
    return out
  }
}

export const sideboard: PropDef = {
  id: 'sideboard', name: 'Sideboard', category: 'dining', rooms: ['dining', 'living', 'hallway'], keywords: ['buffet', 'credenza', 'cabinet'],
  size: { w: 1.6, d: 0.45, h: 0.8 }, mount: 'floor',
  options: [{ id: 'doors', label: 'Doors', type: 'number', min: 2, max: 6, step: 1, default: 4 }, { ...LEG_OPTION }, { ...HANDLE_OPTION, default: 'knob' }],
  slots: [
    { id: 'body', label: 'Body', default: { material: 'wood', colour: '#a0703d', colour2: '#825829' } },
    { id: 'fronts', label: 'Doors', default: { material: 'rattan', colour: '#c8a273', colour2: '#9c7a4f' } },
    { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#c9a04f' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.06 : 0.18
    legs(kit, 'body', w, d, legH, String(o.legs), 0.05)
    kit.box('body', [w, h - legH, d], [0, (h + legH) / 2, 0])
    fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.04, h: h - legH - 0.04, y0: legH + 0.02, faceZ: d / 2 }, Number(o.doors), 1, true)
  },
  plan: ({ w, d }) => [rect(0, 0, w, d), line([-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03])]
}

export const pouf: PropDef = {
  id: 'pouf', name: 'Ottoman / pouf', category: 'living', rooms: ['living', 'bedroom'], keywords: ['footstool', 'ottoman', 'pouffe'],
  size: { w: 0.55, d: 0.55, h: 0.42 }, mount: 'floor',
  options: [{ id: 'shape', label: 'Shape', type: 'select', default: 'round', choices: [{ value: 'round', label: 'Round' }, { value: 'square', label: 'Square' }] }],
  slots: [{ id: 'cover', label: 'Cover', default: { material: 'leather', colour: '#a86b3c' } }],
  build(kit, { w, d, h, o }) {
    if (o.shape === 'square') kit.soft('cover', [w, h, d], [0, h / 2, 0], 0.06)
    else kit.lathe('cover', [[0, 0], [0.45, 0], [0.5, 0.15], [0.5, 0.82], [0.44, 0.97], [0, 1]], [0, 0, 0], { sides: 28, scale: [w, h, d] })
  },
  plan: ({ w, d, o }) => [o.shape === 'square' ? rect(0, 0, w, d, 'body', 0.06) : { t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body' }]
}

export const fireplace: PropDef = {
  id: 'fireplace', name: 'Fireplace', category: 'living', rooms: ['living', 'bedroom'], keywords: ['mantel', 'mantelpiece', 'hearth', 'fire'],
  size: { w: 1.4, d: 0.3, h: 1.15 }, mount: 'floor',
  options: [{ id: 'fire', label: 'Fire lit', type: 'toggle', default: true }, { id: 'style', label: 'Style', type: 'select', default: 'classic', choices: [{ value: 'classic', label: 'Classic surround' }, { value: 'modern', label: 'Modern slab' }] }],
  slots: [
    { id: 'surround', label: 'Surround', default: { material: 'stone', colour: '#ecebe8', colour2: '#9fa3a8' } },
    { id: 'firebox', label: 'Firebox', default: { material: 'concrete', colour: '#1f1f21' } },
    { id: 'fire', label: 'Flames', default: { material: 'glow', colour: '#ffb54a' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const bw = w * 0.55
    const bh = h * 0.62
    if (o.style === 'modern') {
      kit.box('surround', [w, h, d * 0.6], [0, h / 2, -d * 0.2])
      kit.box('surround', [w + 0.3, 0.1, d], [0, 0.05, 0])
    } else {
      kit.box('surround', [(w - bw) / 2, h - 0.08, d * 0.7], [-(w + bw) / 4, (h - 0.08) / 2, -d * 0.15])
      kit.box('surround', [(w - bw) / 2, h - 0.08, d * 0.7], [(w + bw) / 4, (h - 0.08) / 2, -d * 0.15])
      kit.box('surround', [bw, h - bh - 0.08, d * 0.7], [0, bh + (h - bh - 0.08) / 2, -d * 0.15])
      kit.box('surround', [w + 0.12, 0.08, d], [0, h - 0.04, 0])
      kit.box('surround', [w + 0.2, 0.05, d + 0.25], [0, 0.025, 0.12])
    }
    kit.box('firebox', [bw, bh, 0.02], [0, bh / 2, -d / 2 + 0.03])
    if (o.fire) {
      [-0.12, 0, 0.12].forEach((x, i) => kit.lathe('fire', [[0, 0], [0.06, 0.03], [0.04, 0.14 + i * 0.03], [0, 0.22 + (i % 2) * 0.06]], [x * bw * 2, 0.08, -d / 2 + 0.12], { sides: 10, small: true }))
      kit.box('firebox', [bw * 0.7, 0.06, 0.12], [0, 0.08, -d / 2 + 0.12])
    }
  },
  plan: ({ w, d }) => [rect(0, -d * 0.15, w, d * 0.7, 'body', 0, 'surround'), rect(0, 0, w * 0.55, d * 0.4, 'hidden')]
}

export const LIVING: PropDef[] = [sofa, coffeeTable, sideTable, tv, mediaUnit, bookshelf, sideboard, pouf, fireplace]
// Re-exported so other rooms can use the same top helper.
export { tableTop, circle }
