import { ref } from 'vue'

// Drag-to-reorder for a list of ids using native HTML drag and drop.
// `commit` receives the new order when an item is dropped onto another.
export function useReorder(ids: () => string[], commit: (order: string[]) => void) {
  const dragging = ref<string | null>(null)
  const over = ref<string | null>(null)

  const onDragStart = (id: string, event: DragEvent) => {
    dragging.value = id
    event.dataTransfer?.setData('text/plain', id)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }
  const onDragOver = (id: string, event: DragEvent) => {
    if (!dragging.value) return
    event.preventDefault()
    over.value = id
  }
  const onDrop = (id: string) => {
    const from = dragging.value
    dragging.value = null
    over.value = null
    if (!from || from === id) return
    const order = ids().filter(x => x !== from)
    order.splice(order.indexOf(id) + (ids().indexOf(from) < ids().indexOf(id) ? 1 : 0), 0, from)
    commit(order)
  }
  const onDragEnd = () => { dragging.value = null; over.value = null }
  // Keyboard/touch alternative: nudge one place earlier or later.
  const move = (id: string, delta: number) => {
    const order = ids().slice()
    const i = order.indexOf(id)
    const j = i + delta
    if (i < 0 || j < 0 || j >= order.length) return
    order.splice(i, 1)
    order.splice(j, 0, id)
    commit(order)
  }

  return { dragging, over, onDragStart, onDragOver, onDrop, onDragEnd, move }
}
