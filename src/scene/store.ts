import { reactive } from 'vue'
import { getFixture } from '../library/fixtures'
import { defaultModifier, getModifier, modifiersFor } from '../library/modifiers'
import { Bounce, bounceLight, isZoomable } from '../library/photometry'
import { DEFAULT_LENS } from '../library/lenses'
import { CameraItem, CameraProps, ItemKind, LightItem, LightProps, SceneDoc, SceneItem } from './types'

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

export function cameraPropsFor(subjectId: string | null): CameraProps {
  return {
    bodyId: 'fx3',
    lensId: DEFAULT_LENS,
    fps: 23.976,
    profile: 'cinetone',
    shutterMode: 'angle',
    shutterAngle: 180,
    shutterSpeed: 48,
    iso: 800,
    tStop: 4,
    nd: { fitted: false, stops: 3 },
    polarizer: { fitted: false, angle: 0 },
    wb: 4300,
    tint: 0,
    focus: { mode: subjectId ? 'subject' : 'manual', subjectId, distance: 2 },
    tilt: 0,
    display: {
      osd: true, frameLines: 'off', grid: 'off', centre: false, safety: false,
      zebras: false, zebraLevel: 95, falseColour: false, mm: true, scopes: ['histogram']
    },
    recording: false
  }
}

const subjectId = newId('subject')
const cameraId = newId('camera')

export const scene = reactive<SceneDoc>({
  room: { width: 6, depth: 5, height: 2.8 },
  items: [
    { id: subjectId, kind: 'subject', name: 'Subject', x: 0, z: 0.5, rotationY: 180, height: 1.75 },
    {
      id: newId('light'), kind: 'light', name: 'Key', x: -1.5, z: -0.6, rotationY: 50, height: 2.1,
      props: { ...lightPropsFor(DEFAULT_FIXTURE), modifierId: 'para-90', cct: 4300, dimmer: 15 }
    },
    { id: cameraId, kind: 'camera', name: 'Camera A', x: 0.3, z: -1.8, rotationY: 0, height: 1.5, props: cameraPropsFor(subjectId) }
  ],
  selectedId: null,
  activeCameraId: cameraId,
  ambientLux: 0.5
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
    const firstSubject = scene.items.find(i => i.kind === 'subject')
    item = { ...base, z: -1.5, kind, name: `Camera ${String.fromCharCode(64 + counts[kind])}`, height: 1.5, props: cameraPropsFor(firstSubject?.id ?? null) }
    if (!scene.activeCameraId) scene.activeCameraId = item.id
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
  if (scene.activeCameraId === id) scene.activeCameraId = scene.items.find(i => i.kind === 'camera')?.id ?? null
  // Cameras tracking a removed subject fall back to manual focus at the same distance.
  scene.items.forEach(item => {
    if (item.kind === 'camera' && item.props.focus.subjectId === id) {
      item.props.focus.mode = 'manual'
      item.props.focus.subjectId = null
    }
  })
}

export function activeCamera(): CameraItem | undefined {
  const cam = getItem(scene.activeCameraId)
  return cam && cam.kind === 'camera' ? cam : undefined
}

export function select(id: string | null): void {
  scene.selectedId = id
}

// Estimated bounce (indirect) light in the room, from every light's flux and the room's surfaces.
export function sceneBounce(doc: SceneDoc = scene): Bounce {
  const { width, depth, height } = doc.room
  const area = 2 * (width * depth + width * height + depth * height)
  return bounceLight(doc.items.filter((i): i is LightItem => i.kind === 'light'), area)
}
