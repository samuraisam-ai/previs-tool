import { PropDef } from '../types'
import { circle, rect } from './parts'

// Practical lamps (the light itself can be linked from the lighting library).

export const floorLamp: PropDef = {
  id: 'floor-lamp', name: 'Floor lamp', category: 'practicals', rooms: ['living', 'bedroom', 'office'], keywords: ['standard lamp', 'arc lamp', 'reading lamp'],
  size: { w: 0.45, d: 0.45, h: 1.6 }, mount: 'floor',
  options: [{ id: 'style', label: 'Style', type: 'select', default: 'drum', choices: [{ value: 'drum', label: 'Drum shade' }, { value: 'arc', label: 'Arc' }, { value: 'tripod', label: 'Tripod' }] }],
  slots: [{ id: 'shade', label: 'Shade', default: { material: 'fabric', colour: '#f1eee8' } }, { id: 'stand', label: 'Stand', default: { material: 'metal', colour: '#2a2b2d' } }],
  build(kit, { w, h, o }) {
    const r = w / 2
    if (o.style === 'arc') {
      kit.box('stand', [0.3, 0.06, 0.3], [-w * 0.6, 0.03, 0])
      kit.tube('stand', [[-w * 0.6, 0, 0], [-w * 0.6, h * 0.7, 0], [-w * 0.3, h, 0], [w * 0.4, h * 0.95, 0], [w * 0.55, h * 0.85, 0]], 0.012)
      kit.lathe('shade', [[r * 0.75, 0], [r * 0.2, 0.22]], [w * 0.55, h * 0.62, 0], { sides: 24 })
    } else if (o.style === 'tripod') {
      [0, 1, 2].forEach(i => { const a = (i / 3) * Math.PI * 2; kit.tube('stand', [[Math.sin(a) * r * 0.9, 0, Math.cos(a) * r * 0.9], [0, h * 0.72, 0]], 0.012) })
      kit.lathe('shade', [[r, 0], [r * 0.85, h * 0.25]], [0, h * 0.72, 0], { sides: 24 })
    } else {
      kit.cylinder('stand', { d: r * 1.1, h: 0.03, sides: 20 }, [0, 0.015, 0])
      kit.cylinder('stand', { d: 0.025, h: h * 0.8, sides: 8 }, [0, h * 0.4, 0])
      kit.lathe('shade', [[r, 0], [r, h * 0.22]], [0, h * 0.78, 0], { sides: 28 })
    }
  },
  plan: ({ w, o }) => (o.style === 'arc' ? [rect(-w * 0.6, 0, 0.3, 0.3, 'body', 0, 'stand'), circle(w * 0.55, 0, w * 0.37, 'hidden')] : [circle(0, 0, w / 2, 'soft', 'shade')])
}

export const deskLamp: PropDef = {
  id: 'desk-lamp', name: 'Desk lamp', category: 'practicals', rooms: ['office', 'bedroom'], keywords: ['task lamp', 'anglepoise', 'banker lamp'],
  size: { w: 0.2, d: 0.35, h: 0.45 }, mount: 'surface', options: [],
  slots: [{ id: 'body', label: 'Lamp', default: { material: 'painted', colour: '#2b2b2d', roughness: 0.35 } }],
  build(kit, { h }) {
    kit.cylinder('body', { d: 0.16, h: 0.025, sides: 20 }, [0, 0.0125, -0.08])
    kit.tube('body', [[0, 0.02, -0.08], [0, h * 0.6, -0.12], [0, h * 0.9, 0.06]], 0.008)
    kit.lathe('body', [[0.07, 0], [0.03, 0.08], [0.02, 0.11]], [0, h * 0.78, 0.1], { sides: 18, rot: [-40, 0, 0] })
  },
  plan: () => [circle(0, -0.08, 0.08, 'body'), circle(0, 0.1, 0.07, 'hidden')]
}

export const pendant: PropDef = {
  id: 'pendant', name: 'Pendant light', category: 'practicals', rooms: ['dining', 'kitchen', 'living', 'bedroom', 'hallway'], keywords: ['ceiling light', 'hanging lamp', 'chandelier'],
  size: { w: 0.4, d: 0.4, h: 0.8 }, mount: 'ceiling', elevation: 1.6,
  options: [{ id: 'shade', label: 'Shade', type: 'select', default: 'dome', choices: [{ value: 'dome', label: 'Dome' }, { value: 'globe', label: 'Globe' }, { value: 'cone', label: 'Cone' }, { value: 'drum', label: 'Drum' }] }],
  slots: [{ id: 'shade', label: 'Shade', default: { material: 'metal', colour: '#202022', roughness: 0.4 } }, { id: 'cord', label: 'Cord', default: { material: 'plastic', colour: '#202022' } }],
  build(kit, { w, h, o }) {
    const r = w / 2
    const sh = o.shade === 'globe' ? w : w * 0.55
    kit.cylinder('cord', { d: 0.008, h: h - sh, sides: 6 }, [0, sh + (h - sh) / 2, 0], { small: true })
    if (o.shade === 'globe') kit.sphere('shade', [w, w, w], [0, r, 0])
    else if (o.shade === 'cone') kit.lathe('shade', [[r, 0], [0.03, sh]], [0, 0, 0], { sides: 24 })
    else if (o.shade === 'drum') kit.lathe('shade', [[r, 0], [r, sh], [0.02, sh]], [0, 0, 0], { sides: 28 })
    else kit.lathe('shade', [[r, 0], [r * 0.85, sh * 0.5], [r * 0.45, sh * 0.9], [0.03, sh]], [0, 0, 0], { sides: 28 })
  },
  plan: ({ w }) => [circle(0, 0, w / 2, 'hidden')]
}

export const sconce: PropDef = {
  id: 'sconce', name: 'Wall sconce', category: 'practicals', rooms: ['bedroom', 'living', 'hallway', 'bathroom', 'dining'], keywords: ['wall light', 'wall lamp'],
  size: { w: 0.15, d: 0.2, h: 0.3 }, mount: 'wall', elevation: 1.6, options: [],
  slots: [{ id: 'shade', label: 'Shade', default: { material: 'glass', colour: '#f7f6f2', opacity: 0.7, roughness: 0.6 } }, { id: 'arm', label: 'Arm', default: { material: 'metal', colour: '#c9a04f' } }],
  build(kit, { w, d, h }) {
    kit.box('arm', [0.08, 0.14, 0.015], [0, h * 0.35, -d / 2 + 0.0075])
    kit.tube('arm', [[0, h * 0.35, -d / 2], [0, h * 0.35, d * 0.15], [0, h * 0.5, d * 0.15]], 0.008, { small: true })
    kit.lathe('shade', [[w * 0.3, 0], [w / 2, h * 0.5]], [0, h * 0.5, d * 0.15], { sides: 20 })
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'hidden')]
}

export const stringLights: PropDef = {
  id: 'string-lights', name: 'String lights', category: 'practicals', rooms: ['outdoor', 'bedroom', 'living'], keywords: ['fairy lights', 'festoon', 'bulbs'],
  size: { w: 3.0, d: 0.1, h: 0.4 }, mount: 'wall', elevation: 2.0,
  options: [{ id: 'bulbs', label: 'Bulbs', type: 'number', min: 4, max: 40, step: 1, default: 12 }, { id: 'lit', label: 'Lit', type: 'toggle', default: true }],
  slots: [{ id: 'bulbs', label: 'Bulbs', default: { material: 'glow', colour: '#ffd9a0' } }, { id: 'wire', label: 'Wire', default: { material: 'plastic', colour: '#202022' } }],
  build(kit, { w, h, o }) {
    const n = Number(o.bulbs)
    const sag = (x: number) => h - h * 0.8 * (1 - Math.pow((2 * x) / w, 2))
    const path: Array<[number, number, number]> = []
    for (let i = 0; i <= 16; i++) { const x = -w / 2 + (w * i) / 16; path.push([x, sag(x), 0]) }
    kit.tube('wire', path, 0.004, { small: true, sides: 4 })
    for (let i = 0; i < n; i++) {
      const x = -w / 2 + (w * (i + 0.5)) / n
      kit.sphere(o.lit ? 'bulbs' : 'wire', [0.045, 0.06, 0.045], [x, sag(x) - 0.05, 0], { segments: 6, small: true })
    }
  },
  plan: ({ w, d }) => [rect(0, 0, w, d, 'hidden')]
}

export const PRACTICALS: PropDef[] = [floorLamp, deskLamp, pendant, sconce, stringLights]
