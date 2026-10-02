import { reactive } from 'vue'
import { storage } from './storage'
import { Capture, CaptureKind, newRecordId, Production, SCHEMA_VERSION, Scene, Shot, stamp } from './types'

// Reactive view of all pre-production records (metadata only — images load lazily by id).
// Every mutation updates memory first, then writes through the storage adapter.

export const PANELS_PER_PAGE = 6

export const setups = reactive({
  ready: false,
  available: true,
  productions: [] as Production[],
  scenes: [] as Scene[],
  captures: [] as Capture[],
  // Image id → URL, filled on demand by imageUrl().
  urls: {} as { [id: string]: string }
})

let loading: Promise<void> | null = null
export function initSetups(): Promise<void> {
  if (!loading) {
    loading = (async () => {
      setups.available = await storage.available()
      if (setups.available) {
        const [productions, scenes, captures] = await Promise.all([storage.listProductions(), storage.listScenes(), storage.listCaptures()])
        setups.productions = productions.sort((a, b) => b.updatedAt - a.updatedAt)
        setups.scenes = scenes
        setups.captures = captures
      }
      setups.ready = true
    })()
  }
  return loading
}

// Failed writes (quota, private mode) must not break the editing session.
const persist = (work: Promise<unknown>) => work.catch(error => console.warn('Setups: could not save', error))
const touch = <T extends { updatedAt: number }>(record: T) => { record.updatedAt = Date.now(); return record }

// ── Lookups ─────────────────────────────────────────────────────────────
export const getProduction = (id: string | null) => setups.productions.find(p => p.id === id)
export const getScene = (id: string | null) => setups.scenes.find(s => s.id === id)
export const getCapture = (id: string | null) => setups.captures.find(c => c.id === id)

const byOrder = <T extends { id: string }>(list: T[], order: string[]) => {
  const rank = new Map(order.map((id, i) => [id, i]))
  return list.slice().sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
}
export const scenesOf = (production: Production) => byOrder(setups.scenes.filter(s => s.productionId === production.id), production.sceneOrder)
export const capturesOf = (scene: Scene, kind: CaptureKind) =>
  byOrder(setups.captures.filter(c => c.sceneId === scene.id && c.kind === kind), kind === 'setup' ? scene.setupOrder : scene.frameOrder)

export function imageUrl(id: string): string | undefined {
  if (!(id in setups.urls)) {
    setups.urls[id] = ''
    storage.getImageUrl(id).then(url => { if (url) setups.urls[id] = url })
  }
  return setups.urls[id] || undefined
}

export async function loadImageUrl(id: string): Promise<string | null> {
  const url = await storage.getImageUrl(id)
  if (url) setups.urls[id] = url
  return url
}

// ── Productions ─────────────────────────────────────────────────────────
export function createProduction(title: string): Production {
  const production: Production = { ...stamp(), title: title.trim() || 'Untitled production', sceneOrder: [] }
  setups.productions.unshift(production)
  persist(storage.saveProduction(production))
  return setups.productions[0]
}

export function markSample(production: Production, sampleId: string): void {
  production.sampleId = sampleId
  persist(storage.saveProduction(production))
}

export function updateProduction(production: Production, patch: Partial<Pick<Production, 'title' | 'sceneOrder'>>): void {
  Object.assign(production, patch)
  persist(storage.saveProduction(touch(production)))
}

export function deleteProduction(production: Production): void {
  const sceneIds = new Set(setups.scenes.filter(s => s.productionId === production.id).map(s => s.id))
  setups.captures = setups.captures.filter(c => !sceneIds.has(c.sceneId))
  setups.scenes = setups.scenes.filter(s => !sceneIds.has(s.id))
  setups.productions = setups.productions.filter(p => p.id !== production.id)
  persist(storage.deleteProduction(production.id))
}

// ── Scenes ──────────────────────────────────────────────────────────────
export type SceneFields = Pick<Scene, 'number' | 'setting' | 'location' | 'timeOfDay' | 'synopsis'>

export function createScene(production: Production, fields: SceneFields): Scene {
  const scene: Scene = {
    ...stamp(), productionId: production.id, ...fields,
    setupOrder: [], frameOrder: [], boardSlots: new Array(PANELS_PER_PAGE).fill(null)
  }
  setups.scenes.push(scene)
  persist(storage.saveScene(scene))
  updateProduction(production, { sceneOrder: [...production.sceneOrder, scene.id] })
  return setups.scenes[setups.scenes.length - 1]
}

export function updateScene(scene: Scene, patch: Partial<Scene>): void {
  Object.assign(scene, patch)
  persist(storage.saveScene(touch(scene)))
  const production = getProduction(scene.productionId)
  if (production) persist(storage.saveProduction(touch(production)))
}

export function deleteScene(scene: Scene): void {
  setups.captures = setups.captures.filter(c => c.sceneId !== scene.id)
  setups.scenes = setups.scenes.filter(s => s.id !== scene.id)
  const production = getProduction(scene.productionId)
  if (production) updateProduction(production, { sceneOrder: production.sceneOrder.filter(id => id !== scene.id) })
  persist(storage.deleteScene(scene.id))
}

// A sensible next scene number: one more than the highest numeric scene so far.
export function nextSceneNumber(production: Production): string {
  const numbers = scenesOf(production).map(s => parseInt(s.number, 10)).filter(n => Number.isFinite(n))
  return String(numbers.length ? Math.max(...numbers) + 1 : 1)
}

// ── Captures ────────────────────────────────────────────────────────────
export interface NewCapture {
  kind: CaptureKind
  name: string
  description: string
  image: Blob
  thumb: Blob
  sceneJson: string
  shot?: Shot
}

export function nextCaptureNumber(scene: Scene, kind: CaptureKind): string {
  const numbers = capturesOf(scene, kind).map(c => parseInt(c.number, 10)).filter(n => Number.isFinite(n))
  return String(numbers.length ? Math.max(...numbers) + 1 : 1)
}

export async function addCapture(scene: Scene, data: NewCapture): Promise<Capture> {
  const [imageId, thumbId] = await Promise.all([storage.putImage(data.image), storage.putImage(data.thumb)])
  const capture: Capture = {
    ...stamp(), sceneId: scene.id, kind: data.kind, number: nextCaptureNumber(scene, data.kind),
    name: data.name.trim(), description: data.description.trim(), starred: false, archived: false,
    imageId, thumbId, sceneJson: data.sceneJson, shot: data.shot
  }
  setups.captures.push(capture)
  await storage.saveCapture(capture)
  const key = data.kind === 'setup' ? 'setupOrder' : 'frameOrder'
  updateScene(scene, { [key]: [...scene[key], capture.id] })
  return setups.captures[setups.captures.length - 1]
}

export function updateCapture(capture: Capture, patch: Partial<Capture>): void {
  Object.assign(capture, patch)
  persist(storage.saveCapture(touch(capture)))
}

export function deleteCapture(capture: Capture): void {
  setups.captures = setups.captures.filter(c => c.id !== capture.id)
  const scene = getScene(capture.sceneId)
  if (scene) {
    updateScene(scene, {
      setupOrder: scene.setupOrder.filter(id => id !== capture.id),
      frameOrder: scene.frameOrder.filter(id => id !== capture.id),
      boardSlots: normaliseBoard(scene.boardSlots.map(id => (id === capture.id ? null : id)))
    })
  }
  persist(storage.deleteCapture(capture.id))
}

// New order for one kind of capture in a scene; optionally renumber 1, 2, 3… to match.
export function reorderCaptures(scene: Scene, kind: CaptureKind, order: string[], renumber: boolean): void {
  updateScene(scene, kind === 'setup' ? { setupOrder: order } : { frameOrder: order })
  if (!renumber) return
  capturesOf(scene, kind).forEach((c, i) => { if (c.number !== String(i + 1)) updateCapture(c, { number: String(i + 1) }) })
}

// ── Storyboard board ────────────────────────────────────────────────────
// Keep whole pages, plus exactly one empty page after the last page in use.
export function normaliseBoard(slots: Array<string | null>): Array<string | null> {
  let last = -1
  slots.forEach((id, i) => { if (id) last = i })
  const pagesUsed = last < 0 ? 0 : Math.floor(last / PANELS_PER_PAGE) + 1
  const length = (pagesUsed + 1) * PANELS_PER_PAGE
  return Array.from({ length }, (_, i) => slots[i] ?? null)
}

export function setBoard(scene: Scene, slots: Array<string | null>): void {
  updateScene(scene, { boardSlots: normaliseBoard(slots) })
}

// ── Export / import ─────────────────────────────────────────────────────
// One self-contained, versioned file per production (images inlined). The same format will
// carry local work into an account once accounts exist.
interface ExportFile {
  format: 'previs-production'
  schemaVersion: number
  exportedAt: number
  production: Production
  scenes: Scene[]
  captures: Capture[]
  images: { [id: string]: string }
}

const blobToDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result as string)
  reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(blob)
})

export async function exportProduction(production: Production): Promise<Blob> {
  const scenes = scenesOf(production)
  const sceneIds = new Set(scenes.map(s => s.id))
  const captures = setups.captures.filter(c => sceneIds.has(c.sceneId))
  const images: { [id: string]: string } = {}
  for (const c of captures) {
    for (const id of [c.imageId, c.thumbId]) {
      const blob = await storage.getImage(id)
      if (blob) images[id] = await blobToDataUrl(blob)
    }
  }
  const file: ExportFile = { format: 'previs-production', schemaVersion: SCHEMA_VERSION, exportedAt: Date.now(), production, scenes, captures, images }
  return new Blob([JSON.stringify(file)], { type: 'application/json' })
}

// Imports under fresh ids, so importing the same file twice gives two independent copies.
export async function importProduction(text: string): Promise<Production> {
  const file = JSON.parse(text) as ExportFile
  if (file.format !== 'previs-production') throw new Error('This is not a Previs production file.')
  if (file.schemaVersion > SCHEMA_VERSION) throw new Error('This file was made by a newer version of Previs.')
  const ids = new Map<string, string>()
  const remap = (id: string) => { if (!ids.has(id)) ids.set(id, newRecordId()); return ids.get(id) as string }
  const imageIds = new Map<string, string>()
  for (const [oldId, dataUrl] of Object.entries(file.images)) {
    const blob = await (await fetch(dataUrl)).blob()
    imageIds.set(oldId, await storage.putImage(blob))
  }
  const now = Date.now()
  const production: Production = { ...file.production, id: remap(file.production.id), sceneOrder: file.production.sceneOrder.map(remap), updatedAt: now }
  const scenes: Scene[] = file.scenes.map(s => ({
    ...s, id: remap(s.id), productionId: production.id,
    setupOrder: s.setupOrder.map(remap), frameOrder: s.frameOrder.map(remap),
    boardSlots: s.boardSlots.map(id => (id ? remap(id) : null))
  }))
  const captures: Capture[] = file.captures.map(c => ({
    ...c, id: remap(c.id), sceneId: remap(c.sceneId),
    imageId: imageIds.get(c.imageId) ?? c.imageId, thumbId: imageIds.get(c.thumbId) ?? c.thumbId
  }))
  for (const c of captures) await storage.saveCapture(c)
  for (const s of scenes) await storage.saveScene(s)
  await storage.saveProduction(production)
  setups.captures.push(...captures)
  setups.scenes.push(...scenes)
  setups.productions.unshift(production)
  return setups.productions[0]
}
