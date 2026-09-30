import { Capture, Production, Scene } from '../types'

// The only contract the app uses to persist productions, scenes, captures and images.
// Everything is async so a network backend (accounts + a secure server database, cloud image
// storage) can replace the local IndexedDB adapter by implementing this interface; nothing else
// in the app touches storage directly.
export interface SetupsStorage {
  readonly kind: string
  available(): Promise<boolean>

  listProductions(): Promise<Production[]>
  listScenes(): Promise<Scene[]>
  listCaptures(): Promise<Capture[]>

  saveProduction(p: Production): Promise<void>
  saveScene(s: Scene): Promise<void>
  saveCapture(c: Capture): Promise<void>

  // Deletes cascade: a production takes its scenes, a scene its captures, a capture its images.
  deleteProduction(id: string): Promise<void>
  deleteScene(id: string): Promise<void>
  deleteCapture(id: string): Promise<void>

  putImage(blob: Blob): Promise<string>
  getImage(id: string): Promise<Blob | null>
  // An object URL locally; a signed URL from a server later.
  getImageUrl(id: string): Promise<string | null>
  deleteImage(id: string): Promise<void>
}
