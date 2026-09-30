<template>
  <div class="page">
    <div class="head">
      <h2>Productions</h2>
      <div class="actions">
        <button @click="importFile">Import…</button>
        <button class="primary" @click="creating = true">＋ New production</button>
      </div>
    </div>

    <form v-if="creating" class="new" @submit.prevent="create">
      <input ref="titleInput" v-model="title" placeholder="Production title, e.g. “Night Shift” short film" />
      <button class="primary" type="submit">Create</button>
      <button type="button" @click="creating = false">Cancel</button>
    </form>

    <p v-if="!setups.productions.length && !creating" class="empty">
      No productions yet. Create one here, or capture a setup from the Floor Plan and create it from there.
    </p>

    <div class="grid">
      <button v-for="p in setups.productions" :key="p.id" class="card" @click="openSetups(p.id)">
        <b>{{ p.title }}</b>
        <span>{{ counts(p) }}</span>
        <small>Updated {{ when(p.updatedAt) }}</small>
      </button>
    </div>
    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script lang="ts">
import { defineComponent, nextTick, ref, watch } from 'vue'
import { openSetups } from '../../nav'
import { createProduction, importProduction, scenesOf, setups } from '../store'
import { Production } from '../types'
import { when } from './format'

export default defineComponent({
  name: 'ProductionList',
  setup() {
    const creating = ref(false)
    const title = ref('')
    const error = ref('')
    const titleInput = ref<HTMLInputElement | null>(null)
    watch(creating, async on => { if (on) { await nextTick(); titleInput.value?.focus() } })

    const create = () => {
      const p = createProduction(title.value)
      title.value = ''
      creating.value = false
      openSetups(p.id)
    }
    const counts = (p: Production) => {
      const scenes = scenesOf(p)
      const ids = new Set(scenes.map(s => s.id))
      const setupsCount = setups.captures.filter(c => ids.has(c.sceneId) && c.kind === 'setup').length
      const frames = setups.captures.filter(c => ids.has(c.sceneId) && c.kind === 'frame').length
      return `${scenes.length} scene${scenes.length === 1 ? '' : 's'} · ${setupsCount} setup${setupsCount === 1 ? '' : 's'} · ${frames} frame${frames === 1 ? '' : 's'}`
    }
    const importFile = () => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,application/json'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) return
        error.value = ''
        try {
          const p = await importProduction(await file.text())
          openSetups(p.id)
        } catch (e) {
          error.value = e instanceof Error ? e.message : 'Could not import that file.'
        }
      }
      input.click()
    }
    return { setups, creating, title, titleInput, error, create, counts, when, openSetups, importFile }
  }
})
</script>

<style scoped>
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
.card { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; padding: 16px; text-align: left; background: var(--panel); border-radius: 10px; }
.card:hover { border-color: var(--accent); background: var(--panel); }
.card b { font-size: 16px; }
.card span { color: var(--text); font-size: 13px; }
.card small { color: var(--muted); }
.new { display: flex; gap: 8px; margin-bottom: 16px; }
.new input { flex: 1; }
</style>
