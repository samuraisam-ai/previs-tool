import { reactive } from 'vue'
import { ItemKind, SceneDoc, SceneItem } from './types'

let nextId = 1
const newId = (kind: ItemKind) => `${kind}-${nextId++}`

export const scene = reactive<SceneDoc>({
  room: { width: 6, depth: 5, height: 2.8 },
  items: [
    { id: newId('subject'), kind: 'subject', name: 'Subject', x: 0, z: 0.5, rotationY: 180, height: 1.75 },
    { id: newId('light'), kind: 'light', name: 'Key light', x: -1.5, z: -0.5, rotationY: 45, height: 2.2, props: { intensity: 30, color: '#ffe2c0', angle: 50, tilt: 25 } },
    { id: newId('camera'), kind: 'camera', name: 'Camera A', x: 0.3, z: -1.8, rotationY: 0, height: 1.5, props: { focalLength: 35 } }
  ],
  selectedId: null
})

const counts: Record<ItemKind, number> = { subject: 1, light: 1, camera: 1 }

export function addItem(kind: ItemKind): SceneItem {
  counts[kind]++
  const base = { id: newId(kind), x: 0, z: 0, rotationY: 0 }
  let item: SceneItem
  if (kind === 'subject') {
    item = { ...base, kind, name: `Subject ${counts[kind]}`, height: 1.75 }
  } else if (kind === 'light') {
    item = { ...base, kind, name: `Light ${counts[kind]}`, height: 2.2, props: { intensity: 30, color: '#ffffff', angle: 50, tilt: 25 } }
  } else {
    item = { ...base, kind, name: `Camera ${String.fromCharCode(64 + counts[kind])}`, height: 1.5, props: { focalLength: 35 } }
  }
  scene.items.push(item)
  scene.selectedId = item.id
  return item
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
