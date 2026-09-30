<template>
  <div class="library">
    <header>
      <strong>Lighting library</strong>
      <button class="close" @click="$emit('close')">✕</button>
    </header>
    <input ref="search" v-model="query" class="search" placeholder="Search fixtures (e.g. FC-, PavoTube, 60B)" />
    <nav class="tabs">
      <button v-for="(label, key) in categories" :key="key" :class="{ on: category === key }" @click="category = key">
        {{ label }} <span>{{ counts[key] }}</span>
      </button>
    </nav>
    <ul>
      <li v-for="fixture in results" :key="fixture.id" @click="$emit('pick', fixture.id)">
        <div class="row1">
          <span class="model">{{ fixture.model }}</span>
          <span v-if="fixture.brand !== 'Nanlite'" class="brand">{{ fixture.brand }}</span>
          <span v-if="fixture.approx" class="approx" title="Some specs are estimated">≈</span>
        </div>
        <div class="row2">
          {{ fixture.watts }}W · {{ colourLabels[fixture.colour] }}
          <template v-if="fixture.colour !== 'daylight'">{{ fixture.cct[0] }}–{{ fixture.cct[1] }}K</template>
          · {{ output(fixture) }}
          <template v-if="fixture.mount !== 'none'"> · {{ fixture.mount === 'fm' ? 'FM' : 'Bowens' }}</template>
        </div>
      </li>
      <li v-if="!results.length" class="none">No fixtures match “{{ query }}”.</li>
    </ul>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import { FIXTURES } from '../library/fixtures'
import { CATEGORY_LABELS, COLOUR_LABELS, Fixture, FixtureCategory } from '../library/types'

export default defineComponent({
  name: 'LightLibrary',
  emits: ['pick', 'close'],
  setup() {
    const query = ref('')
    const category = ref<FixtureCategory>('spot')
    const search = ref<HTMLInputElement | null>(null)

    const matches = computed(() => {
      const q = query.value.trim().toLowerCase()
      return q ? FIXTURES.filter(f => `${f.brand} ${f.family} ${f.model}`.toLowerCase().includes(q)) : FIXTURES
    })
    const counts = computed(() => {
      const result: Record<string, number> = {}
      matches.value.forEach(f => { result[f.category] = (result[f.category] || 0) + 1 })
      return result
    })
    const results = computed(() => matches.value.filter(f => f.category === category.value))
    // A search that finds nothing in the current tab jumps to the first tab that has results.
    watch(matches, list => {
      if (list.length && !list.some(f => f.category === category.value)) category.value = list[0].category
    })

    const output = (f: Fixture) => f.lumens
      ? `${f.lumens.toLocaleString()} lm`
      : `${f.luxAt1m.toLocaleString()} lux@1m`

    onMounted(() => search.value?.focus())

    return { query, category, search, results, counts, output, categories: CATEGORY_LABELS, colourLabels: COLOUR_LABELS }
  }
})
</script>

<style scoped>
.library {
  position: absolute;
  top: 56px;
  left: 12px;
  bottom: 48px;
  width: 360px;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
  z-index: 5;
  font-size: 13px;
}
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
}
.close { padding: 2px 8px; }
.search { margin: 0 12px 8px; }
.tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 12px 8px;
  border-bottom: 1px solid var(--line);
}
.tabs button { padding: 3px 8px; font-size: 12px; }
.tabs button span { color: var(--muted); }
.tabs button.on { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.tabs button.on span { color: #1a1a1a; }
ul {
  list-style: none;
  margin: 0;
  padding: 4px 0;
  overflow-y: auto;
  flex: 1;
}
li {
  padding: 8px 12px;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.03);
}
li:hover { background: #22242b; }
li.none { cursor: default; color: var(--muted); }
.row1 { display: flex; gap: 6px; align-items: center; }
.model { font-weight: 600; }
.brand { font-size: 11px; color: var(--accent); }
.approx {
  font-size: 11px;
  color: #1a1a1a;
  background: var(--muted);
  border-radius: 3px;
  padding: 0 4px;
}
.row2 { color: var(--muted); font-size: 12px; margin-top: 2px; }
</style>
