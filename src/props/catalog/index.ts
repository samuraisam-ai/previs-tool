import { Category, PropDef } from '../types'
import { BEDROOM } from './bedroom'

// Every catalogue prop. Each file adds a room or category's worth of items.
export const CATALOG: PropDef[] = [...BEDROOM]

const byId = new Map(CATALOG.map(d => [d.id, d]))
export const getDef = (id: string): PropDef | undefined => byId.get(id)

// Items in a library section: their main category, or any room they're tagged with.
export function defsFor(section: Category): PropDef[] {
  return CATALOG.filter(d => d.category === section || (d.rooms as string[]).includes(section))
}

export function searchDefs(query: string): PropDef[] {
  const q = query.trim().toLowerCase()
  if (!q) return CATALOG
  return CATALOG.filter(d => [d.name, d.category, ...d.rooms, ...(d.keywords ?? [])].some(s => s.toLowerCase().includes(q)))
}
