<template>
  <div ref="bar" :class="['plan-toolbar', { compact }]">
    <div class="segmented" role="radiogroup" aria-label="Pointer or hand">
      <button role="radio" :aria-checked="tool === 'select'" :class="['tb', 'icon', { on: tool === 'select' }]" title="Pointer: select and move (V)" @click="$emit('tool', 'select')">
        <svg viewBox="0 0 24 24"><path :d="ICONS.select" /></svg>
      </button>
      <button role="radio" :aria-checked="tool === 'pan'" :class="['tb', 'icon', { on: tool === 'pan' }]" title="Hand: drag to move the map (H)" @click="$emit('tool', 'pan')">
        <svg viewBox="0 0 24 24"><path :d="ICONS.hand" /></svg>
      </button>
    </div>

    <div ref="menuRoot" class="menu-root">
      <button :class="['tb', 'elements', { on: open || placing }]" :aria-expanded="open" aria-haspopup="menu" title="Add room elements, subjects, lights and cameras" @click="toggle">
        <svg viewBox="0 0 24 24"><path :d="ICONS.plus" /></svg><span>Elements</span>
        <svg class="caret" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5" /></svg>
      </button>
      <div v-if="open" ref="menu" class="menu" role="menu" @keydown="onMenuKey">
        <section v-for="section in sections" :key="section.title">
          <h6>{{ section.title }}</h6>
          <button
            v-for="item in section.items"
            :key="item.id"
            role="menuitem"
            :class="['item', { on: item.tool === tool }]"
            @click="choose(item)"
          >
            <svg viewBox="0 0 24 24"><path :d="ICONS[item.icon]" /></svg>
            <span class="text"><b>{{ item.label }}</b><small>{{ item.hint }}</small></span>
            <kbd v-if="item.key">{{ item.key }}</kbd>
          </button>
        </section>
      </div>
    </div>

    <button :class="['tb', { on: tool === 'measure' }]" title="Measure (M)" @click="$emit('tool', 'measure')">
      <svg viewBox="0 0 24 24"><path :d="ICONS.measure" /></svg><span>Measure</span>
    </button>

    <div class="chip-slot">
      <span v-if="placing" class="chip">
        {{ tool === 'measure' ? 'Measuring' : `Placing: ${placingLabel}` }} · <button class="cancel" @click="$emit('tool', 'select')">Esc to cancel</button>
      </span>
    </div>

    <button class="tb icon" title="Undo (⌘Z)" @click="$emit('undo')"><svg viewBox="0 0 24 24"><path :d="ICONS.undo" /></svg></button>
    <button class="tb icon" title="Redo (⇧⌘Z)" @click="$emit('redo')"><svg viewBox="0 0 24 24"><path :d="ICONS.redo" /></svg></button>
    <button class="tb icon" title="Fit plan to view (F)" @click="$emit('fit')"><svg viewBox="0 0 24 24"><path :d="ICONS.fit" /></svg></button>
    <span class="sep"></span>
    <button :class="['tb', 'loa', { on: lineOn }]" :aria-pressed="lineOn" title="Show / hide the 180° line (L)" @click="$emit('line')">
      <svg viewBox="0 0 24 24"><path :d="ICONS.line" /></svg><span>180°</span>
    </button>
    <button class="tb capture" title="Capture this setup to a production (C)" @click="$emit('capture')">
      <svg viewBox="0 0 24 24"><path :d="ICONS.capture" /></svg><span>Capture</span>
    </button>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { scene } from '../scene/store'
import { library } from '../props/add'
import { getDef } from '../props/catalog'

// Line icons (24×24, stroked).
const ICONS: Record<string, string> = {
  select: 'M5 3l13 8-6 1.5L9.5 19z',
  plus: 'M12 5v14M5 12h14',
  hand: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12M11 11V4.5a1.5 1.5 0 0 1 3 0V12M14 11.5V6a1.5 1.5 0 0 1 3 0v8c0 4-2.5 7-6.5 7-3 0-4.6-1.6-6-4l-2-3.6a1.4 1.4 0 0 1 2.3-1.6L8 15',
  measure: 'M3 16l13-13 5 5-13 13zM7 12l2 2M10 9l2 2M13 6l2 2',
  room: 'M4 4h16v16H4z',
  wall: 'M3 10h18v4H3z',
  door: 'M5 20V5h7M5 20h14M12 5a8 8 0 0 1 7 8',
  window: 'M3 9h18M3 15h18M3 9v6M21 9v6',
  doorway: 'M3 12h6M15 12h6M9 9v6M15 9v6',
  subject: 'M12 8a3 3 0 1 0 0-.01M6 20c0-4 3-6 6-6s6 2 6 6',
  light: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z',
  camera: 'M3 8h11v9H3zM14 11l7-3v9l-7-3',
  undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5M20 9H10a6 6 0 0 0 0 12h3',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  marks: 'M5 6h14M12 6v12M5 20l2-2M17 20l2-2',
  sofa: 'M4 11V8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v3M3 11h18v6H3zM5 17v2M19 17v2M7 11v3h10v-3',
  line: 'M3 18L21 6M7 20a2 2 0 1 0 0-.01M17 6a2 2 0 1 0 0-.01',
  capture: 'M4 8h3l2-3h6l2 3h3v11H4zM12 16.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z'
}

interface MenuItem {
  id: string
  label: string
  hint: string
  icon: string
  key?: string
  tool?: string // a placing tool to switch to
  add?: string // or something to add straight away ('subject', 'camera', 'light', 'props', 'prop:<id>')
}

// Data-driven so new sections (e.g. Furniture) slot in without layout changes.
const SECTIONS: Array<{ title: string; items: MenuItem[] }> = [
  {
    title: 'Room elements',
    items: [
      { id: 'room', label: 'Room', hint: 'Drag a rectangle: walls + floor', icon: 'room', key: 'R', tool: 'room' },
      { id: 'wall', label: 'Wall', hint: 'Click to place, then drag its ends', icon: 'wall', key: 'W', tool: 'wall' },
      { id: 'door', label: 'Door', hint: 'Click on a wall', icon: 'door', key: 'D', tool: 'door' },
      { id: 'window', label: 'Window', hint: 'Click on a wall', icon: 'window', key: 'N', tool: 'window' },
      { id: 'opening', label: 'Doorway', hint: 'An opening with no door', icon: 'doorway', key: 'O', tool: 'opening' }
    ]
  },
  {
    title: 'On set',
    items: [
      { id: 'subject', label: 'Subject', hint: 'A person in the scene', icon: 'subject', add: 'subject' },
      { id: 'light', label: 'Light…', hint: 'Choose from the Nanlite library', icon: 'light', add: 'light' },
      { id: 'camera', label: 'Camera', hint: 'Sony FX3 with Aizu primes', icon: 'camera', add: 'camera' },
      { id: 'marks', label: 'Blocking marks', hint: 'T marks for a subject or camera', icon: 'marks', key: 'K', tool: 'marks' }
    ]
  },
  {
    title: 'Set dressing',
    items: [
      { id: 'props', label: 'Props library…', hint: 'Furniture, decor, plants, practicals — by room', icon: 'sofa', key: 'J', add: 'props' }
    ]
  }
]

const LABELS: Record<string, string> = { room: 'Room', wall: 'Wall', door: 'Door', window: 'Window', opening: 'Doorway', line: '180° line', marks: 'Blocking marks' }

export default defineComponent({
  name: 'PlanToolbar',
  props: {
    tool: { type: String, required: true }
  },
  emits: ['tool', 'add', 'undo', 'redo', 'fit', 'capture', 'line'],
  setup(props, { emit }) {
    const open = ref(false)
    const bar = ref<HTMLDivElement | null>(null)
    const menu = ref<HTMLDivElement | null>(null)
    const menuRoot = ref<HTMLDivElement | null>(null)
    const compact = ref(false)

    const placing = computed(() => props.tool !== 'select' && props.tool !== 'pan')
    const lineOn = computed(() => !!scene.lineOfAction?.visible)
    // Set dressing also lists the props used most recently, for one-click re-adding.
    const sections = computed(() => SECTIONS.map(sec => (sec.title !== 'Set dressing' ? sec : {
      ...sec,
      items: [...sec.items, ...library.recent.slice(0, 5).map(id => getDef(id)).filter(d => !!d).map(d => ({
        id: `prop:${d?.id}`, label: d?.name ?? '', hint: 'Recently used', icon: 'sofa', add: `prop:${d?.id}`
      }))]
    })))
    const placingLabel = computed(() => LABELS[props.tool] ?? '')

    const focusItem = (index: number) => {
      const items = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.item') ?? [])
      if (items.length) items[(index + items.length) % items.length].focus()
    }
    const toggle = async () => {
      open.value = !open.value
      if (open.value) {
        await nextTick()
        focusItem(0)
      }
    }
    const choose = (item: MenuItem) => {
      open.value = false
      if (item.tool) emit('tool', item.tool)
      else if (item.add) emit('add', item.add)
    }
    const onMenuKey = (event: KeyboardEvent) => {
      const items = Array.from(menu.value?.querySelectorAll<HTMLButtonElement>('.item') ?? [])
      const i = items.indexOf(document.activeElement as HTMLButtonElement)
      if (event.key === 'ArrowDown') focusItem(i + 1)
      else if (event.key === 'ArrowUp') focusItem(i - 1)
      else if (event.key === 'Escape') open.value = false
      else return
      // Keep the plan's own shortcuts (Esc clears the selection) from firing while in the menu.
      event.preventDefault()
      event.stopPropagation()
    }
    const onOutside = (event: PointerEvent) => {
      if (open.value && menuRoot.value && !menuRoot.value.contains(event.target as Node)) open.value = false
    }

    // Collapse labels to icons when the plan area is narrow, so the bar never wraps.
    let observer: ResizeObserver | null = null
    onMounted(() => {
      document.addEventListener('pointerdown', onOutside)
      observer = new ResizeObserver(() => { compact.value = (bar.value?.parentElement?.clientWidth ?? 800) < 560 })
      if (bar.value?.parentElement) observer.observe(bar.value.parentElement)
    })
    onBeforeUnmount(() => {
      document.removeEventListener('pointerdown', onOutside)
      observer?.disconnect()
    })

    return { open, bar, menu, menuRoot, compact, placing, placingLabel, lineOn, sections, toggle, choose, onMenuKey, ICONS }
  }
})
</script>

<style scoped>
.plan-toolbar {
  position: absolute;
  top: 10px;
  left: 10px;
  right: 10px;
  z-index: 6;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: rgba(23, 24, 28, 0.94);
  border: 1px solid var(--line);
  border-radius: 9px;
  white-space: nowrap;
}
.tb {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: transparent;
  padding: 5px 9px;
  font-size: 13px;
  border-radius: 6px;
}
.tb:hover { background: #2c2f37; }
.tb.on { background: var(--accent); color: #1a1a1a; }
.tb.icon { padding: 5px 7px; }
.segmented { display: flex; gap: 1px; padding: 1px; background: #121317; border: 1px solid var(--line); border-radius: 7px; }
.segmented .tb { border-radius: 5px; }
.sep { width: 1px; align-self: stretch; margin: 4px 4px; background: var(--line); }
.tb.capture { color: var(--accent); }
.tb.capture:hover { background: rgba(255, 181, 71, 0.12); }
svg { width: 16px; height: 16px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; flex-shrink: 0; }
.caret { width: 12px; height: 12px; margin-left: -2px; opacity: 0.7; }
.compact .tb > span { display: none; }
.chip-slot { flex: 1; min-width: 0; display: flex; justify-content: center; overflow: hidden; }
.chip {
  font-size: 12px;
  color: var(--accent);
  background: rgba(255, 181, 71, 0.1);
  border: 1px solid rgba(255, 181, 71, 0.35);
  border-radius: 12px;
  padding: 2px 10px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cancel { border: none; background: none; padding: 0; color: var(--muted); font-size: 12px; text-decoration: underline; }
.compact .chip { font-size: 11px; padding: 2px 6px; }

.menu-root { position: relative; }
.menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 280px;
  padding: 6px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5);
  white-space: normal;
}
.menu section + section { margin-top: 4px; padding-top: 4px; border-top: 1px solid var(--line); }
.menu h6 { margin: 6px 8px 4px; font-size: 10px; letter-spacing: 1.2px; text-transform: uppercase; color: var(--muted); }
.item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 8px;
  border: none;
  background: transparent;
  border-radius: 6px;
  text-align: left;
}
.item:hover, .item:focus-visible { background: #2c2f37; outline: none; }
.item.on { background: rgba(255, 181, 71, 0.15); }
.item svg { width: 18px; height: 18px; color: var(--accent); }
.text { flex: 1; display: flex; flex-direction: column; }
.text b { font-weight: 500; font-size: 13px; }
.text small { font-size: 11px; color: var(--muted); }
kbd { font-family: inherit; font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 4px; padding: 0 5px; }
</style>
