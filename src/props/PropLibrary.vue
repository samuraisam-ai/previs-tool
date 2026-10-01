<template>
  <div class="prop-library" role="dialog" aria-label="Props library" @keydown.esc.stop="$emit('close')">
    <header>
      <strong>Set dressing</strong>
      <input ref="search" v-model="query" class="search" placeholder="Search props (bed, lamp, rug, plant…)" />
      <button class="close" title="Close (Esc)" @click="$emit('close')">✕</button>
    </header>
    <div class="body">
      <nav class="rail" aria-label="Library sections">
        <button v-for="s in TOP" :key="s.id" :class="{ on: section === s.id && !query }" @click="pick(s.id)">
          {{ s.label }} <span>{{ count(s.id) }}</span>
        </button>
        <div class="heading">Rooms</div>
        <button v-for="s in ROOMS" :key="s.id" :class="{ on: section === s.id && !query }" @click="pick(s.id)">
          {{ s.label }} <span>{{ count(s.id) }}</span>
        </button>
        <div class="heading">Everywhere</div>
        <button v-for="s in GROUPS" :key="s.id" :class="{ on: section === s.id && !query }" @click="pick(s.id)">
          {{ s.label }} <span>{{ count(s.id) }}</span>
        </button>
      </nav>
      <div class="grid-wrap">
        <p v-if="!results.length" class="none">{{ emptyText }}</p>
        <div class="grid">
          <div v-for="def in results" :key="def.id" class="card" :title="`Add ${def.name}`" @click="$emit('pick', def.id)">
            <div class="art"><PropThumb :def="def" /></div>
            <div class="meta">
              <b>{{ def.name }}</b>
              <small>{{ size(def) }}</small>
            </div>
            <button :class="['fav', { on: library.favourites.includes(def.id) }]" :title="library.favourites.includes(def.id) ? 'Remove from favourites' : 'Add to favourites'" @click.stop="toggleFavourite(def.id)">★</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref } from 'vue'
import { library, toggleFavourite } from './add'
import { CATALOG, defsFor, getDef, searchDefs } from './catalog'
import PropThumb from './PropThumb.vue'
import { Category, GROUPS, PropDef, ROOMS } from './types'

type Section = Category | 'all' | 'recent' | 'favourites'
const TOP: Array<{ id: Section; label: string }> = [
  { id: 'favourites', label: '★ Favourites' }, { id: 'recent', label: 'Recent' }, { id: 'all', label: 'All props' }
]

// Remember the last section between openings (per session).
let lastSection: Section = 'bedroom'

export default defineComponent({
  name: 'PropLibrary',
  components: { PropThumb },
  emits: ['pick', 'close'],
  setup() {
    const search = ref<HTMLInputElement | null>(null)
    const query = ref('')
    const section = ref<Section>(lastSection)
    const pick = (s: Section) => { section.value = s; lastSection = s; query.value = '' }
    const listFor = (s: Section): PropDef[] => {
      if (s === 'all') return CATALOG
      if (s === 'recent') return library.recent.map(getDef).filter((d): d is PropDef => !!d)
      if (s === 'favourites') return library.favourites.map(getDef).filter((d): d is PropDef => !!d)
      return defsFor(s)
    }
    const results = computed(() => (query.value.trim() ? searchDefs(query.value) : listFor(section.value)))
    const count = (s: Section) => listFor(s).length
    const size = (d: PropDef) => `${d.size.w.toFixed(2)} × ${d.size.d.toFixed(2)} × ${d.size.h.toFixed(2)} m`
    const emptyText = computed(() => {
      if (query.value.trim()) return `Nothing matches “${query.value}”. Try a Build piece — a box, cylinder or panel of any size and material.`
      if (section.value === 'favourites') return 'Star (★) props to keep them here.'
      if (section.value === 'recent') return 'Props you add will appear here.'
      return 'Nothing here yet.'
    })
    onMounted(() => search.value?.focus())
    return { search, query, section, pick, results, count, size, emptyText, library, toggleFavourite, ROOMS, GROUPS, TOP }
  }
})
</script>

<style scoped>
.prop-library { position: absolute; top: 56px; left: 12px; bottom: 48px; width: min(720px, calc(100% - 24px)); display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--line); border-radius: 10px; box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5); z-index: 7; font-size: 13px; }
header { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-bottom: 1px solid var(--line); }
header strong { white-space: nowrap; }
.search { flex: 1; min-width: 0; }
.close { padding: 2px 8px; }
.body { flex: 1; min-height: 0; display: flex; }
.rail { width: 170px; flex-shrink: 0; overflow-y: auto; padding: 8px 6px; border-right: 1px solid var(--line); display: flex; flex-direction: column; gap: 1px; }
.rail button { display: flex; justify-content: space-between; align-items: center; border: none; background: none; text-align: left; padding: 5px 8px; border-radius: 6px; font-size: 12.5px; }
.rail button:hover { background: #23252c; }
.rail button.on { background: rgba(255, 181, 71, 0.14); color: var(--accent); }
.rail button span { font-size: 11px; color: var(--muted); }
.heading { margin: 10px 8px 3px; font-size: 10px; letter-spacing: 1.1px; text-transform: uppercase; color: var(--muted); }
.grid-wrap { flex: 1; min-width: 0; overflow-y: auto; padding: 10px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; }
.card { position: relative; border: 1px solid var(--line); border-radius: 8px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 4px; background: #1b1c21; }
.card:hover { border-color: var(--accent); }
.art { height: 86px; padding: 4px; background: #15161a; border-radius: 6px; }
.meta { display: flex; flex-direction: column; gap: 1px; padding: 0 2px; }
.meta b { font-weight: 500; font-size: 12.5px; }
.meta small { color: var(--muted); font-size: 10.5px; }
.fav { position: absolute; top: 6px; right: 6px; border: none; background: none; padding: 0 4px; color: #4a4d56; font-size: 14px; }
.fav:hover, .fav.on { color: var(--accent); background: none; }
.none { color: var(--muted); padding: 20px; line-height: 1.5; }
@media (max-width: 640px) {
  .rail { width: 120px; }
}
</style>
