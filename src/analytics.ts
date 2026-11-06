import { track as vercelTrack } from '@vercel/analytics'
import type { PostHog, Properties } from 'posthog-js'
import { watch } from 'vue'
import { nav } from './nav'
import { isPhone } from './phone'
import { editor } from './plan/editor'
import { playback } from './plan/blocking'
import { snapshotScene } from './plan/history'
import { scene } from './scene/store'
import { SceneItem } from './scene/types'

// Every product event goes through track() here, so where events are sent can change in one place.
// Vercel Web Analytics counts page views (and custom events on paid plans). PostHog gets every
// event plus session replays, once a project key is set in .env (VUE_APP_POSTHOG_KEY; the key is
// public by design, it ships in the page). Without a key, or in development, PostHog stays off.
// No cookies: PostHog keeps its anonymous visitor id in localStorage.

const KEY = process.env.VUE_APP_POSTHOG_KEY ?? ''
const HOST = process.env.VUE_APP_POSTHOG_HOST || 'https://eu.i.posthog.com'
const ENABLED = !!KEY && (process.env.NODE_ENV === 'production' || process.env.VUE_APP_POSTHOG_DEV === '1')

let posthog: PostHog | null = null
// Events tracked before PostHog has loaded (it loads after the app, to keep start-up fast).
const queue: Array<[string, Properties]> = []

const device = () => (isPhone.value ? 'phone' : window.matchMedia('(pointer: coarse)').matches ? 'tablet' : 'desktop')

export function track(event: string, props: Properties = {}): void {
  vercelTrack(event, props as Record<string, string | number | boolean | null>)
  if (EDITS.has(event)) edited = true
  if (!ENABLED) return
  if (posthog) posthog.capture(event, props)
  else queue.push([event, props])
  if (event === 'Capture saved' || event === 'Production exported') shareSet(event)
}

// ── What people build ────────────────────────────────────────────────────
// The set itself (walls, rooms, props, lights, cameras, cast; never uploaded images or setup notes)
// goes to PostHog when someone captures or exports, or leaves after building something, so it can
// be opened in Previs later. PostHog only (it's too big for Vercel's events), once per distinct set.
const EDITS = new Set(['Item added', 'Tool picked', 'Set edited', 'Capture saved', 'Production exported'])
const MAX_SET_CHARS = 300000
let edited = false
let lastShared = ''
function shareSet(reason: string): void {
  if (!ENABLED || !posthog || !edited) return
  const json = snapshotScene()
  if (json === lastShared || json.length > MAX_SET_CHARS) return
  lastShared = json
  const count = (kind: string) => scene.items.filter(i => i.kind === kind).length
  posthog.capture('Set built', {
    reason, scene: json, rooms: scene.rooms.length, walls: scene.walls.length,
    props: count('prop'), lights: count('light'), cameras: count('camera'), cast: count('subject')
  }, reason === 'left' ? { transport: 'sendBeacon' } : undefined)
}

// Facts about this visitor's setup that should ride along with every event (e.g. the GPU tier).
export function setContext(props: Properties): void {
  if (!ENABLED) return
  if (posthog) posthog.register(props)
  else queue.push(['$register', props])
}

export function initAnalytics(): void {
  if (ENABLED) {
    import('posthog-js').then(({ default: ph }) => {
      ph.init(KEY, {
        api_host: HOST,
        // PostHog's recommended settings as of this date; the options below override them.
        defaults: '2026-05-30',
        persistence: 'localStorage',
        // Visitors are anonymous; no person profiles unless we ever add accounts.
        person_profiles: 'identified_only',
        capture_pageview: true,
        autocapture: true,
        capture_exceptions: true,
        session_recording: { maskAllInputs: true }
      })
      ph.register({ device: device() })
      posthog = ph
      for (const [event, props] of queue.splice(0)) {
        if (event === '$register') ph.register(props)
        else ph.capture(event, props)
      }
    }).catch(() => { /* blocked by an ad blocker or offline: the app works the same */ })
  }
  watchApp()
}

// App-wide events, gathered here so the views stay free of tracking code.
function watchApp(): void {
  watch(() => nav.view, view => track('View opened', { view }))
  watch(() => editor.tool, tool => { if (tool !== 'select') track('Tool picked', { tool }) })
  watch(() => playback.playing, playing => { if (playing) track('Blocking played', { marks: scene.marks.length }) })
  watch(() => editor.dragging, dragging => { if (dragging) edited = true })
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') shareSet('left') })

  // Things added to the set. A burst (opening a set, a sample or the demo house) counts as one load.
  let known = new Set(scene.items.map(i => i.id))
  watch(() => scene.items.length, () => {
    const added = scene.items.filter(i => !known.has(i.id))
    known = new Set(scene.items.map(i => i.id))
    if (!added.length) return
    if (added.length > 3) { track('Scene loaded', { items: scene.items.length, walls: scene.walls.length }); return }
    added.forEach(item => track('Item added', describe(item)))
  })
}

function describe(item: SceneItem): Properties {
  switch (item.kind) {
    case 'light': return { kind: 'light', fixture: item.props.fixtureId, modifier: item.props.modifierId }
    case 'camera': return { kind: 'camera', lens: item.props.lensId }
    case 'prop': return { kind: 'prop', prop: item.props.catalogId }
    default: return { kind: item.kind }
  }
}
