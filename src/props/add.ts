import { reactive } from 'vue'
import { newId, scene } from '../scene/store'
import { PropItem } from '../scene/types'
import { getDef } from './catalog'
import { defaultPropProps } from './create'

// Adding props, and the per-browser Recent / Favourites lists for the library.

export function addProp(defId: string): PropItem | null {
  const def = getDef(defId)
  if (!def) return null
  const item: PropItem = { id: newId('prop'), kind: 'prop', name: def.name, x: 0, z: 0, rotationY: 0, height: 0, props: defaultPropProps(def) }
  scene.items.push(item)
  remember(defId)
  return scene.items[scene.items.length - 1] as PropItem
}

const read = (key: string): string[] => {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') } catch { return [] }
}
const write = (key: string, list: string[]) => {
  try { localStorage.setItem(key, JSON.stringify(list)) } catch { /* private mode */ }
}

export const library = reactive({
  recent: read('previs.props.recent'),
  favourites: read('previs.props.favourites')
})

function remember(defId: string): void {
  library.recent = [defId, ...library.recent.filter(id => id !== defId)].slice(0, 12)
  write('previs.props.recent', library.recent)
}

export function toggleFavourite(defId: string): void {
  library.favourites = library.favourites.includes(defId) ? library.favourites.filter(id => id !== defId) : [...library.favourites, defId]
  write('previs.props.favourites', library.favourites)
}
