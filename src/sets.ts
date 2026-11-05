import { computed, reactive, watch } from 'vue'
import { track } from './analytics'
import { nav } from './nav'
import { isPhone } from './phone'
import { loadScene } from './plan/history'
import { scene } from './scene/store'
import { SceneDoc } from './scene/types'
import { SAMPLES } from './setups/samples'

// Set links: previs-tool.vercel.app/?set=d07 opens a published set (public/sets/d07.json) straight
// into the Live View, so a social post can hand people the exact set it showed. The built-in sample
// houses open the same way (?set=house-3bed). A set file is either a bare scene document or
//   { "format": "previs-set", "title": "…", "view": "orbit" | "<camera name>", "scene": { …scene… } }
// On phones a set opens in a simple look-only viewer (see phoneBridge).

export type SetState = 'none' | 'loading' | 'open' | 'failed'

export const setLink = reactive({
  slug: '',
  title: '',
  state: 'none' as SetState,
  message: '',
  // Camera to look through once the set is open; null = free orbit.
  viewId: null as string | null
})

// A phone visiting through a set link (or the sample button) gets the simple 3D viewer instead of
// the "bigger screen" notice.
export const phoneBridge = computed(() => isPhone.value && (setLink.state === 'loading' || setLink.state === 'open'))

const SLUG = /^[a-z0-9][a-z0-9-]{0,47}$/

interface SetFile { format?: string; title?: string; view?: string; scene?: SceneDoc }

const base = () => process.env.BASE_URL ?? '/'

function sourceFor(slug: string): { url: string; title: string } {
  const sample = SAMPLES.find(s => s.id === slug)
  if (sample) return { url: `${base()}samples/${sample.file}`, title: sample.title.replace('Sample – ', '') }
  return { url: `${base()}sets/${slug}.json`, title: '' }
}

const isSceneDoc = (d: unknown): d is SceneDoc => {
  const doc = d as SceneDoc
  return !!doc && Array.isArray(doc.walls) && Array.isArray(doc.openings) && Array.isArray(doc.rooms) && Array.isArray(doc.items)
}

const device = () => (isPhone.value ? 'phone' : 'desktop')

export async function openSet(slug: string): Promise<void> {
  if (!SLUG.test(slug)) {
    fail(slug, 'This set link is not valid. Check that it was copied in full.')
    return
  }
  const source = sourceFor(slug)
  Object.assign(setLink, { slug, title: source.title, state: 'loading', message: '', viewId: null })
  let file: SetFile
  try {
    const res = await fetch(source.url)
    if (!res.ok) {
      fail(slug, res.status === 404 ? 'This set link doesn\'t lead to a set. It may have been mistyped or taken down.' : `The set could not be loaded (HTTP ${res.status}). Try again in a moment.`)
      return
    }
    file = await res.json()
  } catch {
    fail(slug, 'The set could not be loaded. Check your connection and try again.')
    return
  }
  const doc = isSceneDoc(file) ? file : file.scene
  if (!isSceneDoc(doc)) {
    fail(slug, 'This set file is damaged and could not be opened.')
    return
  }
  // One undo step, like opening a setup, so the previous scene is one Undo away.
  loadScene(JSON.stringify(doc))
  const wanted = isSceneDoc(file) ? undefined : file.view
  const camera = wanted && wanted !== 'orbit' ? scene.items.find(i => i.kind === 'camera' && i.name === wanted) : undefined
  Object.assign(setLink, {
    title: (!isSceneDoc(file) && file.title) || source.title || slug,
    state: 'open',
    viewId: camera?.id ?? null
  })
  nav.view = 'live'
  track('Set opened', { set: slug, device: device() })
  watchFirstEdit(slug)
}

function fail(slug: string, message: string): void {
  Object.assign(setLink, { slug, state: 'failed', message })
  track('Set failed', { set: slug, device: device() })
}

// The conversion we care about: someone opened a set and then changed something in it.
let stopEditWatch: (() => void) | null = null
function watchFirstEdit(slug: string): void {
  stopEditWatch?.()
  const content = () => JSON.stringify([scene.walls, scene.openings, scene.rooms, scene.items, scene.world, scene.marks, scene.lineOfAction])
  let baseline = ''
  // Let anything the load itself sets up settle before taking the baseline.
  window.setTimeout(() => { baseline = content() }, 1500)
  let timer: number | undefined
  stopEditWatch = watch(() => [scene.walls, scene.openings, scene.rooms, scene.items, scene.world, scene.marks, scene.lineOfAction], () => {
    window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      if (!baseline || content() === baseline) return
      track('Set edited', { set: slug, device: device() })
      stopEditWatch?.()
      stopEditWatch = null
    }, 1000)
  }, { deep: true })
}

export function openSetFromUrl(): void {
  let slug: string | null = null
  try { slug = new URLSearchParams(window.location.search).get('set') } catch { slug = null }
  if (slug !== null) openSet(slug.trim().toLowerCase())
}

// The address to send to a laptop: this page with the set, keeping the campaign tags (so the laptop
// visit still counts for the post it came from) and marked via=phone (the hand-off worked).
export function setUrl(): string {
  const here = new URL(window.location.href)
  const url = new URL(here.href)
  url.search = ''
  url.hash = ''
  url.searchParams.set('set', setLink.slug)
  here.searchParams.forEach((value, key) => { if (key.startsWith('utm_')) url.searchParams.set(key, value) })
  url.searchParams.set('via', 'phone')
  return url.toString()
}
