import { Kit, OptionDef, PlanClass, PlanShape } from '../types'

// Building blocks shared by catalogue items: legs, handles, drawer and door fronts, plan helpers.

export const LEG_OPTION: OptionDef = {
  id: 'legs', label: 'Legs', type: 'select', default: 'tapered',
  choices: [
    { value: 'tapered', label: 'Tapered' }, { value: 'block', label: 'Block' },
    { value: 'hairpin', label: 'Metal hairpin' }, { value: 'plinth', label: 'Plinth (no legs)' }
  ]
}

export const HANDLE_OPTION: OptionDef = {
  id: 'handles', label: 'Handles', type: 'select', default: 'bar',
  choices: [
    { value: 'bar', label: 'Bar' }, { value: 'knob', label: 'Knob' },
    { value: 'recessed', label: 'Recessed / push' }, { value: 'none', label: 'None' }
  ]
}

// Four legs (or a plinth) under a footprint w × d, legH tall, inset from the edges.
export function legs(kit: Kit, slot: string, w: number, d: number, legH: number, style: string, inset = 0.05): void {
  if (legH <= 0.005) return
  const xs = [-w / 2 + inset, w / 2 - inset]
  const zs = [-d / 2 + inset, d / 2 - inset]
  if (style === 'plinth') {
    kit.box(slot, [w - inset * 2, legH, d - inset * 2], [0, legH / 2, 0])
    return
  }
  xs.forEach(x => zs.forEach(z => {
    if (style === 'block') kit.box(slot, [0.05, legH, 0.05], [x, legH / 2, z])
    else if (style === 'hairpin') {
      kit.tube(slot, [[x - 0.03, 0, z], [x, legH, z], [x + 0.03, 0, z]], 0.005, { small: true })
    } else kit.cylinder(slot, { dTop: 0.04, dBottom: 0.022, h: legH, sides: 10 }, [x, legH / 2, z])
  }))
}

// A handle on a front face at (x, y), the face being at z = faceZ (front is +z).
export function handle(kit: Kit, slot: string, style: string, x: number, y: number, faceZ: number, length = 0.12, vertical = false): void {
  if (style === 'none' || style === 'recessed') return
  if (style === 'knob') {
    kit.sphere(slot, [0.03, 0.03, 0.025], [x, y, faceZ + 0.015], { small: true, segments: 8 })
    return
  }
  const size: [number, number, number] = vertical ? [0.014, length, 0.014] : [length, 0.014, 0.014]
  kit.box(slot, size, [x, y, faceZ + 0.02], { small: true })
}

// A grid of drawer / door fronts on the +z face: thin inset panels with handles.
export function fronts(
  kit: Kit, slot: string, handleSlot: string, handleStyle: string,
  area: { w: number; h: number; y0: number; faceZ: number }, cols: number, rows: number, doors = false
): void {
  const gap = 0.006
  const cw = area.w / cols
  const rh = area.h / rows
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < rows; r++) {
      const x = -area.w / 2 + cw * (c + 0.5)
      const y = area.y0 + rh * (r + 0.5)
      kit.box(slot, [cw - gap * 2, rh - gap * 2, 0.018], [x, y, area.faceZ + 0.009])
      if (doors) {
        const hx = x + (c % 2 === 0 ? 1 : -1) * (cw / 2 - 0.05)
        handle(kit, handleSlot, handleStyle, cols === 1 ? x + cw / 2 - 0.05 : hx, y, area.faceZ + 0.018, Math.min(0.25, rh * 0.3), true)
      } else handle(kit, handleSlot, handleStyle, x, y + rh * 0.15, area.faceZ + 0.018, Math.min(0.2, cw * 0.4))
    }
  }
}

// ── Plan helpers ──────────────────────────────────────────────────────────────
export const rect = (x: number, z: number, w: number, d: number, cls: PlanClass = 'body', r = 0, tint?: string): PlanShape =>
  ({ t: 'rect', x, z, w, d, r, cls, tint })
export const circle = (x: number, z: number, r: number, cls: PlanClass = 'body', tint?: string): PlanShape =>
  ({ t: 'circle', x, z, r, cls, tint })
export const line = (a: [number, number], b: [number, number]): PlanShape => ({ t: 'path', pts: [a, b], cls: 'line' })
