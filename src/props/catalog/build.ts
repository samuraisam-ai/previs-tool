import { PropDef, SlotDef } from '../types'
import { circle, line, rect } from './parts'

// Build pieces: generic shapes of any size and finish, plus grip/art-department staples.
// With these a designer can make anything that isn't in the catalogue.

const SURFACE: SlotDef = { id: 'surface', label: 'Surface', default: { material: 'painted', colour: '#c9c6bf' } }

export const box: PropDef = {
  id: 'box', name: 'Box', category: 'build', rooms: [], keywords: ['cube', 'block', 'crate', 'plinth'],
  size: { w: 0.6, d: 0.6, h: 0.6 }, mount: 'floor', options: [{ id: 'rounded', label: 'Rounded edges', type: 'toggle', default: false }], slots: [SURFACE],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) { if (o.rounded) kit.soft('surface', [w, h, d], [0, h / 2, 0], Math.min(w, d, h) * 0.12); else kit.box('surface', [w, h, d], [0, h / 2, 0]) },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'surface')]
}

export const cylinder: PropDef = {
  id: 'cylinder', name: 'Cylinder', category: 'build', rooms: [], keywords: ['column', 'pillar', 'drum', 'tube'],
  size: { w: 0.4, d: 0.4, h: 1.0 }, mount: 'floor', options: [], slots: [SURFACE],
  surfaceTop: p => p.h,
  build(kit, { w, d, h }) { kit.cylinder('surface', { d: 1, h, sides: 32 }, [0, h / 2, 0], { scale: [w, 1, d] }) },
  plan: ({ w, d }) => [{ t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'surface' }]
}

export const sphere: PropDef = {
  id: 'sphere', name: 'Sphere', category: 'build', rooms: [], keywords: ['ball', 'globe', 'orb'],
  size: { w: 0.5, d: 0.5, h: 0.5 }, mount: 'floor', options: [], slots: [SURFACE],
  build(kit, { w, d, h }) { kit.sphere('surface', [w, h, d], [0, h / 2, 0], { segments: 20 }) },
  plan: ({ w, d }) => [{ t: 'ellipse', x: 0, z: 0, rx: w / 2, rz: d / 2, cls: 'body', tint: 'surface' }]
}

export const wedge: PropDef = {
  id: 'wedge', name: 'Wedge / ramp', category: 'build', rooms: [], keywords: ['ramp', 'slope', 'triangle'],
  size: { w: 0.6, d: 1.2, h: 0.4 }, mount: 'floor', options: [], slots: [SURFACE],
  // The slope rises towards the back (−z).
  build(kit, { w, d, h }) { kit.prism('surface', [[-d / 2, 0], [d / 2, 0], [-d / 2, h]], w, [0, 0, 0], { rot: [0, 90, 0] }) },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'surface'), line([-w / 2, -d / 2], [0, d / 2]), line([w / 2, -d / 2], [0, d / 2])]
}

export const panel: PropDef = {
  id: 'panel', name: 'Panel / board', category: 'build', rooms: [], keywords: ['sheet', 'board', 'plywood', 'bounce board', 'flag', 'wall panel'],
  size: { w: 1.2, d: 0.02, h: 2.4 }, mount: 'floor', imageSlot: 'surface', options: [], slots: [SURFACE],
  build(kit, { w, d, h }) {
    kit.box('surface', [w, h, d], [0, h / 2, 0])
    kit.plane('surface', { w, h }, [0, h / 2, d / 2 + 0.001], { fit: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, Math.max(d, 0.02), 'body', 0, 'surface')]
}

export const platform: PropDef = {
  id: 'platform', name: 'Platform / riser', category: 'build', rooms: [], keywords: ['stage', 'rostrum', 'deck', 'riser', '4x8'],
  size: { w: 1.22, d: 2.44, h: 0.3 }, mount: 'floor',
  options: [{ id: 'height', label: 'Height', type: 'select', default: '0.3', choices: [{ value: '0.15', label: '15 cm' }, { value: '0.3', label: '30 cm' }, { value: '0.45', label: '45 cm' }, { value: '0.6', label: '60 cm' }, { value: '0.9', label: '90 cm' }] }],
  slots: [{ id: 'top', label: 'Deck', default: { material: 'wood', colour: '#c9a77c', colour2: '#b08d63' } }, { id: 'skirt', label: 'Skirt', default: { material: 'fabric', colour: '#202022' } }],
  sizeFor: (o, cur, changed) => (changed === 'height' ? { w: cur.w, d: cur.d, h: Number(o.height) } : null),
  surfaceTop: p => p.h,
  build(kit, { w, d, h }) {
    kit.box('top', [w, 0.02, d], [0, h - 0.01, 0])
    kit.box('skirt', [w - 0.02, h - 0.02, d - 0.02], [0, (h - 0.02) / 2, 0])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'top'), line([-w / 2, -d / 2], [w / 2, d / 2])]
}

const APPLE: { [k: string]: number } = { full: 0.2, half: 0.1, quarter: 0.05, pancake: 0.025 }

export const appleBox: PropDef = {
  id: 'apple-box', name: 'Apple box', category: 'build', rooms: [], keywords: ['apple', 'pancake', 'half apple', 'grip'],
  size: { w: 0.51, d: 0.3, h: 0.2 }, mount: 'floor',
  options: [{ id: 'size', label: 'Size', type: 'select', default: 'full', choices: [{ value: 'full', label: 'Full (8″)' }, { value: 'half', label: 'Half (4″)' }, { value: 'quarter', label: 'Quarter (2″)' }, { value: 'pancake', label: 'Pancake (1″)' }] }],
  slots: [{ id: 'wood', label: 'Wood', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } }],
  sizeFor: (o, cur, changed) => (!changed || changed === 'size' ? { w: 0.51, d: 0.3, h: APPLE[String(o.size)] ?? 0.2 } : null),
  surfaceTop: p => p.h,
  build(kit, { w, d, h }) {
    kit.box('wood', [w, h, d], [0, h / 2, 0])
    if (h > 0.08) [-1, 1].forEach(s => kit.box('wood', [0.12, 0.035, 0.012], [0, h * 0.62, s * (d / 2 + 0.002)], { small: true }))
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'wood')]
}

export const flat: PropDef = {
  id: 'flat', name: 'Wall flat', category: 'build', rooms: [], keywords: ['set wall', 'flat', 'scenic', 'backing'],
  size: { w: 1.22, d: 0.08, h: 2.44 }, mount: 'floor', imageSlot: 'face', options: [{ id: 'braces', label: 'Stage braces', type: 'toggle', default: true }],
  slots: [{ id: 'face', label: 'Face', default: { material: 'painted', colour: '#e9e4da' } }, { id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } }],
  build(kit, { w, d, h, o }) {
    kit.box('face', [w, h, 0.012], [0, h / 2, d / 2 - 0.006])
    kit.plane('face', { w, h }, [0, h / 2, d / 2 + 0.001], { fit: true })
    kit.box('frame', [w, 0.07, d - 0.012], [0, 0.035, -0.006]); kit.box('frame', [w, 0.07, d - 0.012], [0, h - 0.035, -0.006])
    kit.box('frame', [0.07, h, d - 0.012], [-w / 2 + 0.035, h / 2, -0.006]); kit.box('frame', [0.07, h, d - 0.012], [w / 2 - 0.035, h / 2, -0.006])
    kit.box('frame', [w, 0.07, d - 0.012], [0, h / 2, -0.006])
    if (o.braces) kit.tube('frame', [[0, h * 0.65, -d / 2], [0, 0, -d / 2 - h * 0.5]], 0.02)
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'face')]
}

export const sandbag: PropDef = {
  id: 'sandbag', name: 'Sandbag', category: 'build', rooms: [], keywords: ['shot bag', 'grip', 'weight'],
  size: { w: 0.45, d: 0.25, h: 0.12 }, mount: 'floor', options: [],
  slots: [{ id: 'bag', label: 'Bag', default: { material: 'fabric', colour: '#c96d2a' } }],
  build(kit, { w, d, h }) {
    kit.soft('bag', [w * 0.48, h, d], [-w * 0.26, h / 2, 0], h * 0.4)
    kit.soft('bag', [w * 0.48, h, d], [w * 0.26, h / 2, 0], h * 0.4)
  },
  plan: ({ w, d }) => [rect(-w * 0.26, 0, w * 0.48, d, 'body', 0.04, 'bag'), rect(w * 0.26, 0, w * 0.48, d, 'body', 0.04, 'bag'), circle(0, 0, 0.01, 'line')]
}

export const BUILD: PropDef[] = [box, cylinder, sphere, wedge, panel, platform, appleBox, flat, sandbag]
