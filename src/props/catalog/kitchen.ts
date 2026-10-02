import { Kit, PlanShape, PropDef } from '../types'
import { circle, fronts, HANDLE_OPTION, handle, line, rect } from './parts'

// Kitchen. Counter height 0.9 m; front (+z) is where you stand.

const COUNTER = { id: 'counter', label: 'Worktop', default: { material: 'stone' as const, colour: '#ecebe8', colour2: '#9fa3a8' } }
const DOORS = { id: 'fronts', label: 'Cabinet fronts', default: { material: 'painted' as const, colour: '#3c5641' } }
const CARCASS = { id: 'body', label: 'Carcass / plinth', default: { material: 'painted' as const, colour: '#2b2b2d' } }
const HANDLES = { id: 'handles', label: 'Handles', default: { material: 'metal' as const, colour: '#c9a04f' } }

// A run of base cabinets with worktop; units ≈ 0.6 m wide.
function baseRun(kit: Kit, w: number, d: number, h: number, handles: string, drawersTop: boolean, skip?: { x: number; w: number }): void {
  const plinth = 0.1
  const top = 0.035
  kit.box('body', [w - 0.06, plinth, d - 0.08], [0, plinth / 2, -0.04])
  kit.box('body', [w, h - plinth - top, d - 0.03], [0, plinth + (h - plinth - top) / 2, -0.015])
  kit.box('counter', [w, top, d], [0, h - top / 2, 0])
  const units = Math.max(1, Math.round(w / 0.6))
  const uw = w / units
  for (let i = 0; i < units; i++) {
    const x = -w / 2 + uw * (i + 0.5)
    if (skip && Math.abs(x - skip.x) < skip.w / 2) continue
    const area = { w: uw - 0.01, h: h - plinth - top - 0.01, y0: plinth + 0.005, faceZ: d / 2 - 0.03 }
    if (drawersTop) {
      fronts(kit, 'fronts', 'handles', handles, { ...area, h: 0.16, y0: area.y0 + area.h - 0.16 }, 1, 1)
      fronts(kit, 'fronts', 'handles', handles, { ...area, h: area.h - 0.17 }, 1, 1, true)
    } else fronts(kit, 'fronts', 'handles', handles, area, 1, 1, true)
  }
}

export const baseCabinets: PropDef = {
  id: 'base-cabinets', name: 'Base cabinets + worktop', category: 'kitchen', rooms: ['kitchen'], keywords: ['counter', 'countertop', 'kitchen units', 'cupboards'],
  size: { w: 2.4, d: 0.62, h: 0.9 }, mount: 'floor',
  options: [{ id: 'drawers', label: 'Drawer above doors', type: 'toggle', default: true }, { ...HANDLE_OPTION }],
  slots: [COUNTER, DOORS, CARCASS, HANDLES],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) { baseRun(kit, w, d, h, String(o.handles), !!o.drawers) },
  plan: ({ w, d }) => {
    const out: PlanShape[] = [rect(0, 0, w, d, 'body', 0, 'counter')]
    const units = Math.max(1, Math.round(w / 0.6))
    for (let i = 1; i < units; i++) out.push(line([-w / 2 + (w / units) * i, d / 2], [-w / 2 + (w / units) * i, d / 2 - 0.08]))
    return out
  }
}

export const wallCabinets: PropDef = {
  id: 'wall-cabinets', name: 'Wall cabinets', category: 'kitchen', rooms: ['kitchen', 'bathroom'], keywords: ['upper cabinets', 'cupboards'],
  size: { w: 2.4, d: 0.35, h: 0.72 }, mount: 'wall', elevation: 1.45,
  options: [{ id: 'glass', label: 'Glass doors', type: 'toggle', default: false }, { ...HANDLE_OPTION }],
  slots: [DOORS, CARCASS, HANDLES, { id: 'glass', label: 'Glass', default: { material: 'glass', colour: '#e8f0f2' } }],
  build(kit, { w, d, h, o }) {
    kit.box('body', [w, h, d - 0.02], [0, h / 2, -0.01])
    const units = Math.max(1, Math.round(w / 0.6))
    if (o.glass) {
      const uw = w / units
      for (let i = 0; i < units; i++) {
        const x = -w / 2 + uw * (i + 0.5)
        kit.box('fronts', [uw - 0.012, 0.06, 0.02], [x, h - 0.04, d / 2 - 0.01])
        kit.box('fronts', [uw - 0.012, 0.06, 0.02], [x, 0.04, d / 2 - 0.01])
        kit.box('fronts', [0.05, h - 0.02, 0.02], [x - uw / 2 + 0.03, h / 2, d / 2 - 0.01])
        kit.box('fronts', [0.05, h - 0.02, 0.02], [x + uw / 2 - 0.03, h / 2, d / 2 - 0.01])
        kit.plane('glass', { w: uw - 0.11, h: h - 0.12 }, [x, h / 2, d / 2 - 0.012], { fit: true })
        handle(kit, 'handles', String(o.handles), x + (i % 2 ? -1 : 1) * (uw / 2 - 0.05), 0.12, d / 2, 0.12, true)
      }
    } else fronts(kit, 'fronts', 'handles', String(o.handles), { w: w - 0.01, h: h - 0.01, y0: 0.005, faceZ: d / 2 - 0.02 }, units, 1, true)
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'hidden')]
}

export const island: PropDef = {
  id: 'island', name: 'Kitchen island', category: 'kitchen', rooms: ['kitchen'], keywords: ['breakfast bar', 'peninsula'],
  size: { w: 1.8, d: 0.95, h: 0.92 }, mount: 'floor',
  options: [{ id: 'overhang', label: 'Seating overhang', type: 'toggle', default: true }, { ...HANDLE_OPTION }],
  slots: [COUNTER, DOORS, CARCASS, HANDLES],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    const over = o.overhang ? 0.3 : 0
    const bodyD = d - over
    kit.box('body', [w - 0.06, 0.1, bodyD - 0.08], [0, 0.05, -over / 2])
    kit.box('body', [w, h - 0.14, bodyD - 0.03], [0, 0.1 + (h - 0.14) / 2, -over / 2 - 0.015])
    kit.box('counter', [w + 0.04, 0.04, d], [0, h - 0.02, 0])
    const units = Math.max(1, Math.round(w / 0.6))
    // Fronts face the kitchen side (back, −z); the seating side (+z) is open.
    for (let i = 0; i < units; i++) {
      const uw = w / units
      const x = -w / 2 + uw * (i + 0.5)
      kit.box('fronts', [uw - 0.012, h - 0.16, 0.018], [x, 0.1 + (h - 0.16) / 2, -d / 2 + 0.009])
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w + 0.04, d, 'body', 0, 'counter'), line([-w / 2, d / 2 - 0.3], [w / 2, d / 2 - 0.3])]
}

export const fridge: PropDef = {
  id: 'fridge', name: 'Fridge', category: 'kitchen', rooms: ['kitchen'], keywords: ['refrigerator', 'freezer'],
  size: { w: 0.7, d: 0.7, h: 1.85 }, mount: 'floor',
  options: [{ id: 'type', label: 'Type', type: 'select', default: 'bottom', choices: [
    { value: 'bottom', label: 'Freezer below' }, { value: 'side', label: 'Side-by-side' }, { value: 'single', label: 'Single door' }, { value: 'retro', label: 'Retro rounded' }] }],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#a7a9ac', roughness: 0.4 } }, { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#d6d8db' } }],
  build(kit, { w, d, h, o }) {
    if (o.type === 'retro') kit.soft('body', [w, h, d], [0, h / 2, 0], 0.08)
    else kit.box('body', [w, h, d], [0, h / 2, 0])
    const z = d / 2
    const bar = (x: number, y: number, len: number) => kit.box('handles', [0.02, len, 0.03], [x, y, z + 0.02], { small: true })
    if (o.type === 'side') {
      kit.box('body', [0.004, h - 0.04, 0.004], [0, h / 2, z + 0.002])
      bar(-0.04, h * 0.6, 0.6); bar(0.04, h * 0.6, 0.6)
    } else if (o.type === 'single') bar(w / 2 - 0.05, h * 0.62, 0.5)
    else {
      kit.box('body', [w - 0.02, 0.006, 0.004], [0, h * 0.38, z + 0.002])
      bar(w / 2 - 0.05, h * 0.68, 0.45); bar(w / 2 - 0.05, h * 0.26, 0.28)
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.02), line([-w / 2 + 0.03, d / 2 - 0.03], [w / 2 - 0.03, d / 2 - 0.03])]
}

export const cooker: PropDef = {
  id: 'cooker', name: 'Cooker / range', category: 'kitchen', rooms: ['kitchen'], keywords: ['oven', 'stove', 'hob', 'range'],
  size: { w: 0.6, d: 0.62, h: 0.92 }, mount: 'floor',
  options: [{ id: 'burners', label: 'Burners', type: 'number', min: 2, max: 6, step: 2, default: 4 }],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#a7a9ac', roughness: 0.4 } }, { id: 'hob', label: 'Hob', default: { material: 'glass', colour: '#121314', opacity: 1, roughness: 0.15 } }, { id: 'door', label: 'Oven door', default: { material: 'glass', colour: '#1c1d1f', opacity: 1, roughness: 0.1 } }],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    kit.box('body', [w, h - 0.01, d], [0, (h - 0.01) / 2, 0])
    kit.box('hob', [w - 0.02, 0.012, d - 0.04], [0, h - 0.006, 0])
    kit.box('door', [w - 0.06, h * 0.45, 0.02], [0, h * 0.35, d / 2 + 0.01])
    kit.box('body', [w - 0.1, 0.02, 0.03], [0, h * 0.62, d / 2 + 0.03], { small: true })
    const n = Number(o.burners)
    const cols = n / 2
    for (let i = 0; i < n; i++) {
      const c = i % cols
      const r = Math.floor(i / cols)
      kit.torus('body', { d: 0.13, thickness: 0.012 }, [-w / 2 + (w / cols) * (c + 0.5), h + 0.006, (r ? 1 : -1) * d * 0.2], { small: true })
    }
    for (let i = 0; i < 4; i++) kit.cylinder('body', { d: 0.04, h: 0.025, sides: 12 }, [-w / 2 + 0.1 + i * ((w - 0.2) / 3), h * 0.88, d / 2 + 0.012], { rot: [90, 0, 0], small: true })
  },
  plan: ({ w, d, o }) => {
    const out: PlanShape[] = [rect(0, 0, w, d, 'body', 0, 'body')]
    const n = Number(o.burners)
    const cols = n / 2
    for (let i = 0; i < n; i++) out.push(circle(-w / 2 + (w / cols) * ((i % cols) + 0.5), (Math.floor(i / cols) ? 1 : -1) * d * 0.2, 0.07, 'line'))
    return out
  }
}

export const cookerHood: PropDef = {
  id: 'cooker-hood', name: 'Cooker hood', category: 'kitchen', rooms: ['kitchen'], keywords: ['extractor', 'range hood', 'chimney hood'],
  size: { w: 0.9, d: 0.5, h: 0.9 }, mount: 'wall', elevation: 1.55,
  options: [],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#a7a9ac', roughness: 0.35 } }],
  build(kit, { w, d, h }) {
    kit.prism('body', [[-w / 2, 0], [w / 2, 0], [w * 0.18, 0.22], [-w * 0.18, 0.22]], d, [0, 0, 0], { rot: [0, 0, 0] })
    kit.box('body', [w * 0.32, h - 0.22, d * 0.6], [0, 0.22 + (h - 0.22) / 2, -d * 0.2])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'hidden')]
}

export const sinkUnit: PropDef = {
  id: 'sink-unit', name: 'Sink unit', category: 'kitchen', rooms: ['kitchen'], keywords: ['sink', 'basin', 'tap', 'faucet'],
  size: { w: 1.0, d: 0.62, h: 0.9 }, mount: 'floor',
  options: [{ id: 'bowls', label: 'Bowls', type: 'number', min: 1, max: 2, step: 1, default: 1 }, { ...HANDLE_OPTION }],
  slots: [COUNTER, DOORS, CARCASS, HANDLES, { id: 'sink', label: 'Sink & tap', default: { material: 'metal', colour: '#d6d8db', roughness: 0.3 } }],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    baseRun(kit, w, d, h, String(o.handles), false)
    const n = Number(o.bowls)
    const bw = Math.min(0.5, (w - 0.2) / n)
    for (let i = 0; i < n; i++) kit.box('sink', [bw, 0.012, 0.4], [(i - (n - 1) / 2) * (bw + 0.04), h + 0.002, 0.03])
    kit.tube('sink', [[0, h, -d / 2 + 0.1], [0, h + 0.3, -d / 2 + 0.1], [0, h + 0.32, -d / 2 + 0.16], [0, h + 0.25, -d / 2 + 0.26]], 0.012, { small: true })
  },
  plan: ({ w, d, o }) => {
    const out: PlanShape[] = [rect(0, 0, w, d, 'body', 0, 'counter')]
    const n = Number(o.bowls)
    const bw = Math.min(0.5, (w - 0.2) / n)
    for (let i = 0; i < n; i++) out.push(rect((i - (n - 1) / 2) * (bw + 0.04), 0.03, bw, 0.4, 'soft', 0.04, 'sink'))
    return out
  }
}

export const dishwasher: PropDef = {
  id: 'dishwasher', name: 'Dishwasher', category: 'kitchen', rooms: ['kitchen'], keywords: ['appliance'],
  size: { w: 0.6, d: 0.6, h: 0.86 }, mount: 'floor', options: [],
  slots: [{ id: 'body', label: 'Front', default: { material: 'metal', colour: '#a7a9ac', roughness: 0.4 } }],
  build(kit, { w, d, h }) {
    kit.box('body', [w, h, d], [0, h / 2, 0])
    kit.box('body', [w * 0.6, 0.02, 0.03], [0, h - 0.08, d / 2 + 0.015], { small: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d)]
}

export const barStool: PropDef = {
  id: 'bar-stool', name: 'Bar stool', category: 'kitchen', rooms: ['kitchen', 'dining'], keywords: ['stool', 'counter stool'],
  size: { w: 0.42, d: 0.42, h: 0.75 }, mount: 'floor',
  options: [{ id: 'back', label: 'Backrest', type: 'toggle', default: false }],
  slots: [{ id: 'seat', label: 'Seat', default: { material: 'leather', colour: '#a86b3c' } }, { id: 'frame', label: 'Frame', default: { material: 'metal', colour: '#2a2b2d' } }],
  build(kit, { w, h, o }) {
    kit.cylinder('seat', { d: w, h: 0.05, sides: 24 }, [0, h - 0.025, 0])
    kit.cylinder('frame', { d: 0.045, h: h - 0.05, sides: 12 }, [0, (h - 0.05) / 2, 0])
    kit.cylinder('frame', { d: w * 0.9, h: 0.02, sides: 24 }, [0, 0.01, 0])
    kit.torus('frame', { d: w * 0.75, thickness: 0.014 }, [0, h * 0.35, 0], { small: true })
    if (o.back) kit.box('seat', [w * 0.8, 0.22, 0.03], [0, h + 0.17, -w / 2 + 0.03], { rot: [-8, 0, 0] })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'body', 'seat')]
}

export const microwave: PropDef = {
  id: 'microwave', name: 'Microwave', category: 'kitchen', rooms: ['kitchen'], keywords: ['appliance'],
  size: { w: 0.5, d: 0.38, h: 0.3 }, mount: 'surface', options: [],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#a7a9ac' } }, { id: 'door', label: 'Door', default: { material: 'glass', colour: '#1c1d1f', opacity: 1, roughness: 0.1 } }],
  build(kit, { w, d, h }) {
    kit.box('body', [w, h, d], [0, h / 2, 0])
    kit.box('door', [w * 0.72, h - 0.04, 0.01], [-w * 0.12, h / 2, d / 2 + 0.005])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d)]
}

export const kettle: PropDef = {
  id: 'kettle', name: 'Kettle', category: 'kitchen', rooms: ['kitchen'], keywords: ['jug kettle'],
  size: { w: 0.22, d: 0.16, h: 0.25 }, mount: 'surface', options: [],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#d6d8db' } }, { id: 'base', label: 'Base & handle', default: { material: 'plastic', colour: '#202022' } }],
  build(kit, { h }) {
    kit.cylinder('base', { d: 0.17, h: 0.02, sides: 20 }, [0, 0.01, 0])
    kit.lathe('body', [[0, 0], [0.085, 0.005], [0.09, 0.08], [0.075, h - 0.06], [0.05, h - 0.03], [0, h - 0.02]], [0, 0.02, 0], { sides: 22 })
    kit.tube('base', [[-0.07, h * 0.25, 0], [-0.12, h * 0.4, 0], [-0.11, h * 0.8, 0], [-0.05, h * 0.85, 0]], 0.012, { small: true })
  },
  plan: () => [circle(0, 0, 0.09, 'body', 'body')]
}

export const toaster: PropDef = {
  id: 'toaster', name: 'Toaster', category: 'kitchen', rooms: ['kitchen'], keywords: ['appliance'],
  size: { w: 0.3, d: 0.18, h: 0.2 }, mount: 'surface', options: [],
  slots: [{ id: 'body', label: 'Body', default: { material: 'painted', colour: '#efeae0', roughness: 0.3 } }],
  build(kit, { w, d, h }) { kit.soft('body', [w, h, d], [0, h / 2, 0], 0.03) },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.03)]
}

export const potsSet: PropDef = {
  id: 'pots', name: 'Pots & pan', category: 'kitchen', rooms: ['kitchen'], keywords: ['cookware', 'saucepan', 'frying pan'],
  size: { w: 0.6, d: 0.35, h: 0.18 }, mount: 'surface', options: [],
  slots: [{ id: 'metal', label: 'Pots', default: { material: 'metal', colour: '#a7a9ac' } }, { id: 'handles', label: 'Handles', default: { material: 'plastic', colour: '#202022' } }],
  build(kit, { h }) {
    kit.lathe('metal', [[0, 0], [0.11, 0], [0.11, h], [0.105, h]], [-0.15, 0, -0.03], { sides: 24 })
    kit.box('handles', [0.14, 0.02, 0.025], [-0.15 + 0.17, h * 0.8, -0.03], { small: true })
    kit.lathe('metal', [[0, 0], [0.13, 0], [0.135, 0.05], [0.13, 0.05]], [0.15, 0, 0.04], { sides: 24 })
    kit.box('handles', [0.2, 0.02, 0.025], [0.15 + 0.23, 0.045, 0.04], { small: true })
  },
  plan: () => [circle(-0.15, -0.03, 0.11, 'body'), circle(0.15, 0.04, 0.13, 'body')]
}

export const fruitBowl: PropDef = {
  id: 'fruit-bowl', name: 'Fruit bowl', category: 'kitchen', rooms: ['kitchen', 'dining'], keywords: ['bowl', 'fruit', 'apples', 'oranges'],
  size: { w: 0.32, d: 0.32, h: 0.14 }, mount: 'surface', options: [],
  slots: [{ id: 'bowl', label: 'Bowl', default: { material: 'ceramic', colour: '#f2f1ec' } }, { id: 'fruit1', label: 'Fruit (1)', default: { material: 'plant', colour: '#c0392b', roughness: 0.35 } }, { id: 'fruit2', label: 'Fruit (2)', default: { material: 'plant', colour: '#e67e22', roughness: 0.45 } }],
  build(kit, { w }) {
    const r = w / 2
    kit.lathe('bowl', [[0, 0], [r * 0.45, 0], [r * 0.8, 0.05], [r, 0.09], [r * 0.96, 0.09], [r * 0.76, 0.05], [0, 0.015]], [0, 0, 0], { sides: 28 })
    const spots: Array<[number, number, number, string]> = [[-0.06, 0.08, 0.02, 'fruit1'], [0.06, 0.08, -0.03, 'fruit2'], [0, 0.09, 0.07, 'fruit2'], [0.02, 0.13, 0.0, 'fruit1'], [-0.05, 0.08, -0.07, 'fruit1']]
    spots.forEach(([x, y, z, slot]) => kit.sphere(slot, [0.075, 0.07, 0.075], [x * (w / 0.32), y, z * (w / 0.32)], { segments: 10, small: true }))
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'body', 'bowl'), circle(-0.05, 0.02, 0.035, 'soft', 'fruit1'), circle(0.05, -0.03, 0.035, 'soft', 'fruit2')]
}

export const KITCHEN: PropDef[] = [baseCabinets, wallCabinets, island, fridge, cooker, cookerHood, sinkUnit, dishwasher, barStool, microwave, kettle, toaster, potsSet, fruitBowl]
