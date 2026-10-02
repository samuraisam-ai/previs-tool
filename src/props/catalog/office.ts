import { PropDef } from '../types'
import { circle, fronts, HANDLE_OPTION, LEG_OPTION, legs, line, rect } from './parts'

// Office / study and hallway & entry.

export const desk: PropDef = {
  id: 'desk', name: 'Desk', category: 'office', rooms: ['office', 'bedroom'], keywords: ['writing desk', 'workstation', 'table'],
  size: { w: 1.4, d: 0.7, h: 0.75 }, mount: 'floor',
  options: [{ id: 'drawers', label: 'Drawer pedestal', type: 'select', default: 'right', choices: [
    { value: 'none', label: 'None' }, { value: 'left', label: 'Left' }, { value: 'right', label: 'Right' }] }, { ...LEG_OPTION, default: 'block' }, { ...HANDLE_OPTION }],
  slots: [{ id: 'top', label: 'Top', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } }, { id: 'base', label: 'Legs / pedestal', default: { material: 'painted', colour: '#2b2b2d' } }, { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#c9a04f' } }],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    kit.box('top', [w, 0.03, d], [0, h - 0.015, 0])
    legs(kit, 'base', w, d, h - 0.03, String(o.legs), 0.04)
    if (o.drawers !== 'none') {
      const s = o.drawers === 'left' ? -1 : 1
      const pw = 0.42
      kit.box('base', [pw, h - 0.03, d - 0.06], [s * (w / 2 - pw / 2 - 0.02), (h - 0.03) / 2, -0.01])
      fronts(kit, 'base', 'handles', String(o.handles), { w: pw - 0.02, h: h - 0.08, y0: 0.03, faceZ: d / 2 - 0.04 }, 1, 3)
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.01, 'top')]
}

export const officeChair: PropDef = {
  id: 'office-chair', name: 'Office chair', category: 'office', rooms: ['office'], keywords: ['desk chair', 'task chair', 'swivel'],
  size: { w: 0.65, d: 0.65, h: 1.05 }, mount: 'floor',
  options: [{ id: 'arms', label: 'Armrests', type: 'toggle', default: true }],
  slots: [{ id: 'seat', label: 'Seat & back', default: { material: 'fabric', colour: '#4a4b4f' } }, { id: 'frame', label: 'Base & frame', default: { material: 'plastic', colour: '#202022' } }],
  build(kit, { w, h, o }) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2
      kit.box('frame', [0.04, 0.03, w / 2 - 0.03], [Math.sin(a) * (w / 4), 0.07, Math.cos(a) * (w / 4)], { rot: [0, (a * 180) / Math.PI, 0] })
      kit.sphere('frame', [0.05, 0.05, 0.05], [Math.sin(a) * (w / 2 - 0.04), 0.025, Math.cos(a) * (w / 2 - 0.04)], { small: true, segments: 8 })
    }
    kit.cylinder('frame', { d: 0.05, h: 0.38, sides: 12 }, [0, 0.27, 0])
    kit.soft('seat', [0.5, 0.08, 0.48], [0, 0.48, 0.02], 0.04)
    kit.soft('seat', [0.46, h - 0.6, 0.07], [0, 0.55 + (h - 0.6) / 2, -0.22], 0.04, { rot: [-8, 0, 0] })
    if (o.arms) [-1, 1].forEach(s => {
      kit.box('frame', [0.03, 0.2, 0.03], [s * 0.27, 0.6, 0.02])
      kit.box('frame', [0.06, 0.025, 0.24], [s * 0.27, 0.71, 0.04])
    })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'line'), rect(0, 0.02, 0.5, 0.48, 'body', 0.06, 'seat'), rect(0, -0.24, 0.46, 0.07, 'soft', 0.03, 'seat')]
}

export const filingCabinet: PropDef = {
  id: 'filing-cabinet', name: 'Filing cabinet', category: 'office', rooms: ['office'], keywords: ['drawers', 'storage', 'cabinet'],
  size: { w: 0.47, d: 0.62, h: 1.02 }, mount: 'floor',
  options: [{ id: 'drawers', label: 'Drawers', type: 'number', min: 2, max: 5, step: 1, default: 3 }],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#8d8f93', roughness: 0.5 } }, { id: 'handles', label: 'Handles', default: { material: 'metal', colour: '#d6d8db' } }],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    kit.box('body', [w, h, d], [0, h / 2, 0])
    fronts(kit, 'body', 'handles', 'bar', { w: w - 0.02, h: h - 0.02, y0: 0.01, faceZ: d / 2 }, 1, Number(o.drawers))
  },
  plan: ({ w, d }) => [rect(0, 0, w, d), line([-w / 2 + 0.02, d / 2 - 0.02], [w / 2 - 0.02, d / 2 - 0.02])]
}

export const monitor: PropDef = {
  id: 'monitor', name: 'Computer monitor', category: 'office', rooms: ['office', 'bedroom'], keywords: ['screen', 'display', 'computer', 'imac'],
  size: { w: 0.62, d: 0.2, h: 0.45 }, mount: 'surface', imageSlot: 'screen', options: [],
  slots: [{ id: 'body', label: 'Body & stand', default: { material: 'metal', colour: '#a7a9ac' } }, { id: 'screen', label: 'Screen', default: { material: 'glass', colour: '#0d0f12', opacity: 1, roughness: 0.08 } }],
  build(kit, { w, d, h }) {
    const sh = w * 0.58
    kit.box('body', [w, sh, 0.025], [0, h - sh / 2, -0.02])
    kit.plane('screen', { w: w - 0.02, h: sh - 0.02 }, [0, h - sh / 2, -0.007], { fit: true })
    kit.box('body', [0.05, h - sh + 0.05, 0.02], [0, (h - sh + 0.05) / 2, -d / 2 + 0.06], { rot: [8, 0, 0] })
    kit.box('body', [0.2, 0.01, d * 0.85], [0, 0.005, 0])
  },
  plan: ({ w, d }) => [rect(0, -0.02, w, 0.03, 'body'), rect(0, 0, 0.2, d * 0.85, 'hidden')]
}

export const laptop: PropDef = {
  id: 'laptop', name: 'Laptop', category: 'office', rooms: ['office', 'bedroom', 'living'], keywords: ['macbook', 'notebook', 'computer'],
  size: { w: 0.31, d: 0.22, h: 0.21 }, mount: 'surface', imageSlot: 'screen',
  options: [{ id: 'open', label: 'Open', type: 'toggle', default: true }],
  slots: [{ id: 'body', label: 'Body', default: { material: 'metal', colour: '#a7a9ac' } }, { id: 'screen', label: 'Screen', default: { material: 'glass', colour: '#0d0f12', opacity: 1, roughness: 0.08 } }],
  build(kit, { w, d, o }) {
    kit.box('body', [w, 0.012, d], [0, 0.006, 0])
    if (o.open) {
      kit.box('body', [w, d, 0.007], [0, 0.012 + d / 2 * Math.cos(0.3), -d / 2 - Math.sin(0.3) * d / 2 + 0.004], { rot: [-17, 0, 0] })
      kit.plane('screen', { w: w - 0.02, h: d - 0.03 }, [0, 0.012 + d / 2 * Math.cos(0.3), -d / 2 - Math.sin(0.3) * d / 2 + 0.008], { fit: true, rot: [-17, 0, 0] })
    } else kit.box('body', [w, 0.006, d], [0, 0.015, 0])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0.01)]
}

export const whiteboard: PropDef = {
  id: 'whiteboard', name: 'Whiteboard / pinboard', category: 'office', rooms: ['office'], keywords: ['board', 'pinboard', 'corkboard', 'chalkboard'],
  size: { w: 1.5, d: 0.03, h: 1.0 }, mount: 'wall', elevation: 0.9, imageSlot: 'surface', options: [],
  slots: [{ id: 'surface', label: 'Surface', default: { material: 'painted', colour: '#f7f6f2', roughness: 0.2 } }, { id: 'frame', label: 'Frame', default: { material: 'metal', colour: '#a7a9ac' } }],
  build(kit, { w, d, h }) {
    kit.box('frame', [w, h, d], [0, h / 2, 0])
    kit.plane('surface', { w: w - 0.04, h: h - 0.04 }, [0, h / 2, d / 2 + 0.001], { fit: true })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'frame')]
}

export const consoleTable: PropDef = {
  id: 'console-table', name: 'Console table', category: 'hallway', rooms: ['hallway', 'living'], keywords: ['hall table', 'sofa table', 'entry table'],
  size: { w: 1.1, d: 0.35, h: 0.8 }, mount: 'floor',
  options: [{ ...LEG_OPTION, default: 'tapered' }, { id: 'shelf', label: 'Lower shelf', type: 'toggle', default: true }],
  slots: [{ id: 'top', label: 'Top', default: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } }, { id: 'legs', label: 'Legs', default: { material: 'metal', colour: '#c9a04f' } }],
  surfaceTop: p => p.h,
  build(kit, { w, d, h, o }) {
    kit.box('top', [w, 0.03, d], [0, h - 0.015, 0])
    legs(kit, 'legs', w, d, h - 0.03, String(o.legs), 0.03)
    if (o.shelf) kit.box('top', [w - 0.06, 0.02, d - 0.04], [0, 0.18, 0])
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'body', 0, 'top')]
}

export const coatRack: PropDef = {
  id: 'coat-rack', name: 'Coat stand', category: 'hallway', rooms: ['hallway', 'bedroom'], keywords: ['coat rack', 'hat stand', 'hooks'],
  size: { w: 0.5, d: 0.5, h: 1.8 }, mount: 'floor',
  options: [{ id: 'coats', label: 'Coats hanging', type: 'number', min: 0, max: 4, step: 1, default: 2 }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#2a2522', colour2: '#1c1816' } }, { id: 'coats', label: 'Coats', default: { material: 'fabric', colour: '#6f6f45' } }],
  build(kit, { w, h, o }) {
    kit.cylinder('frame', { d: 0.04, h, sides: 12 }, [0, h / 2, 0])
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      kit.box('frame', [0.03, 0.02, w / 2], [Math.sin(a) * w / 4, 0.03, Math.cos(a) * w / 4], { rot: [0, (a * 180) / Math.PI, 0] })
    }
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      kit.cylinder('frame', { d: 0.02, h: 0.14, sides: 6 }, [Math.sin(a) * 0.05, h - 0.12, Math.cos(a) * 0.05], { rot: [Math.cos(a) * 40, 0, -Math.sin(a) * 40], small: true })
    }
    const n = Number(o.coats)
    for (let i = 0; i < n; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4
      kit.soft('coats', [0.34, 0.85, 0.16], [Math.sin(a) * 0.14, h - 0.55, Math.cos(a) * 0.14], 0.07, { rot: [0, (a * 180) / Math.PI + 90, 0] })
    }
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'line'), circle(0, 0, 0.03, 'body')]
}

export const shoeRack: PropDef = {
  id: 'shoe-rack', name: 'Shoe rack', category: 'hallway', rooms: ['hallway', 'bedroom'], keywords: ['shoes', 'storage'],
  size: { w: 0.8, d: 0.3, h: 0.5 }, mount: 'floor',
  options: [{ id: 'shelves', label: 'Shelves', type: 'number', min: 1, max: 4, step: 1, default: 2 }, { id: 'shoes', label: 'Shoes', type: 'toggle', default: true }],
  slots: [{ id: 'frame', label: 'Frame', default: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72' } }, { id: 'shoes', label: 'Shoes', default: { material: 'leather', colour: '#4a2f22' } }],
  build(kit, { w, d, h, o }) {
    [-1, 1].forEach(s => kit.box('frame', [0.02, h, d], [s * (w / 2 - 0.01), h / 2, 0]))
    const n = Number(o.shelves)
    for (let i = 0; i <= n; i++) {
      const y = 0.04 + (i / n) * (h - 0.06)
      kit.box('frame', [w - 0.04, 0.02, d], [0, y, 0])
      if (o.shoes && i < n) for (let k = 0; k < Math.floor((w - 0.1) / 0.24); k++) {
        [-0.045, 0.045].forEach(dx => kit.soft('shoes', [0.08, 0.08, d * 0.85], [-w / 2 + 0.17 + k * 0.24 + dx, y + 0.05, 0], 0.03, { small: true }))
      }
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, d)]
}

export const OFFICE: PropDef[] = [desk, officeChair, filingCabinet, monitor, laptop, whiteboard]
export const HALLWAY: PropDef[] = [consoleTable, coatRack, shoeRack]
