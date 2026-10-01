import { PlanShape, PropDef } from '../types'
import { circle, fronts, HANDLE_OPTION, LEG_OPTION, legs, line, rect } from './parts'

// Bedroom furniture. Front (+z) is the side you approach from; the back sits against a wall.

const BED_SIZES: { [id: string]: [number, number] } = {
  single: [0.92, 1.95], double: [1.4, 1.95], queen: [1.6, 2.05], king: [1.85, 2.05], superking: [2.0, 2.1]
}

export const bed: PropDef = {
  id: 'bed', name: 'Bed', category: 'bedroom', rooms: ['bedroom'], keywords: ['double', 'king', 'queen', 'single', 'mattress'],
  size: { w: 1.68, d: 2.17, h: 1.05 }, min: { w: 0.7, d: 1.5, h: 0.4 }, mount: 'floor',
  options: [
    { id: 'size', label: 'Size', type: 'select', default: 'queen', choices: [
      { value: 'single', label: 'Single' }, { value: 'double', label: 'Double' }, { value: 'queen', label: 'Queen' },
      { value: 'king', label: 'King' }, { value: 'superking', label: 'Super king' }] },
    { id: 'headboard', label: 'Headboard', type: 'select', default: 'upholstered', choices: [
      { value: 'upholstered', label: 'Upholstered' }, { value: 'panel', label: 'Wood panel' }, { value: 'slatted', label: 'Slatted' },
      { value: 'wingback', label: 'Wingback' }, { value: 'none', label: 'None' }] },
    { ...LEG_OPTION, default: 'block' },
    { id: 'pillows', label: 'Pillows', type: 'number', min: 0, max: 6, step: 1, default: 4 },
    { id: 'duvet', label: 'Duvet', type: 'select', default: 'flat', choices: [
      { value: 'flat', label: 'Made, flat' }, { value: 'folded', label: 'Folded at the foot' }, { value: 'none', label: 'None (bare mattress)' }] },
    { id: 'throw', label: 'Throw blanket', type: 'toggle', default: true }
  ],
  slots: [
    { id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43' } },
    { id: 'headboard', label: 'Headboard', default: { material: 'fabric', colour: '#a9a294' } },
    { id: 'mattress', label: 'Mattress', default: { material: 'fabric', colour: '#efeee9', pattern: 'none' } },
    { id: 'bedding', label: 'Duvet', default: { material: 'fabric', colour: '#f1eee8' } },
    { id: 'pillows', label: 'Pillows', default: { material: 'fabric', colour: '#e8e2d6' } },
    { id: 'throw', label: 'Throw', default: { material: 'fabric', colour: '#a5532f', pattern: 'stripes', colour2: '#d8cdb8', scale: 0.25 } }
  ],
  sizeFor: (o, cur) => {
    const s = BED_SIZES[String(o.size)]
    return s ? { w: s[0] + 0.08, d: s[1] + 0.12, h: cur.h } : null
  },
  surfaceTop: () => 0.52,
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.1 : 0.14
    const frameTop = 0.3
    const hbT = o.headboard === 'none' ? 0 : 0.07
    const bodyD = d - hbT
    const zc = hbT / 2 // centre of the bed body
    legs(kit, 'frame', w, bodyD, legH, String(o.legs), 0.06)
    // Frame rails
    kit.box('frame', [w, frameTop - legH, bodyD], [0, (legH + frameTop) / 2, zc])
    // Mattress
    const mw = w - 0.08
    const md = bodyD - 0.06
    const mTop = frameTop + 0.22
    kit.soft('mattress', [mw, 0.22, md], [0, frameTop + 0.11, zc], 0.04)
    // Duvet
    if (o.duvet === 'flat') {
      const len = md * 0.72
      kit.soft('bedding', [mw + 0.04, 0.07, len], [0, mTop + 0.02, zc + md / 2 - len / 2 + 0.02], 0.03)
      kit.soft('bedding', [mw + 0.05, 0.2, 0.03], [0, mTop - 0.08, zc + md / 2 + 0.01], 0.012)
    } else if (o.duvet === 'folded') {
      const len = md * 0.3
      kit.soft('bedding', [mw + 0.02, 0.12, len], [0, mTop + 0.05, zc + md / 2 - len / 2], 0.04)
    }
    if (o.throw) kit.soft('throw', [mw + 0.06, 0.03, 0.5], [0, mTop + (o.duvet === 'flat' ? 0.07 : 0.02), zc + md / 2 - 0.42], 0.012)
    // Pillows: a back row leaning on the headboard, a front row lying flat.
    const n = Number(o.pillows)
    const headZ = -d / 2 + hbT
    const row = (count: number, z: number, y: number, tilt: number) => {
      const pw = Math.min(0.7, (mw - 0.06) / Math.max(1, count))
      for (let i = 0; i < count; i++) {
        const x = -((count - 1) * pw) / 2 + i * pw
        kit.soft('pillows', [pw - 0.04, 0.13, 0.4], [x, y, z], 0.06, { rot: [tilt, 0, 0] })
      }
    }
    const back = Math.min(n, Math.max(1, Math.round(n / 2)))
    if (n > 0) row(back, headZ + 0.22, mTop + 0.12, -35)
    if (n - back > 0) row(n - back, headZ + 0.48, mTop + 0.08, -8)
    // Headboard
    const hz = -d / 2 + hbT / 2
    if (o.headboard === 'panel') kit.box('frame', [w, h, hbT], [0, h / 2, hz])
    else if (o.headboard === 'slatted') {
      kit.box('frame', [0.06, h, hbT], [-w / 2 + 0.03, h / 2, hz])
      kit.box('frame', [0.06, h, hbT], [w / 2 - 0.03, h / 2, hz])
      kit.box('frame', [w, 0.06, hbT], [0, h - 0.03, hz])
      const slats = Math.max(4, Math.round(w / 0.12))
      for (let i = 1; i < slats; i++) kit.box('frame', [0.045, h - mTop, 0.025], [-w / 2 + (w / slats) * i, (h + mTop) / 2, hz], { small: true })
    } else if (o.headboard === 'upholstered' || o.headboard === 'wingback') {
      kit.box('frame', [w, frameTop, hbT], [0, frameTop / 2, hz])
      kit.soft('headboard', [w, h - frameTop + 0.02, 0.1], [0, (h + frameTop) / 2, hz], 0.04)
      if (o.headboard === 'wingback') {
        [-1, 1].forEach(s => kit.soft('headboard', [0.1, h - frameTop, 0.32], [s * (w / 2 - 0.05), (h + frameTop) / 2, hz + 0.14], 0.04))
      }
    }
  },
  plan({ w, d, o }) {
    const hbT = o.headboard === 'none' ? 0 : 0.07
    const mw = w - 0.08
    const md = d - hbT - 0.06
    const zc = hbT / 2
    const out: PlanShape[] = [rect(0, 0, w, d), rect(0, zc, mw, md, 'soft', 0.04, 'mattress')]
    if (hbT) out.push(rect(0, -d / 2 + hbT / 2, w, hbT, 'body', 0, 'headboard'))
    if (o.duvet === 'flat') out.push(rect(0, zc + md / 2 - (md * 0.72) / 2, mw + 0.04, md * 0.72, 'soft', 0.03, 'bedding'), line([-mw / 2, zc + md / 2 - md * 0.72 + 0.25], [mw / 2, zc + md / 2 - md * 0.72 + 0.25]))
    const n = Number(o.pillows)
    const back = Math.min(n, Math.max(1, Math.round(n / 2)))
    const pw = Math.min(0.7, (mw - 0.06) / Math.max(1, back))
    for (let i = 0; i < back && n > 0; i++) out.push(rect(-((back - 1) * pw) / 2 + i * pw, -d / 2 + hbT + 0.22, pw - 0.04, 0.36, 'soft', 0.06, 'pillows'))
    return out
  }
}

export const nightstand: PropDef = {
  id: 'nightstand', name: 'Nightstand', category: 'bedroom', rooms: ['bedroom'], keywords: ['bedside table', 'side table'],
  size: { w: 0.5, d: 0.4, h: 0.55 }, mount: 'floor',
  options: [
    { id: 'drawers', label: 'Drawers', type: 'number', min: 0, max: 3, step: 1, default: 2 },
    { ...LEG_OPTION }, { ...HANDLE_OPTION, default: 'knob' }
  ],
  slots: [
    { id: 'body', label: 'Body', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } },
    { id: 'fronts', label: 'Drawer fronts', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } },
    { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#c9a04f' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.06 : 0.16
    legs(kit, 'body', w, d, legH, String(o.legs), 0.04)
    kit.box('body', [w, h - legH, d], [0, (h + legH) / 2, 0])
    const n = Number(o.drawers)
    if (n > 0) fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.04, h: (h - legH - 0.04) * (n === 1 ? 0.45 : 1), y0: n === 1 ? h - 0.02 - (h - legH - 0.04) * 0.45 : legH + 0.02, faceZ: d / 2 }, 1, n)
  },
  plan: ({ w, d }) => [rect(0, 0, w, d), line([-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03])]
}

export const dresser: PropDef = {
  id: 'dresser', name: 'Chest of drawers', category: 'bedroom', rooms: ['bedroom', 'hallway', 'living'], keywords: ['dresser', 'drawers', 'commode'],
  size: { w: 1.0, d: 0.45, h: 0.85 }, mount: 'floor',
  options: [
    { id: 'rows', label: 'Drawer rows', type: 'number', min: 2, max: 6, step: 1, default: 3 },
    { id: 'cols', label: 'Columns', type: 'number', min: 1, max: 3, step: 1, default: 2 },
    { ...LEG_OPTION }, { ...HANDLE_OPTION }
  ],
  slots: [
    { id: 'body', label: 'Body', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } },
    { id: 'fronts', label: 'Drawer fronts', default: { material: 'painted', colour: '#9aa88f' } },
    { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#2a2b2d' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.08 : 0.15
    legs(kit, 'body', w, d, legH, String(o.legs), 0.05)
    kit.box('body', [w, h - legH, d], [0, (h + legH) / 2, 0])
    fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.04, h: h - legH - 0.04, y0: legH + 0.02, faceZ: d / 2 }, Number(o.cols), Number(o.rows))
  },
  plan: ({ w, d }) => [rect(0, 0, w, d), line([-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03])]
}

export const wardrobe: PropDef = {
  id: 'wardrobe', name: 'Wardrobe', category: 'bedroom', rooms: ['bedroom', 'hallway'], keywords: ['closet', 'armoire', 'cupboard'],
  size: { w: 1.2, d: 0.6, h: 2.1 }, mount: 'floor',
  options: [
    { id: 'doors', label: 'Doors', type: 'number', min: 1, max: 4, step: 1, default: 2 },
    { id: 'drawers', label: 'Drawers below', type: 'number', min: 0, max: 3, step: 1, default: 0 },
    { ...LEG_OPTION, default: 'plinth' }, { ...HANDLE_OPTION }
  ],
  slots: [
    { id: 'body', label: 'Body', default: { material: 'painted', colour: '#efeae0' } },
    { id: 'fronts', label: 'Doors', default: { material: 'painted', colour: '#efeae0' } },
    { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#c9a04f' } }
  ],
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.08 : 0.15
    legs(kit, 'body', w, d, legH, String(o.legs), 0.05)
    kit.box('body', [w, h - legH, d], [0, (h + legH) / 2, 0])
    const dr = Number(o.drawers)
    const drawerH = dr * 0.2
    if (dr) fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.03, h: drawerH, y0: legH + 0.015, faceZ: d / 2 }, 1, dr)
    fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.03, h: h - legH - drawerH - 0.03, y0: legH + drawerH + 0.015, faceZ: d / 2 }, Number(o.doors), 1, true)
  },
  plan: ({ w, d, o }) => {
    const out: PlanShape[] = [rect(0, 0, w, d)]
    const n = Number(o.doors)
    for (let i = 1; i < n; i++) out.push(line([-w / 2 + (w / n) * i, d / 2], [-w / 2 + (w / n) * i, d / 2 - 0.06]))
    out.push(line([-w / 2 + 0.04, 0], [w / 2 - 0.04, 0]))
    return out
  }
}

export const armchair: PropDef = {
  id: 'armchair', name: 'Armchair', category: 'living', rooms: ['living', 'bedroom', 'office'], keywords: ['chair', 'lounge chair', 'accent chair'],
  size: { w: 0.82, d: 0.85, h: 0.85 }, mount: 'floor',
  options: [
    { id: 'arms', label: 'Arms', type: 'select', default: 'track', choices: [
      { value: 'track', label: 'Track (square)' }, { value: 'rolled', label: 'Rolled' }, { value: 'none', label: 'Armless' }] },
    { ...LEG_OPTION }
  ],
  slots: [
    { id: 'upholstery', label: 'Upholstery', default: { material: 'velvet', colour: '#1f5a46' } },
    { id: 'cushion', label: 'Seat cushion', default: { material: 'velvet', colour: '#1f5a46' } },
    { id: 'legs', label: 'Legs', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } }
  ],
  build(kit, { w, d, h, o }) {
    const legH = o.legs === 'plinth' ? 0.04 : 0.14
    legs(kit, 'legs', w, d, legH, String(o.legs), 0.06)
    const armW = o.arms === 'none' ? 0 : 0.14
    const seatH = 0.42
    kit.soft('upholstery', [w, seatH - legH - 0.1, d], [0, (seatH - 0.1 + legH) / 2, 0], 0.03)
    kit.soft('cushion', [w - armW * 2, 0.12, d - 0.2], [0, seatH - 0.05, 0.07], 0.04)
    kit.soft('upholstery', [w, h - legH, 0.2], [0, (h + legH) / 2, -d / 2 + 0.1], 0.05)
    if (armW) {
      const armH = 0.64
      ;[-1, 1].forEach(s => {
        kit.soft('upholstery', [armW, armH - legH, d], [s * (w / 2 - armW / 2), (armH + legH) / 2, 0], 0.04)
        if (o.arms === 'rolled') kit.cylinder('upholstery', { d: armW + 0.05, h: d - 0.02, sides: 14 }, [s * (w / 2 - armW / 2), armH, 0.01], { rot: [90, 0, 0] })
      })
    }
  },
  plan: ({ w, d, o }) => {
    const armW = o.arms === 'none' ? 0 : 0.14
    const out: PlanShape[] = [rect(0, 0, w, d, 'body', 0.04), rect(0, -d / 2 + 0.1, w, 0.2, 'soft', 0.04)]
    if (armW) [-1, 1].forEach(s => out.push(rect(s * (w / 2 - armW / 2), 0, armW, d, 'soft', 0.04)))
    out.push(rect(0, 0.07, w - armW * 2 - 0.02, d - 0.24, 'soft', 0.04, 'cushion'))
    return out
  }
}

export const bench: PropDef = {
  id: 'bench', name: 'Bench', category: 'bedroom', rooms: ['bedroom', 'hallway', 'dining'], keywords: ['end of bed', 'ottoman bench'],
  size: { w: 1.2, d: 0.4, h: 0.46 }, mount: 'floor',
  options: [{ ...LEG_OPTION }, { id: 'cushion', label: 'Cushioned top', type: 'toggle', default: true }],
  slots: [
    { id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43' } },
    { id: 'top', label: 'Top', default: { material: 'leather', colour: '#a86b3c' } }
  ],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const top = o.cushion ? 0.08 : 0.04
    legs(kit, 'frame', w, d, h - top, String(o.legs), 0.05)
    if (o.cushion) {
      kit.box('frame', [w, 0.03, d], [0, h - top + 0.015, 0])
      kit.soft('top', [w, top - 0.02, d], [0, h - (top - 0.02) / 2, 0], 0.025)
    } else kit.box('top', [w, top, d], [0, h - top / 2, 0])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.02, 'top')]
}

export const floorMirror: PropDef = {
  id: 'floor-mirror', name: 'Floor mirror', category: 'bedroom', rooms: ['bedroom', 'hallway', 'bathroom'], keywords: ['mirror', 'cheval', 'full length'],
  size: { w: 0.6, d: 0.05, h: 1.7 }, mount: 'floor',
  options: [{ id: 'shape', label: 'Shape', type: 'select', default: 'rect', choices: [{ value: 'rect', label: 'Rectangle' }, { value: 'arch', label: 'Arched' }] }],
  slots: [
    { id: 'frame', label: 'Frame', default: { material: 'metal', colour: '#c9a04f' } },
    { id: 'glass', label: 'Mirror', default: { material: 'mirror', colour: '#e4e7ea' } }
  ],
  build(kit, { w, d, h, o }) {
    const f = 0.03
    if (o.shape === 'arch') {
      const r = w / 2
      kit.plane('glass', { w: w - f * 2, h: h - r }, [0, (h - r) / 2, d / 2 + 0.001], { fit: true })
      kit.cylinder('glass', { d: w - f * 2, h: 0.004, sides: 24 }, [0, h - r, d / 2], { rot: [90, 0, 0] })
      kit.box('frame', [f, h - r, d], [-w / 2 + f / 2, (h - r) / 2, 0])
      kit.box('frame', [f, h - r, d], [w / 2 - f / 2, (h - r) / 2, 0])
      kit.box('frame', [w, f, d], [0, f / 2, 0])
      kit.torus('frame', { d: w - f, thickness: f }, [0, h - r, 0], { rot: [90, 0, 0] })
    } else {
      kit.plane('glass', { w: w - f * 2, h: h - f * 2 }, [0, h / 2, d / 2 + 0.001], { fit: true })
      kit.box('frame', [f, h, d], [-w / 2 + f / 2, h / 2, 0])
      kit.box('frame', [f, h, d], [w / 2 - f / 2, h / 2, 0])
      kit.box('frame', [w, f, d], [0, f / 2, 0])
      kit.box('frame', [w, f, d], [0, h - f / 2, 0])
    }
    kit.box('frame', [w - f * 2, h - f * 2, 0.01], [0, h / 2, -d / 2 + 0.005])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d), { t: 'path', pts: [[-w / 2 + 0.03, d / 2], [w / 2 - 0.03, d / 2]], cls: 'glass' }]
}

export const rug: PropDef = {
  id: 'rug', name: 'Rug', category: 'decor', rooms: ['bedroom', 'living', 'dining', 'office', 'hallway'], keywords: ['carpet', 'runner', 'mat'],
  size: { w: 2.0, d: 1.4, h: 0.012 }, mount: 'floor',
  options: [{ id: 'shape', label: 'Shape', type: 'select', default: 'rect', choices: [{ value: 'rect', label: 'Rectangle' }, { value: 'round', label: 'Round / oval' }] }],
  slots: [{ id: 'rug', label: 'Rug', default: { material: 'fabric', colour: '#b5654a', pattern: 'geometric', colour2: '#e6d8bf', scale: 0.6 } }],
  build(kit, { w, d, h, o }) {
    if (o.shape === 'round') kit.cylinder('rug', { d: 1, h, sides: 48 }, [0, h / 2, 0], { scale: [w, 1, d] })
    else kit.box('rug', [w, h, d], [0, h / 2, 0])
  },
  plan: ({ w, d, o }) => [o.shape === 'round' ? { t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'soft', tint: 'rug' } : rect(0, 0, w, d, 'soft', 0, 'rug')]
}

export const tableLamp: PropDef = {
  id: 'table-lamp', name: 'Table lamp', category: 'practicals', rooms: ['bedroom', 'living', 'office', 'hallway'], keywords: ['lamp', 'bedside lamp', 'practical'],
  size: { w: 0.36, d: 0.36, h: 0.58 }, mount: 'surface',
  options: [
    { id: 'base', label: 'Base', type: 'select', default: 'gourd', choices: [
      { value: 'gourd', label: 'Ceramic gourd' }, { value: 'column', label: 'Column' }, { value: 'stick', label: 'Metal stick' }] },
    { id: 'shade', label: 'Shade', type: 'select', default: 'drum', choices: [
      { value: 'drum', label: 'Drum' }, { value: 'empire', label: 'Empire (tapered)' }, { value: 'dome', label: 'Dome' }] }
  ],
  slots: [
    { id: 'base', label: 'Base', default: { material: 'ceramic', colour: '#d8c4a4' } },
    { id: 'shade', label: 'Shade', default: { material: 'fabric', colour: '#f1eee8', pattern: 'weave' } }
  ],
  build(kit, { w, h, o }) {
    const shadeH = h * 0.38
    const baseH = h - shadeH * 0.75
    const r = w / 2
    if (o.base === 'gourd') kit.lathe('base', [[0.06, 0], [r * 0.55, baseH * 0.08], [r * 0.62, baseH * 0.35], [r * 0.45, baseH * 0.65], [0.025, baseH * 0.85], [0.012, baseH]], [0, 0, 0], { sides: 20 })
    else if (o.base === 'column') {
      kit.cylinder('base', { d: r * 0.9, h: 0.03, sides: 20 }, [0, 0.015, 0])
      kit.cylinder('base', { d: r * 0.4, h: baseH - 0.03, sides: 16 }, [0, 0.03 + (baseH - 0.03) / 2, 0])
    } else {
      kit.cylinder('base', { d: r * 0.8, h: 0.02, sides: 20 }, [0, 0.01, 0])
      kit.cylinder('base', { d: 0.016, h: baseH, sides: 8 }, [0, baseH / 2, 0], { small: true })
    }
    const y0 = h - shadeH
    if (o.shade === 'drum') kit.lathe('shade', [[r, 0], [r, shadeH]], [0, y0, 0], { sides: 28 })
    else if (o.shade === 'empire') kit.lathe('shade', [[r, 0], [r * 0.55, shadeH]], [0, y0, 0], { sides: 28 })
    else kit.lathe('shade', [[r, 0], [r * 0.9, shadeH * 0.45], [r * 0.6, shadeH * 0.85], [0.03, shadeH]], [0, y0, 0], { sides: 28 })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'soft', 'shade'), circle(0, 0, 0.03, 'line')]
}

export const painting: PropDef = {
  id: 'painting', name: 'Painting / canvas', category: 'decor', rooms: ['bedroom', 'living', 'dining', 'hallway', 'office'], keywords: ['art', 'artwork', 'canvas', 'picture', 'print'],
  size: { w: 0.9, d: 0.04, h: 0.65 }, mount: 'wall', elevation: 1.15, imageSlot: 'canvas',
  options: [{ id: 'frame', label: 'Frame', type: 'select', default: 'thin', choices: [
    { value: 'thin', label: 'Thin frame' }, { value: 'gallery', label: 'Gallery (wide)' }, { value: 'float', label: 'Float frame' }, { value: 'none', label: 'Unframed canvas' }] }],
  slots: [
    { id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#2a2522', colour2: '#1c1816' } },
    { id: 'canvas', label: 'Artwork', default: { material: 'paper', colour: '#c9a77c', pattern: 'geometric', colour2: '#2f3b55', scale: 0.5 } }
  ],
  build(kit, { w, d, h, o }) {
    const f = o.frame === 'gallery' ? 0.06 : o.frame === 'none' ? 0 : 0.025
    const gap = o.frame === 'float' ? 0.012 : 0
    kit.box('canvas', [w - f * 2 - gap * 2, h - f * 2 - gap * 2, d * 0.8], [0, h / 2, -d * 0.1])
    kit.plane('canvas', { w: w - f * 2 - gap * 2, h: h - f * 2 - gap * 2 }, [0, h / 2, d * 0.3 + 0.001], { fit: true })
    if (f) {
      kit.box('frame', [f, h, d], [-w / 2 + f / 2, h / 2, 0])
      kit.box('frame', [f, h, d], [w / 2 - f / 2, h / 2, 0])
      kit.box('frame', [w - f * 2, f, d], [0, f / 2, 0])
      kit.box('frame', [w - f * 2, f, d], [0, h - f / 2, 0])
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, Math.max(d, 0.03), 'body', 0, 'frame')]
}

export const BEDROOM: PropDef[] = [bed, nightstand, dresser, wardrobe, armchair, bench, floorMirror, rug, tableLamp, painting]
