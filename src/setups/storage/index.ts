import { IndexedDbStorage } from './IndexedDbStorage'
import { SetupsStorage } from './SetupsStorage'

// Swap this for an account-backed adapter (e.g. ApiStorage) when accounts arrive.
export const storage: SetupsStorage = new IndexedDbStorage()
export type { SetupsStorage }
