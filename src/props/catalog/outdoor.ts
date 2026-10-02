import { PlanShape, PropDef } from '../types'
import { circle, rect } from './parts'

// Outdoor / patio.

export const patioSet: PropDef = {
  id: 'patio-set', name: 'Patio table & chairs', category: 'outdoor', rooms: ['outdoor'], keywords: ['garden furniture', 'bistro set', 'terrace'],
  size: { w: 1.0, d: 1.0, h: 0.74 }, mount: 'floor',
  options: [{ id: 'chairs', label: 'Chairs', type: 'number', min: 0, max: 6, step: 1, default: 4 }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'metal', colour: '#2a2b2d', roughness: 0.5 } }, { id: 'top', label: 'Table top', default: { material: 'wood', colour: '#a0703d', colour2: '#825829' } }, { id: 'seat', label: 'Seat pads', default: { material: 'fabric', colour: '#d8cdb8' } }],
  build(kit, { w, d, h, o }) {
    const r = Math.min(w, d) * 0.36
    kit.cylinder('top', { d: r * 2, h: 0.03, sides: 32 }, [0, h - 0.015, 0])
    kit.cylinder('frame', { d: 0.05, h: h - 0.03, sides: 10 }, [0, (h - 0.03) / 2, 0])
    kit.cylinder('frame', { d: r * 1.1, h: 0.02, sides: 24 }, [0, 0.01, 0])
    const n = Number(o.chairs)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const x = Math.sin(a) * (r + 0.25)
      const z = Math.cos(a) * (r + 0.25)
      const deg = (a * 180) / Math.PI + 180
      kit.soft('seat', [0.42, 0.05, 0.42], [x, 0.45, z], 0.02, { rot: [0, deg, 0] })
      ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => {
        const lx = x + (sx * 0.18) * Math.cos(a) + (sz * 0.18) * Math.sin(a)
        const lz = z - (sx * 0.18) * Math.sin(a) + (sz * 0.18) * Math.cos(a)
        kit.cylinder('frame', { d: 0.025, h: 0.43, sides: 6 }, [lx, 0.215, lz], { small: true })
      })
      kit.box('frame', [0.42, 0.35, 0.02], [x - Math.sin(a) * 0.2, 0.65, z - Math.cos(a) * 0.2], { rot: [0, deg, 0] })
    }
  },
  plan: ({ w, d, o }) => {
    const r = Math.min(w, d) * 0.36
    const out: PlanShape[] = []
    const n = Number(o.chairs)
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      out.push({ t: 'rect', x: Math.sin(a) * (r + 0.25), z: Math.cos(a) * (r + 0.25), w: 0.42, d: 0.42, r: 0.04, rot: (a * 180) / Math.PI + 180, cls: 'soft', tint: 'seat' })
    }
    out.push(circle(0, 0, r, 'body', 'top'))
    return out
  }
}

export const lounger: PropDef = {
  id: 'sun-lounger', name: 'Sun lounger', category: 'outdoor', rooms: ['outdoor'], keywords: ['daybed', 'deck chair', 'pool'],
  size: { w: 0.7, d: 1.95, h: 0.35 }, mount: 'floor',
  options: [{ id: 'back', label: 'Back', type: 'select', default: 'reclined', choices: [{ value: 'flat', label: 'Flat' }, { value: 'reclined', label: 'Reclined' }, { value: 'upright', label: 'Upright' }] }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#a0703d', colour2: '#825829' } }, { id: 'cushion', label: 'Cushion', default: { material: 'fabric', colour: '#f1eee8', pattern: 'stripes', colour2: '#33456b', scale: 0.25 } }],
  build(kit, { w, d, h, o }) {
    kit.box('frame', [w, 0.06, d], [0, h - 0.1, 0])
    ;[[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => kit.box('frame', [0.05, h - 0.1, 0.05], [sx * (w / 2 - 0.04), (h - 0.1) / 2, sz * (d / 2 - 0.06)]))
    const backLen = 0.7
    kit.soft('cushion', [w - 0.06, 0.06, d - backLen], [0, h - 0.04, backLen / 2], 0.02)
    const tilt = o.back === 'flat' ? 0 : o.back === 'reclined' ? 35 : 65
    const t = (tilt * Math.PI) / 180
    kit.soft('cushion', [w - 0.06, 0.06, backLen], [0, h - 0.04 + Math.sin(t) * backLen / 2, -d / 2 + backLen / 2 + (1 - Math.cos(t)) * backLen / 2], 0.02, { rot: [-tilt, 0, 0] })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.03, 'frame'), rect(0, 0, w - 0.06, d - 0.04, 'soft', 0.03, 'cushion')]
}

export const parasol: PropDef = {
  id: 'parasol', name: 'Parasol', category: 'outdoor', rooms: ['outdoor'], keywords: ['umbrella', 'sunshade'],
  size: { w: 2.5, d: 2.5, h: 2.4 }, mount: 'floor',
  options: [{ id: 'open', label: 'Open', type: 'toggle', default: true }],
  slots: [{ id: 'canopy', label: 'Canopy', default: { material: 'fabric', colour: '#efeae0' } }, { id: 'pole', label: 'Pole & base', default: { material: 'wood', colour: '#a0703d', colour2: '#825829' } }],
  build(kit, { w, h, o }) {
    kit.cylinder('pole', { d: 0.4, h: 0.08, sides: 20 }, [0, 0.04, 0])
    kit.cylinder('pole', { d: 0.04, h, sides: 10 }, [0, h / 2, 0])
    if (o.open) kit.lathe('canopy', [[w / 2, 0], [w * 0.35, 0.18], [0.03, 0.4]], [0, h - 0.45, 0], { sides: 8 })
    else kit.lathe('canopy', [[0.03, 0], [0.09, 0.2], [0.06, 1.0], [0.02, 1.2]], [0, h - 1.4, 0], { sides: 8 })
  },
  plan: ({ w, o }) => [o.open ? circle(0, 0, w / 2, 'hidden') : circle(0, 0, 0.1, 'body', 'canopy'), circle(0, 0, 0.2, 'line')]
}

export const planter: PropDef = {
  id: 'planter', name: 'Planter box', category: 'outdoor', rooms: ['outdoor', 'living'], keywords: ['trough', 'garden', 'hedge', 'shrubs'],
  size: { w: 0.9, d: 0.4, h: 0.45 }, mount: 'floor', options: [],
  slots: [{ id: 'box', label: 'Planter', default: { material: 'concrete', colour: '#9a9893' } }, { id: 'leaves', label: 'Plants', default: { material: 'plant', colour: '#4f7a3a' } }],
  build(kit, { w, d, h }) {
    kit.box('box', [w, h, d], [0, h / 2, 0])
    kit.foliage('leaves', { w: w * 0.9, h: 0.35, d: d * 0.9 }, [0, h + 0.15, 0], { count: Math.round(w * 40), leaf: 0.14, seed: 3 })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'box'), rect(0, 0, w * 0.9, d * 0.8, 'soft', 0.1, 'leaves')]
}

export const bbq: PropDef = {
  id: 'bbq', name: 'Barbecue', category: 'outdoor', rooms: ['outdoor'], keywords: ['grill', 'braai', 'kettle grill'],
  size: { w: 0.6, d: 0.6, h: 1.0 }, mount: 'floor', options: [],
  slots: [{ id: 'body', label: 'Kettle', default: { material: 'metal', colour: '#202022', roughness: 0.5 } }],
  build(kit, { w, h }) {
    const r = w / 2
    kit.sphere('body', [w, w * 0.9, w], [0, h - r * 0.9, 0])
    ;[0, 1, 2].forEach(i => {
      const a = (i / 3) * Math.PI * 2
      kit.cylinder('body', { d: 0.025, h: h - r, sides: 8 }, [Math.sin(a) * r * 0.6, (h - r) / 2, Math.cos(a) * r * 0.6], { rot: [Math.cos(a) * 12, 0, -Math.sin(a) * 12], small: true })
    })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'body', 'body')]
}

export const OUTDOOR: PropDef[] = [patioSet, lounger, parasol, planter, bbq]
