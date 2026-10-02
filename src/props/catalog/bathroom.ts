import { PlanShape, PropDef } from '../types'
import { circle, fronts, HANDLE_OPTION, line, rect } from './parts'

// Bathroom.

const CHROME = { material: 'metal' as const, colour: '#d6d8db', roughness: 0.2 }
const PORCELAIN = { material: 'ceramic' as const, colour: '#f2f1ec', roughness: 0.15 }

export const bathtub: PropDef = {
  id: 'bathtub', name: 'Bathtub', category: 'bathroom', rooms: ['bathroom'], keywords: ['bath', 'tub', 'clawfoot'],
  size: { w: 1.7, d: 0.75, h: 0.58 }, mount: 'floor',
  options: [{ id: 'style', label: 'Style', type: 'select', default: 'built-in', choices: [
    { value: 'built-in', label: 'Built-in (panelled)' }, { value: 'freestanding', label: 'Freestanding' }, { value: 'clawfoot', label: 'Clawfoot' }] }],
  slots: [{ id: 'tub', label: 'Tub', default: PORCELAIN }, { id: 'panel', label: 'Panel / feet', default: { material: 'painted', colour: '#efeae0' } }, { id: 'taps', label: 'Taps', default: CHROME }],
  build(kit, { w, d, h, o }) {
    if (o.style === 'built-in') {
      kit.box('panel', [w, h - 0.04, d], [0, (h - 0.04) / 2, 0])
      kit.box('tub', [w, 0.04, d], [0, h - 0.02, 0])
    } else {
      const lift = o.style === 'clawfoot' ? 0.12 : 0
      kit.soft('tub', [w, h - lift, d], [0, lift + (h - lift) / 2, 0], Math.min(0.2, d * 0.3))
      if (o.style === 'clawfoot') [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz]) => kit.sphere('panel', [0.07, 0.14, 0.07], [sx * (w / 2 - 0.15), 0.07, sz * (d / 2 - 0.1)], { small: true }))
    }
    // Water / inside: a darker inset reads as the hollow.
    kit.soft('tub', [w - 0.12, 0.02, d - 0.12], [0, h - 0.005, 0], 0.01)
    kit.tube('taps', [[w / 2 - 0.08, h, -d / 2 + 0.06], [w / 2 - 0.08, h + 0.12, -d / 2 + 0.06], [w / 2 - 0.08, h + 0.14, -d / 2 + 0.14]], 0.012, { small: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.04, 'tub'), rect(0, 0, w - 0.14, d - 0.14, 'soft', 0.12, 'tub'), circle(w / 2 - 0.1, 0, 0.02, 'line')]
}

export const shower: PropDef = {
  id: 'shower', name: 'Shower', category: 'bathroom', rooms: ['bathroom'], keywords: ['shower tray', 'enclosure', 'walk-in'],
  size: { w: 0.9, d: 0.9, h: 2.0 }, mount: 'floor',
  options: [{ id: 'screen', label: 'Glass', type: 'select', default: 'corner', choices: [
    { value: 'corner', label: 'Corner enclosure' }, { value: 'walk-in', label: 'Walk-in panel' }, { value: 'none', label: 'No glass' }] }],
  slots: [{ id: 'tray', label: 'Tray', default: PORCELAIN }, { id: 'glass', label: 'Glass', default: { material: 'glass', colour: '#e8f0f2' } }, { id: 'fittings', label: 'Fittings', default: CHROME }],
  build(kit, { w, d, h, o }) {
    kit.box('tray', [w, 0.05, d], [0, 0.025, 0])
    if (o.screen === 'corner') {
      kit.plane('glass', { w, h: h - 0.05 }, [0, 0.05 + (h - 0.05) / 2, d / 2], { fit: true, doubleSided: true })
      kit.plane('glass', { w: d, h: h - 0.05 }, [w / 2, 0.05 + (h - 0.05) / 2, 0], { fit: true, doubleSided: true, rot: [0, 90, 0] })
      kit.box('fittings', [w, 0.02, 0.02], [0, h, d / 2], { small: true })
    } else if (o.screen === 'walk-in') {
      kit.plane('glass', { w: w * 0.7, h: h - 0.05 }, [-w * 0.15, 0.05 + (h - 0.05) / 2, d / 2], { fit: true, doubleSided: true })
      kit.cylinder('fittings', { d: 0.015, h: d / 2, sides: 8 }, [w * 0.2, h, d / 4], { rot: [90, 0, 0], small: true })
    }
    kit.cylinder('fittings', { d: 0.02, h: h - 0.25, sides: 8 }, [0, 0.05 + (h - 0.25) / 2 + 0.2, -d / 2 + 0.04], { small: true })
    kit.cylinder('fittings', { d: 0.22, h: 0.015, sides: 24 }, [0, h - 0.05, -d / 2 + 0.16], { small: true })
    kit.box('fittings', [0.02, 0.02, 0.14], [0, h - 0.04, -d / 2 + 0.09], { small: true })
  },
  plan: ({ w, d, o }) => {
    const out: PlanShape[] = [rect(0, 0, w, d, 'body', 0, 'tray'), line([-w / 2, -d / 2], [w / 2, d / 2]), line([w / 2, -d / 2], [-w / 2, d / 2])]
    if (o.screen === 'corner') out.push({ t: 'path', pts: [[-w / 2, d / 2], [w / 2, d / 2], [w / 2, -d / 2]], cls: 'glass' })
    if (o.screen === 'walk-in') out.push({ t: 'path', pts: [[-w / 2, d / 2], [w * 0.2, d / 2]], cls: 'glass' })
    return out
  }
}

export const toilet: PropDef = {
  id: 'toilet', name: 'Toilet', category: 'bathroom', rooms: ['bathroom'], keywords: ['wc', 'loo', 'lavatory'],
  size: { w: 0.38, d: 0.66, h: 0.8 }, mount: 'floor', options: [],
  slots: [{ id: 'body', label: 'Porcelain', default: PORCELAIN }, { id: 'seat', label: 'Seat', default: { material: 'plastic', colour: '#f2f2f0' } }],
  build(kit, { w, d, h }) {
    kit.lathe('body', [[0.1, 0], [0.13, 0.05], [0.12, 0.25], [0.18, 0.38], [0.17, 0.4]], [0, 0, 0.06], { sides: 24, scale: [w / 0.38, 1, 1.25] })
    kit.soft('seat', [w * 0.95, 0.03, 0.46], [0, 0.415, 0.06], 0.012)
    kit.box('body', [w * 0.9, h - 0.4, 0.17], [0, 0.4 + (h - 0.4) / 2, -d / 2 + 0.085])
    kit.box('body', [w * 0.95, 0.025, 0.19], [0, h - 0.012, -d / 2 + 0.085])
  },
  plan: ({ w, d }) => [rect(0, -d / 2 + 0.085, w * 0.95, 0.19, 'body', 0.02, 'body'), { t: 'ellipse', x: 0, z: 0.07, rx: w / 2 - 0.02, rz: 0.24, cls: 'body', tint: 'body' }]
}

export const vanity: PropDef = {
  id: 'vanity', name: 'Vanity basin', category: 'bathroom', rooms: ['bathroom'], keywords: ['sink', 'basin', 'washbasin', 'vanity unit'],
  size: { w: 0.8, d: 0.46, h: 0.85 }, mount: 'floor',
  options: [{ id: 'mount', label: 'Mounting', type: 'select', default: 'floor', choices: [{ value: 'floor', label: 'Floor-standing' }, { value: 'wall', label: 'Wall-hung' }, { value: 'pedestal', label: 'Pedestal (no cabinet)' }] }, { ...HANDLE_OPTION }],
  slots: [{ id: 'basin', label: 'Basin', default: PORCELAIN }, { id: 'cabinet', label: 'Cabinet', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } }, { id: 'taps', label: 'Tap', default: CHROME }, { id: 'handles', label: 'Handles', default: CHROME }],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    if (o.mount === 'pedestal') {
      kit.lathe('basin', [[0.08, 0], [0.06, 0.1], [0.06, h - 0.2], [0.1, h - 0.12]], [0, 0, -0.05], { sides: 20 })
      kit.soft('basin', [Math.min(w, 0.6), 0.14, d], [0, h - 0.07, 0], 0.05)
    } else {
      const bottom = o.mount === 'wall' ? 0.3 : 0.08
      if (o.mount === 'floor') kit.box('cabinet', [w - 0.04, 0.08, d - 0.04], [0, 0.04, -0.02])
      kit.box('cabinet', [w, h - bottom - 0.04, d - 0.02], [0, bottom + (h - bottom - 0.04) / 2, -0.01])
      fronts(kit, 'cabinet', 'handles', String(o.handles), { w: w - 0.02, h: h - bottom - 0.06, y0: bottom + 0.01, faceZ: d / 2 - 0.02 }, w > 0.7 ? 2 : 1, 1, true)
      kit.box('basin', [w, 0.04, d], [0, h - 0.02, 0])
    }
    kit.soft('basin', [Math.min(w - 0.12, 0.5), 0.012, d - 0.16], [0, h + 0.001, 0.03], 0.05)
    kit.tube('taps', [[0, h, -d / 2 + 0.07], [0, h + 0.18, -d / 2 + 0.07], [0, h + 0.19, -d / 2 + 0.16]], 0.01, { small: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.01, 'basin'), { t: 'ellipse', x: 0, z: 0.03, rx: Math.min(w - 0.12, 0.5) / 2, rz: (d - 0.16) / 2, cls: 'soft', tint: 'basin' }]
}

export const mirrorCabinet: PropDef = {
  id: 'mirror-cabinet', name: 'Mirror cabinet', category: 'bathroom', rooms: ['bathroom'], keywords: ['medicine cabinet', 'mirror'],
  size: { w: 0.6, d: 0.14, h: 0.7 }, mount: 'wall', elevation: 1.2, options: [],
  slots: [{ id: 'body', label: 'Body', default: { material: 'painted', colour: '#efeae0' } }, { id: 'glass', label: 'Mirror', default: { material: 'mirror', colour: '#e4e7ea' } }],
  build(kit, { w, d, h }) {
    kit.box('body', [w, h, d - 0.01], [0, h / 2, -0.005])
    kit.plane('glass', { w: w - 0.02, h: h - 0.02 }, [0, h / 2, d / 2 + 0.001], { fit: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'hidden')]
}

export const towelRail: PropDef = {
  id: 'towel-rail', name: 'Towel rail', category: 'bathroom', rooms: ['bathroom'], keywords: ['towel', 'heated rail', 'radiator'],
  size: { w: 0.6, d: 0.1, h: 0.9 }, mount: 'wall', elevation: 0.3,
  options: [{ id: 'towels', label: 'Towels', type: 'number', min: 0, max: 3, step: 1, default: 2 }],
  slots: [{ id: 'rail', label: 'Rail', default: CHROME }, { id: 'towel', label: 'Towels', default: { material: 'fabric', colour: '#f1eee8', pattern: 'boucle', colour2: '#e2dcd0', scale: 0.1 } }],
  build(kit, { w, d, h, o }) {
    [-1, 1].forEach(s => kit.cylinder('rail', { d: 0.025, h, sides: 10 }, [s * (w / 2 - 0.02), h / 2, 0]))
    const bars = 6
    for (let i = 0; i < bars; i++) kit.cylinder('rail', { d: 0.018, h: w - 0.04, sides: 8 }, [0, 0.06 + (i / (bars - 1)) * (h - 0.1), 0.01], { rot: [0, 0, 90], small: true })
    const n = Number(o.towels)
    for (let i = 0; i < n; i++) kit.soft('towel', [(w - 0.1) / Math.max(1, n) - 0.02, h * 0.45, 0.05], [-(w - 0.1) / 2 + ((w - 0.1) / n) * (i + 0.5), h * 0.62 - i * 0.05, d / 2], 0.02)
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'hidden')]
}

export const bathMat: PropDef = {
  id: 'bath-mat', name: 'Bath mat', category: 'bathroom', rooms: ['bathroom'], keywords: ['mat', 'rug'],
  size: { w: 0.8, d: 0.5, h: 0.012 }, mount: 'floor', options: [],
  slots: [{ id: 'mat', label: 'Mat', default: { material: 'fabric', colour: '#d8cdb8', pattern: 'boucle', colour2: '#c4b8a1', scale: 0.12 } }],
  build(kit, { w, d, h }) { kit.soft('mat', [w, h, d], [0, h / 2, 0], 0.005) },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'soft', 0.04, 'mat')]
}

export const BATHROOM: PropDef[] = [bathtub, shower, toilet, vanity, mirrorCabinet, towelRail, bathMat]
