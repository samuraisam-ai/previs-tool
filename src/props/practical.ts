import { commit } from '../plan/history'
import { addItem, removeItem, scene } from '../scene/store'
import { LightItem, PropItem } from '../scene/types'
import { getDef } from './catalog'
import { paramsOf } from './create'

// Practicals: a lamp prop with a real Nanlite bulb from the lighting library inside it. The bulb
// follows the lamp (move, turn, resize, raise) and is deleted with it; the shade glows with it.

export const linkedLights = (prop: PropItem): LightItem[] =>
  scene.items.filter((i): i is LightItem => i.kind === 'light' && i.attachedTo === prop.id)

// Put the linked bulb(s) where the def says the bulb is.
export function syncPractical(prop: PropItem): void {
  const def = getDef(prop.props.catalogId)
  if (!def?.bulb) return
  const [bx, by, bz] = def.bulb(paramsOf(prop.props))
  const r = (prop.rotationY * Math.PI) / 180
  const c = Math.cos(r)
  const s = Math.sin(r)
  linkedLights(prop).forEach(light => {
    light.x = Math.round((prop.x + bx * c + bz * s) * 1000) / 1000
    light.z = Math.round((prop.z - bx * s + bz * c) * 1000) / 1000
    light.height = Math.round((prop.props.elevation + by) * 1000) / 1000
  })
}

export function lightIt(prop: PropItem, record = true): LightItem | null {
  const def = getDef(prop.props.catalogId)
  if (!def?.practical || !def.bulb) return null
  if (record) commit()
  const light = addItem('light', def.practical.fixture) as LightItem
  light.attachedTo = prop.id
  light.name = `${prop.name} bulb`
  // A warm household bulb, not full power.
  light.props.dimmer = 40
  light.props.cct = 2700
  syncPractical(prop)
  if (record) commit()
  return light
}

export function unlight(prop: PropItem): void {
  commit()
  linkedLights(prop).forEach(l => removeItem(l.id))
  commit()
}
