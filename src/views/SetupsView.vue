<template>
  <div class="setups">
    <nav class="crumbs" aria-label="Breadcrumb">
      <button :class="{ here: !production }" @click="openSetups()">Productions</button>
      <template v-if="production">
        <span>›</span>
        <button :class="{ here: !scene }" @click="openSetups(production.id)">{{ production.title }}</button>
      </template>
      <template v-if="production && scene">
        <span>›</span>
        <button class="here">Scene {{ scene.number }}</button>
      </template>
    </nav>

    <div v-if="!setups.available" class="notice">
      Setups can't be saved in this browser mode (private window or site storage blocked). You can still use the Floor Plan and Live View.
    </div>
    <div v-else-if="!setups.ready" class="notice">Loading…</div>
    <ScenePage v-else-if="production && scene" :key="scene.id" :scene="scene" />
    <ProductionPage v-else-if="production" :key="production.id" :production="production" />
    <ProductionList v-else />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import { nav, openSetups } from '../nav'
import ProductionList from '../setups/components/ProductionList.vue'
import ProductionPage from '../setups/components/ProductionPage.vue'
import ScenePage from '../setups/components/ScenePage.vue'
import '../setups/components/setups.css'
import { getProduction, getScene, setups } from '../setups/store'

export default defineComponent({
  name: 'SetupsView',
  components: { ProductionList, ProductionPage, ScenePage },
  setup() {
    // Ids that no longer exist (deleted) fall back to the level above.
    const production = computed(() => getProduction(nav.productionId))
    const scene = computed(() => {
      const s = getScene(nav.sceneId)
      return s && s.productionId === production.value?.id ? s : undefined
    })
    return { setups, production, scene, openSetups }
  }
})
</script>

<style scoped>
.setups { height: 100%; overflow-y: auto; }
.crumbs { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 4px; padding: 8px 18px; background: var(--bg); border-bottom: 1px solid var(--line); font-size: 13px; }
.crumbs button { border: none; background: none; padding: 4px 6px; color: var(--muted); }
.crumbs button:hover { color: var(--text); background: none; }
.crumbs button.here { color: var(--text); cursor: default; }
.crumbs span { color: #4a4d56; }
.notice { max-width: 560px; margin: 60px auto; text-align: center; color: var(--muted); line-height: 1.5; }
</style>
