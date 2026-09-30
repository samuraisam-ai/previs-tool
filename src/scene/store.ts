import { reactive } from 'vue'
import { getFixture } from '../library/fixtures'
import { defaultModifier, getModifier, modifiersFor } from '../library/modifiers'
import { isZoomable } from '../library/photometry'
import { ItemKind, LightItem, LightProps, SceneDoc, SceneItem } from './types'

let nextId = 1
const newId = (kind: ItemKind) => `${kind}-${nextId++}`

export const DEFAULT_FIXTURE = 'forza-300b-ii'

export function lightPropsFor(fixtureId: string, previous?: LightProps): LightProps {
  const fixture = getFixture(fixtureId)
  const keepModifier = previous && modifiersFor(fixture).some(m => m.id === previous.modifierId)
  const modifier = keepModifier ? getModifier(previous.modifierId) : defaultModifier(fixture)
  const [minK, maxK] = fixture.cct
  const cct = Math.min(Math.max(previous?.cct ?? 5600, minK), maxK)
  return {
    fixtureId,
    modifierId: modifier.id,
    dimmer: previous?.dimmer ?? 100,
    cct,
    gm: previous?.gm ?? 0,
    mode: fixture.colour === 'rgb' ? previous?.mode ?? 'cct' : 'cct',
    hue: previous?.hue ?? 200,
    sat: previous?.sat ?? 100,
    zoom: isZoomable(modifier) ? modifier.beam[1] : 45,
    tilt: previous?.tilt ?? 20,
    orientation: previous?.orientation ?? 'vertical'
  }
}

export const scene = reactive<SceneDoc>({
  room: { width: 6, depth: 5, height: 2.8 },
  items: [
    { id: newId('subject'), kind: 'subject', name: 'Subject', x: 0, z: 0.5, rotationY: 180, height: 1.75 },
    {
      id: newId('light'), kind: 'light', name: 'Key', x: -1.5, z: -0.6, rotationY: 50, height: 2.1,
      props: { ...lightPropsFor(DEFAULT_FIXTURE), modifierId: 'para-90', cct: 4300, dimmer: 15 }
    },
    { id: newId('camera'), kind: 'camera', name: 'Camera A', x: 0.3, z: -1.8, rotationY: 0, height: 1.5, props: { focalLength: 35 } }
  ],
  selectedId: null,
  exposure: { iso: 800, tStop: 4, shutter: 1 / 50 },
  ambientLux: 2
})

const counts: Record<ItemKind, number> = { subject: 1, light: 1, camera: 1 }

export function addItem(kind: ItemKind, fixtureId = DEFAULT_FIXTURE): SceneItem {
  counts[kind]++
  const base = { id: newId(kind), x: 0, z: 0, rotationY: 0 }
  let item: SceneItem
  if (kind === 'subject') {
    item = { ...base, kind, name: `Subject ${counts[kind]}`, height: 1.75 }
  } else if (kind === 'light') {
    const fixture = getFixture(fixtureId)
    const height = fixture.shape.type === 'bulb' ? 1.2 : fixture.shape.type === 'tube' ? 1.2 : 2.0
    item = { ...base, z: -1.5, kind, name: fixture.model, height, props: lightPropsFor(fixtureId) }
  } else {
    item = { ...base, kind, name: `Camera ${String.fromCharCode(64 + counts[kind])}`, height: 1.5, props: { focalLength: 35 } }
  }
  scene.items.push(item)
  scene.selectedId = item.id
  return item
}

// Swap the fixture on a light, keeping compatible settings.
export function setFixture(item: LightItem, fixtureId: string): void {
  const oldModel = getFixture(item.props.fixtureId).model
  if (item.name === oldModel) item.name = getFixture(fixtureId).model
  item.props = lightPropsFor(fixtureId, item.props)
}

export function setModifier(item: LightItem, modifierId: string): void {
  const modifier = getModifier(modifierId)
  item.props.modifierId = modifierId
  if (isZoomable(modifier)) item.props.zoom = modifier.beam[1]
}

export function getItem(id: string | null): SceneItem | undefined {
  return scene.items.find(item => item.id === id)
}

export function updateItem(id: string, patch: Partial<SceneItem>): void {
  const item = getItem(id)
  if (item) Object.assign(item, patch)
}

export function removeItem(id: string): void {
  const index = scene.items.findIndex(item => item.id === id)
  if (index !== -1) scene.items.splice(index, 1)
  if (scene.selectedId === id) scene.selectedId = null
}

export function select(id: string | null): void {
  scene.selectedId = id
}
