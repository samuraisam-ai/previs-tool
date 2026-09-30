import { Capture, newRecordId, Production, Scene } from '../types'
import { SetupsStorage } from './SetupsStorage'

// Local adapter: everything lives in this browser's IndexedDB (images as Blobs, so hundreds of
// captures fit comfortably, unlike localStorage).

const DB_NAME = 'previs-setups'
const VERSION = 1
type StoreName = 'productions' | 'scenes' | 'captures' | 'blobs'

const promisify = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result)
  request.onerror = () => reject(request.error)
})

export class IndexedDbStorage implements SetupsStorage {
  readonly kind = 'indexeddb'
  private db: Promise<IDBDatabase> | null = null
  private urls = new Map<string, string>()

  private open(): Promise<IDBDatabase> {
    if (!this.db) {
      this.db = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, VERSION)
        request.onupgradeneeded = () => {
          const db = request.result
          if (!db.objectStoreNames.contains('productions')) db.createObjectStore('productions', { keyPath: 'id' })
          if (!db.objectStoreNames.contains('scenes')) db.createObjectStore('scenes', { keyPath: 'id' }).createIndex('productionId', 'productionId')
          if (!db.objectStoreNames.contains('captures')) db.createObjectStore('captures', { keyPath: 'id' }).createIndex('sceneId', 'sceneId')
          if (!db.objectStoreNames.contains('blobs')) db.createObjectStore('blobs')
        }
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })
      this.db.catch(() => { this.db = null })
    }
    return this.db
  }

  private async tx<T>(name: StoreName, mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open()
    return promisify(run(db.transaction(name, mode).objectStore(name)))
  }

  async available(): Promise<boolean> {
    try {
      if (typeof indexedDB === 'undefined') return false
      await this.open()
      return true
    } catch { return false }
  }

  listProductions = () => this.tx<Production[]>('productions', 'readonly', s => s.getAll())
  listScenes = () => this.tx<Scene[]>('scenes', 'readonly', s => s.getAll())
  listCaptures = () => this.tx<Capture[]>('captures', 'readonly', s => s.getAll())

  // Vue proxies can't be structured-cloned; store plain copies.
  private plain = <T>(value: T): T => JSON.parse(JSON.stringify(value))
  saveProduction = async (p: Production) => { await this.tx('productions', 'readwrite', s => s.put(this.plain(p))) }
  saveScene = async (sc: Scene) => { await this.tx('scenes', 'readwrite', s => s.put(this.plain(sc))) }
  saveCapture = async (c: Capture) => { await this.tx('captures', 'readwrite', s => s.put(this.plain(c))) }

  async deleteCapture(id: string): Promise<void> {
    const capture = await this.tx<Capture | undefined>('captures', 'readonly', s => s.get(id))
    if (capture) {
      await this.deleteImage(capture.imageId)
      await this.deleteImage(capture.thumbId)
    }
    await this.tx('captures', 'readwrite', s => s.delete(id))
  }

  async deleteScene(id: string): Promise<void> {
    const captures = await this.tx<Capture[]>('captures', 'readonly', s => s.index('sceneId').getAll(id))
    for (const c of captures) await this.deleteCapture(c.id)
    await this.tx('scenes', 'readwrite', s => s.delete(id))
  }

  async deleteProduction(id: string): Promise<void> {
    const scenes = await this.tx<Scene[]>('scenes', 'readonly', s => s.index('productionId').getAll(id))
    for (const sc of scenes) await this.deleteScene(sc.id)
    await this.tx('productions', 'readwrite', s => s.delete(id))
  }

  async putImage(blob: Blob): Promise<string> {
    const id = newRecordId()
    await this.tx('blobs', 'readwrite', s => s.put(blob, id))
    return id
  }

  async getImage(id: string): Promise<Blob | null> {
    return (await this.tx<Blob | undefined>('blobs', 'readonly', s => s.get(id))) ?? null
  }

  async getImageUrl(id: string): Promise<string | null> {
    const cached = this.urls.get(id)
    if (cached) return cached
    const blob = await this.getImage(id)
    if (!blob) return null
    const url = URL.createObjectURL(blob)
    this.urls.set(id, url)
    return url
  }

  async deleteImage(id: string): Promise<void> {
    const url = this.urls.get(id)
    if (url) { URL.revokeObjectURL(url); this.urls.delete(id) }
    await this.tx('blobs', 'readwrite', s => s.delete(id))
  }
}
