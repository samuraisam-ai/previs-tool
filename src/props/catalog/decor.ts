import { PlanShape, PropDef } from '../types'
import { circle, rect } from './parts'

// Decor & art (and the plants & flowers section).

export const framedPhoto: PropDef = {
  id: 'photo-frame', name: 'Photo frame', category: 'decor', rooms: ['bedroom', 'living', 'office', 'hallway'], keywords: ['picture', 'photo', 'frame'],
  size: { w: 0.2, d: 0.12, h: 0.25 }, mount: 'surface', imageSlot: 'photo', fitImage: true,
  options: [{ id: 'stand', label: 'Standing (on a surface)', type: 'toggle', default: true }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'metal', colour: '#c9a04f' } }, { id: 'photo', label: 'Photo', default: { material: 'paper', colour: '#8a9aa8', pattern: 'geometric', colour2: '#d9c9a8', scale: 0.2 } }],
  build(kit, { w, h, o }) {
    const tilt = o.stand ? -12 : 0
    const z = o.stand ? 0.02 : 0
    kit.box('frame', [w, h, 0.015], [0, h / 2, z], { rot: [tilt, 0, 0] })
    kit.plane('photo', { w: w - 0.03, h: h - 0.03 }, [0, h / 2, z + 0.009 * Math.cos((tilt * Math.PI) / 180)], { fit: true, rot: [tilt, 0, 0] })
    if (o.stand) kit.box('frame', [0.02, h * 0.8, 0.008], [0, h * 0.4, -0.04], { rot: [25, 0, 0], small: true })
  },
  plan: ({ w }) => [rect(0, 0.02, w, 0.02, 'body', 0, 'frame')]
}

export const poster: PropDef = {
  id: 'poster', name: 'Poster / print', category: 'decor', rooms: ['bedroom', 'living', 'office', 'hallway', 'kitchen'], keywords: ['print', 'art', 'film poster'],
  size: { w: 0.5, d: 0.012, h: 0.7 }, mount: 'wall', elevation: 1.2, imageSlot: 'print', fitImage: true,
  options: [{ id: 'frame', label: 'Frame', type: 'select', default: 'thin', choices: [{ value: 'thin', label: 'Thin frame' }, { value: 'clip', label: 'Clip frame' }, { value: 'none', label: 'Taped up' }] }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'painted', colour: '#202022' } }, { id: 'print', label: 'Print', default: { material: 'paper', colour: '#e6d8bf', pattern: 'floral', colour2: '#b5654a', scale: 0.4 } }],
  build(kit, { w, d, h, o }) {
    kit.plane('print', { w: w - (o.frame === 'thin' ? 0.03 : 0), h: h - (o.frame === 'thin' ? 0.03 : 0) }, [0, h / 2, d / 2 + 0.001], { fit: true })
    if (o.frame === 'thin') {
      kit.box('frame', [0.015, h, d], [-w / 2 + 0.0075, h / 2, 0]); kit.box('frame', [0.015, h, d], [w / 2 - 0.0075, h / 2, 0])
      kit.box('frame', [w, 0.015, d], [0, 0.0075, 0]); kit.box('frame', [w, 0.015, d], [0, h - 0.0075, 0])
    }
    if (o.frame === 'clip') [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => kit.box('frame', [0.03, 0.03, 0.006], [sx * (w / 2 - 0.02), h / 2 + sy * (h / 2 - 0.02), d / 2 + 0.004], { small: true }))
    kit.box('frame', [w, h, 0.004], [0, h / 2, -d / 2 + 0.002])
  },
  plan: ({ w, d }) => [rect(0, 0, w, Math.max(d, 0.02), 'body', 0, 'print')]
}

export const wallMirror: PropDef = {
  id: 'wall-mirror', name: 'Wall mirror', category: 'decor', rooms: ['bedroom', 'living', 'bathroom', 'hallway'], keywords: ['mirror', 'round mirror'],
  size: { w: 0.7, d: 0.04, h: 0.7 }, mount: 'wall', elevation: 1.2,
  options: [{ id: 'shape', label: 'Shape', type: 'select', default: 'round', choices: [{ value: 'round', label: 'Round' }, { value: 'rect', label: 'Rectangle' }] }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'metal', colour: '#c9a04f' } }, { id: 'glass', label: 'Mirror', default: { material: 'mirror', colour: '#e4e7ea' } }],
  build(kit, { w, d, h, o }) {
    if (o.shape === 'round') {
      kit.cylinder('glass', { d: 1, h: 0.008, sides: 40 }, [0, h / 2, d / 2 - 0.004], { rot: [90, 0, 0], scale: [w - 0.04, 1, h - 0.04] })
      kit.torus('frame', { d: 1, thickness: 0.035 }, [0, h / 2, 0], { rot: [90, 0, 0], scale: [w - 0.02, 1, h - 0.02] })
    } else {
      kit.plane('glass', { w: w - 0.05, h: h - 0.05 }, [0, h / 2, d / 2 + 0.001], { fit: true })
      kit.box('frame', [0.025, h, d], [-w / 2 + 0.0125, h / 2, 0]); kit.box('frame', [0.025, h, d], [w / 2 - 0.0125, h / 2, 0])
      kit.box('frame', [w, 0.025, d], [0, 0.0125, 0]); kit.box('frame', [w, 0.025, d], [0, h - 0.0125, 0])
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, Math.max(d, 0.03), 'glass')]
}

export const curtains: PropDef = {
  id: 'curtains', name: 'Curtains', category: 'decor', rooms: ['bedroom', 'living', 'dining', 'office'], keywords: ['drapes', 'blinds', 'window dressing'],
  size: { w: 1.8, d: 0.14, h: 2.45 }, mount: 'wall',
  options: [
    { id: 'state', label: 'Drawn', type: 'select', default: 'open', choices: [{ value: 'open', label: 'Open' }, { value: 'half', label: 'Half drawn' }, { value: 'closed', label: 'Closed' }] },
    { id: 'rail', label: 'Pole', type: 'toggle', default: true }
  ],
  slots: [{ id: 'fabric', label: 'Fabric', default: { material: 'fabric', colour: '#d8cdb8' } }, { id: 'rail', label: 'Pole', default: { material: 'metal', colour: '#2a2b2d' } }],
  build(kit, { w, h, o }) {
    if (o.rail) {
      kit.cylinder('rail', { d: 0.025, h: w + 0.2, sides: 10 }, [0, h - 0.03, 0], { rot: [0, 0, 90] })
      ;[-1, 1].forEach(s => kit.sphere('rail', [0.05, 0.05, 0.05], [s * (w / 2 + 0.1), h - 0.03, 0], { small: true }))
    }
    const cover = o.state === 'closed' ? 0.5 : o.state === 'half' ? 0.3 : 0.14
    const panelW = w * cover
    ;[-1, 1].forEach(s => {
      // Folds: a row of soft vertical tubes.
      const folds = Math.max(3, Math.round(panelW / 0.09))
      for (let i = 0; i < folds; i++) {
        const x = s * (w / 2 - panelW + panelW * ((i + 0.5) / folds))
        kit.cylinder('fabric', { d: 0.1, h: h - 0.06, sides: 8 }, [x, (h - 0.06) / 2, (i % 2) * 0.03], { scale: [panelW / folds / 0.1 * 1.25, 1, 0.8] })
      }
    })
  },
  plan: ({ w, d, o }) => {
    const cover = o.state === 'closed' ? 0.5 : o.state === 'half' ? 0.3 : 0.14
    const out: PlanShape[] = [rect(0, 0, w + 0.2, 0.02, 'line')]
    ;[-1, 1].forEach(s => out.push(rect(s * (w / 2 - (w * cover) / 2), 0, w * cover, d, 'soft', 0.03, 'fabric')))
    return out
  }
}

export const cushion: PropDef = {
  id: 'cushion', name: 'Cushion', category: 'decor', rooms: ['living', 'bedroom'], keywords: ['pillow', 'scatter cushion', 'throw pillow'],
  size: { w: 0.45, d: 0.15, h: 0.45 }, mount: 'surface', options: [],
  slots: [{ id: 'cover', label: 'Cover', default: { material: 'velvet', colour: '#b0802c' } }],
  build(kit, { w, d, h }) { kit.soft('cover', [w, h, d], [0, h / 2, 0], Math.min(w, h) * 0.18) },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'soft', 0.04, 'cover')]
}

export const books: PropDef = {
  id: 'books', name: 'Books', category: 'decor', rooms: ['living', 'bedroom', 'office'], keywords: ['book stack', 'magazines', 'coffee table books'],
  size: { w: 0.3, d: 0.22, h: 0.15 }, mount: 'surface',
  options: [{ id: 'layout', label: 'Layout', type: 'select', default: 'stack', choices: [{ value: 'stack', label: 'Stack' }, { value: 'row', label: 'Row (standing)' }] }, { id: 'count', label: 'Books', type: 'number', min: 1, max: 12, step: 1, default: 4 }],
  slots: [{ id: 'b0', label: 'Book colour (1)', default: { material: 'paper', colour: '#7a2e2a' } }, { id: 'b1', label: 'Book colour (2)', default: { material: 'paper', colour: '#d8cdb8' } }, { id: 'b2', label: 'Book colour (3)', default: { material: 'paper', colour: '#2f3b55' } }],
  build(kit, { w, d, h, o }) {
    const n = Number(o.count)
    if (o.layout === 'stack') {
      let y = 0
      for (let i = 0; i < n; i++) {
        const t = Math.min(0.05, h / n)
        kit.box(`b${i % 3}`, [w * (0.8 + ((i * 37) % 20) / 100), t, d * (0.85 + ((i * 53) % 15) / 100)], [((i * 13) % 5 - 2) * 0.006, y + t / 2, 0], { rot: [0, ((i * 29) % 11) - 5, 0] })
        y += t
      }
    } else {
      const bw = w / n
      for (let i = 0; i < n; i++) kit.box(`b${i % 3}`, [bw - 0.003, h * (0.75 + ((i * 41) % 25) / 100), d], [-w / 2 + bw * (i + 0.5), (h * (0.75 + ((i * 41) % 25) / 100)) / 2, 0])
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'b0')]
}

export const vase: PropDef = {
  id: 'vase', name: 'Vase', category: 'decor', rooms: ['living', 'bedroom', 'dining', 'hallway'], keywords: ['pot', 'urn', 'jar', 'bottle'],
  size: { w: 0.18, d: 0.18, h: 0.35 }, mount: 'surface',
  options: [{ id: 'shape', label: 'Shape', type: 'select', default: 'bottle', choices: [
    { value: 'bottle', label: 'Bottle' }, { value: 'amphora', label: 'Amphora' }, { value: 'cylinder', label: 'Cylinder' }, { value: 'bowl', label: 'Low bowl' }, { value: 'bud', label: 'Bud vase' }] }],
  slots: [{ id: 'body', label: 'Vase', default: { material: 'ceramic', colour: '#a9c2ad' } }],
  build(kit, { w, d, h, o }) {
    const profiles: { [k: string]: Array<[number, number]> } = {
      bottle: [[0, 0], [0.42, 0], [0.5, 0.15], [0.5, 0.5], [0.3, 0.68], [0.14, 0.8], [0.14, 1], [0.12, 1]],
      amphora: [[0, 0], [0.25, 0], [0.4, 0.2], [0.5, 0.45], [0.38, 0.75], [0.22, 0.88], [0.28, 1], [0.25, 1]],
      cylinder: [[0, 0], [0.5, 0], [0.5, 1], [0.46, 1]],
      bowl: [[0, 0], [0.3, 0], [0.48, 0.5], [0.5, 1], [0.46, 1]],
      bud: [[0, 0], [0.4, 0], [0.5, 0.25], [0.3, 0.55], [0.12, 0.75], [0.14, 1], [0.1, 1]]
    }
    kit.lathe('body', profiles[String(o.shape)] ?? profiles.bottle, [0, 0, 0], { sides: 24, scale: [w, h, d] })
  },
  plan: ({ w, d }) => [{ t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'body' }]
}

export const wallClock: PropDef = {
  id: 'wall-clock', name: 'Wall clock', category: 'decor', rooms: ['kitchen', 'living', 'office', 'hallway'], keywords: ['clock'],
  size: { w: 0.35, d: 0.05, h: 0.35 }, mount: 'wall', elevation: 1.75, options: [],
  slots: [{ id: 'rim', label: 'Rim', default: { material: 'wood', colour: '#2a2522', colour2: '#1c1816' } }, { id: 'face', label: 'Face', default: { material: 'paper', colour: '#f7f6f2' } }, { id: 'hands', label: 'Hands', default: { material: 'metal', colour: '#202022' } }],
  build(kit, { w, d, h }) {
    kit.cylinder('rim', { d: 1, h: d, sides: 40 }, [0, h / 2, 0], { rot: [90, 0, 0], scale: [w, 1, h] })
    kit.cylinder('face', { d: 1, h: 0.004, sides: 40 }, [0, h / 2, d / 2 + 0.001], { rot: [90, 0, 0], scale: [w * 0.88, 1, h * 0.88] })
    kit.box('hands', [0.01, h * 0.32, 0.004], [0.04, h / 2 + 0.05, d / 2 + 0.006], { rot: [0, 0, -40], small: true })
    kit.box('hands', [0.012, h * 0.22, 0.004], [-0.035, h / 2 + 0.03, d / 2 + 0.008], { rot: [0, 0, 60], small: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'rim')]
}

export const candles: PropDef = {
  id: 'candles', name: 'Candles', category: 'decor', rooms: ['living', 'dining', 'bedroom', 'bathroom'], keywords: ['candle', 'pillar candles', 'candlesticks'],
  size: { w: 0.3, d: 0.15, h: 0.22 }, mount: 'surface',
  options: [{ id: 'lit', label: 'Lit', type: 'toggle', default: true }],
  slots: [{ id: 'wax', label: 'Wax', default: { material: 'plastic', colour: '#f1eee8', roughness: 0.6 } }, { id: 'tray', label: 'Tray', default: { material: 'metal', colour: '#c9a04f' } }, { id: 'flame', label: 'Flame', default: { material: 'glow', colour: '#ffcf7a' } }],
  build(kit, { w, d, h, o }) {
    kit.box('tray', [w, 0.01, d], [0, 0.005, 0])
    const set: Array<[number, number, number]> = [[-w * 0.3, 0.07, h], [0, 0.08, h * 0.7], [w * 0.3, 0.07, h * 0.5]]
    set.forEach(([x, dd, hh]) => {
      kit.cylinder('wax', { d: dd, h: hh - 0.03, sides: 16 }, [x, 0.01 + (hh - 0.03) / 2, 0])
      if (o.lit) kit.sphere('flame', [0.012, 0.03, 0.012], [x, hh - 0.005, 0], { small: true, segments: 6 })
    })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'tray'), circle(-w * 0.3, 0, 0.035, 'soft', 'wax'), circle(0, 0, 0.04, 'soft', 'wax'), circle(w * 0.3, 0, 0.035, 'soft', 'wax')]
}

export const sculpture: PropDef = {
  id: 'sculpture', name: 'Sculpture', category: 'decor', rooms: ['living', 'hallway', 'office'], keywords: ['statue', 'bust', 'art object', 'ornament'],
  size: { w: 0.25, d: 0.25, h: 0.45 }, mount: 'surface',
  options: [{ id: 'form', label: 'Form', type: 'select', default: 'bust', choices: [{ value: 'bust', label: 'Bust' }, { value: 'stacked', label: 'Stacked forms' }, { value: 'ring', label: 'Ring' }] }],
  slots: [{ id: 'body', label: 'Material', default: { material: 'stone', colour: '#ecebe8', colour2: '#9fa3a8' } }],
  build(kit, { w, d, h, o }) {
    if (o.form === 'bust') {
      kit.box('body', [w * 0.6, h * 0.12, d * 0.6], [0, h * 0.06, 0])
      kit.sphere('body', [w * 0.75, h * 0.3, d * 0.55], [0, h * 0.27, 0])
      kit.cylinder('body', { d: w * 0.22, h: h * 0.15, sides: 14 }, [0, h * 0.47, 0])
      kit.sphere('body', [w * 0.42, h * 0.4, d * 0.5], [0, h * 0.75, 0.01])
    } else if (o.form === 'stacked') {
      kit.sphere('body', [w, h * 0.35, d], [0, h * 0.17, 0])
      kit.sphere('body', [w * 0.7, h * 0.3, d * 0.7], [w * 0.05, h * 0.47, 0])
      kit.sphere('body', [w * 0.45, h * 0.28, d * 0.45], [-w * 0.03, h * 0.78, 0])
    } else {
      kit.box('body', [w * 0.6, h * 0.1, d * 0.6], [0, h * 0.05, 0])
      kit.torus('body', { d: h * 0.85, thickness: Math.min(w, d) * 0.3 }, [0, h * 0.53, 0], { rot: [90, 0, 0] })
    }
  },
  plan: ({ w, d }) => [{ t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'body' }]
}

// ── Plants & flowers ──────────────────────────────────────────────────────────
const SPECIES: { [k: string]: { leaf: number; count: number; crown: [number, number]; stem: number } } = {
  fiddle: { leaf: 0.22, count: 26, crown: [0.6, 0.55], stem: 0.55 },
  monstera: { leaf: 0.3, count: 18, crown: [0.9, 0.7], stem: 0.2 },
  palm: { leaf: 0.12, count: 60, crown: [1.0, 0.6], stem: 0.4 },
  snake: { leaf: 0.08, count: 18, crown: [0.3, 0.7], stem: 0.0 },
  olive: { leaf: 0.06, count: 120, crown: [0.8, 0.7], stem: 0.8 }
}

export const floorPlant: PropDef = {
  id: 'floor-plant', name: 'Floor plant', category: 'plants', rooms: ['living', 'bedroom', 'office', 'hallway', 'outdoor'], keywords: ['plant', 'tree', 'fiddle leaf fig', 'monstera', 'palm', 'olive', 'snake plant'],
  size: { w: 0.7, d: 0.7, h: 1.6 }, mount: 'floor',
  options: [
    { id: 'species', label: 'Plant', type: 'select', default: 'fiddle', choices: [
      { value: 'fiddle', label: 'Fiddle-leaf fig' }, { value: 'monstera', label: 'Monstera' }, { value: 'palm', label: 'Palm' }, { value: 'snake', label: 'Snake plant' }, { value: 'olive', label: 'Olive tree' }] },
    { id: 'density', label: 'Fullness', type: 'select', default: '1', choices: [{ value: '0.6', label: 'Sparse' }, { value: '1', label: 'Normal' }, { value: '1.5', label: 'Lush' }] },
    { id: 'pot', label: 'Pot', type: 'select', default: 'round', choices: [{ value: 'round', label: 'Round' }, { value: 'tapered', label: 'Tapered' }, { value: 'basket', label: 'Basket' }] }
  ],
  slots: [{ id: 'leaves', label: 'Leaves', default: { material: 'plant', colour: '#3f6a34' } }, { id: 'pot', label: 'Pot', default: { material: 'ceramic', colour: '#f2f1ec' } }, { id: 'stem', label: 'Stem / trunk', default: { material: 'wood', colour: '#6b4f3a', colour2: '#54402f', pattern: 'none' } }],
  build(kit, { w, h, o }) {
    const sp = SPECIES[String(o.species)] ?? SPECIES.fiddle
    const potH = Math.min(0.4, h * 0.25)
    const potD = Math.min(w * 0.55, 0.45)
    if (o.pot === 'basket') kit.lathe('pot', [[0, 0], [potD * 0.42, 0], [potD * 0.5, potH], [potD * 0.47, potH]], [0, 0, 0], { sides: 20 })
    else if (o.pot === 'tapered') kit.lathe('pot', [[0, 0], [potD * 0.32, 0], [potD * 0.5, potH], [potD * 0.46, potH]], [0, 0, 0], { sides: 20 })
    else kit.lathe('pot', [[0, 0], [potD * 0.4, 0], [potD * 0.5, potH * 0.25], [potD * 0.48, potH], [potD * 0.44, potH]], [0, 0, 0], { sides: 20 })
    const crownH = (h - potH) * sp.crown[1]
    const stemTop = h - crownH
    if (sp.stem > 0) kit.cylinder('stem', { dTop: 0.025, dBottom: 0.04, h: stemTop - potH + crownH * 0.4, sides: 8 }, [0, potH + (stemTop - potH + crownH * 0.4) / 2, 0], { small: true })
    const density = Number(o.density)
    if (o.species === 'snake') {
      for (let i = 0; i < Math.round(sp.count * density); i++) {
        const a = i * 2.4
        kit.box('leaves', [0.07, (h - potH) * (0.6 + ((i * 37) % 40) / 100), 0.012], [Math.sin(a) * 0.06, potH + ((h - potH) * 0.4), Math.cos(a) * 0.06], { rot: [((i * 13) % 14) - 7, (a * 180) / Math.PI, ((i * 7) % 12) - 6] })
      }
    } else kit.foliage('leaves', { w: w * sp.crown[0], h: crownH, d: w * sp.crown[0] }, [0, stemTop + crownH / 2, 0], { count: Math.round(sp.count * density * (h / 1.6)), leaf: sp.leaf, seed: String(o.species).length * 17 })
  },
  plan: ({ w, d }) => [{ t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'soft', tint: 'leaves' }, circle(0, 0, Math.min(w * 0.55, 0.45) / 2, 'body', 'pot')]
}

export const pottedPlant: PropDef = {
  id: 'potted-plant', name: 'Potted plant (small)', category: 'plants', rooms: ['living', 'bedroom', 'kitchen', 'office', 'bathroom'], keywords: ['succulent', 'fern', 'pothos', 'houseplant', 'cactus'],
  size: { w: 0.28, d: 0.28, h: 0.4 }, mount: 'surface',
  options: [{ id: 'kind', label: 'Plant', type: 'select', default: 'fern', choices: [{ value: 'fern', label: 'Fern' }, { value: 'pothos', label: 'Trailing pothos' }, { value: 'succulent', label: 'Succulent' }, { value: 'cactus', label: 'Cactus' }] }],
  slots: [{ id: 'leaves', label: 'Leaves', default: { material: 'plant', colour: '#4f7a3a' } }, { id: 'pot', label: 'Pot', default: { material: 'ceramic', colour: '#b5653f' } }],
  build(kit, { w, h, o }) {
    const potH = h * 0.35
    kit.lathe('pot', [[0, 0], [w * 0.3, 0], [w * 0.38, potH], [w * 0.35, potH]], [0, 0, 0], { sides: 20 })
    if (o.kind === 'cactus') {
      kit.lathe('leaves', [[0, 0], [w * 0.16, 0.02], [w * 0.17, (h - potH) * 0.8], [0, h - potH]], [0, potH, 0], { sides: 10 })
      kit.lathe('leaves', [[0, 0], [w * 0.08, 0.01], [w * 0.08, 0.1], [0, 0.14]], [w * 0.14, potH + (h - potH) * 0.35, 0], { sides: 8, rot: [0, 0, -40], small: true })
    } else if (o.kind === 'succulent') {
      for (let i = 0; i < 14; i++) {
        const a = i * 2.4
        const r = 0.02 + (i / 14) * w * 0.25
        kit.sphere('leaves', [0.05, 0.03, 0.1], [Math.sin(a) * r, potH + 0.03 + (1 - i / 14) * 0.06, Math.cos(a) * r], { rot: [-30, (a * 180) / Math.PI, 0], segments: 6, small: true })
      }
    } else if (o.kind === 'pothos') {
      kit.foliage('leaves', { w: w * 0.9, h: 0.15, d: w * 0.9 }, [0, potH + 0.08, 0], { count: 20, leaf: 0.07, seed: 9 })
      kit.foliage('leaves', { w: w * 1.3, h: h * 0.6, d: w * 0.4 }, [w * 0.25, potH - h * 0.2, w * 0.2], { count: 16, leaf: 0.06, seed: 21 })
    } else kit.foliage('leaves', { w: w * 1.2, h: (h - potH) * 0.9, d: w * 1.2 }, [0, potH + (h - potH) * 0.5, 0], { count: 36, leaf: 0.09, seed: 5 })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'soft', 'leaves'), circle(0, 0, w * 0.36, 'body', 'pot')]
}

export const hangingPlant: PropDef = {
  id: 'hanging-plant', name: 'Hanging plant', category: 'plants', rooms: ['living', 'kitchen', 'bathroom', 'outdoor'], keywords: ['trailing', 'macrame', 'basket'],
  size: { w: 0.4, d: 0.4, h: 0.9 }, mount: 'ceiling', elevation: 1.5, options: [],
  slots: [{ id: 'leaves', label: 'Leaves', default: { material: 'plant', colour: '#4f7a3a' } }, { id: 'pot', label: 'Pot', default: { material: 'ceramic', colour: '#f2f1ec' } }, { id: 'cord', label: 'Hanger', default: { material: 'fabric', colour: '#d8cdb8' } }],
  build(kit, { w, h }) {
    kit.lathe('pot', [[0, 0], [w * 0.25, 0], [w * 0.32, 0.18], [w * 0.3, 0.18]], [0, h * 0.3, 0], { sides: 18 })
    ;[0, 1, 2].forEach(i => { const a = (i / 3) * Math.PI * 2; kit.tube('cord', [[Math.sin(a) * w * 0.3, h * 0.3 + 0.18, Math.cos(a) * w * 0.3], [0, h, 0]], 0.004, { small: true }) })
    kit.foliage('leaves', { w: w * 1.1, h: 0.15, d: w * 1.1 }, [0, h * 0.3 + 0.24, 0], { count: 22, leaf: 0.08, seed: 13 })
    kit.foliage('leaves', { w: w * 1.2, h: h * 0.45, d: w * 1.2 }, [0, h * 0.15, 0], { count: 28, leaf: 0.06, seed: 31 })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'hidden')]
}

const BLOOMS: { [k: string]: { size: [number, number, number]; count: number } } = {
  roses: { size: [0.055, 0.05, 0.055], count: 11 }, tulips: { size: [0.04, 0.06, 0.04], count: 9 },
  wild: { size: [0.03, 0.025, 0.03], count: 22 }, sunflowers: { size: [0.12, 0.03, 0.12], count: 5 }, lilies: { size: [0.09, 0.05, 0.09], count: 6 }
}

export const flowers: PropDef = {
  id: 'flowers', name: 'Flowers in a vase', category: 'plants', rooms: ['living', 'dining', 'bedroom', 'kitchen', 'hallway'], keywords: ['bouquet', 'roses', 'tulips', 'sunflowers', 'lilies', 'arrangement'],
  size: { w: 0.35, d: 0.35, h: 0.55 }, mount: 'surface',
  options: [{ id: 'kind', label: 'Flowers', type: 'select', default: 'roses', choices: [
    { value: 'roses', label: 'Roses' }, { value: 'tulips', label: 'Tulips' }, { value: 'wild', label: 'Wildflowers' }, { value: 'sunflowers', label: 'Sunflowers' }, { value: 'lilies', label: 'Lilies' }] }],
  slots: [{ id: 'blooms', label: 'Blooms', default: { material: 'plant', colour: '#c0392b', roughness: 0.6 } }, { id: 'blooms2', label: 'Second colour', default: { material: 'plant', colour: '#f1eee8', roughness: 0.6 } }, { id: 'stems', label: 'Stems & leaves', default: { material: 'plant', colour: '#4f7a3a' } }, { id: 'vase', label: 'Vase', default: { material: 'glass', colour: '#e8f0f2' } }],
  build(kit, { w, h, o }) {
    const vh = h * 0.42
    kit.lathe('vase', [[0, 0], [w * 0.2, 0], [w * 0.22, vh * 0.7], [w * 0.15, vh], [w * 0.14, vh]], [0, 0, 0], { sides: 20 })
    const b = BLOOMS[String(o.kind)] ?? BLOOMS.roses
    for (let i = 0; i < b.count; i++) {
      const a = i * 2.4
      const r = (0.25 + ((i * 37) % 75) / 100) * w * 0.38
      const top = h - ((i * 23) % 30) / 100 * h * 0.3
      const x = Math.sin(a) * r
      const z = Math.cos(a) * r
      kit.tube('stems', [[x * 0.15, vh * 0.3, z * 0.15], [x, top - b.size[1], z]], 0.004, { small: true, sides: 4 })
      kit.sphere(i % 3 === 2 ? 'blooms2' : 'blooms', b.size, [x, top, z], { segments: 8, small: true })
    }
    kit.foliage('stems', { w: w * 0.7, h: h * 0.25, d: w * 0.7 }, [0, vh + h * 0.12, 0], { count: 10, leaf: 0.06, seed: 41 })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'soft', 'blooms'), circle(0, 0, w * 0.2, 'glass')]
}

export const DECOR: PropDef[] = [framedPhoto, poster, wallMirror, curtains, cushion, books, vase, wallClock, candles, sculpture]
export const PLANTS: PropDef[] = [floorPlant, pottedPlant, hangingPlant, flowers]
