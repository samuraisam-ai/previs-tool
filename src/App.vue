<template>
  <div class="shell">
    <header>
      <strong>Previs</strong>
      <nav>
        <button :class="{ on: view === 'plan' }" @click="view = 'plan'">Floor Plan</button>
        <button :class="{ on: view === 'live' }" @click="view = 'live'">Live View</button>
      </nav>
    </header>
    <main>
      <!-- Both views stay mounted so the Babylon engine is created once. -->
      <FloorPlanView v-show="view === 'plan'" :active="view === 'plan'" />
      <LiveView v-show="view === 'live'" />
    </main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue'
import FloorPlanView from './views/FloorPlanView.vue'
import LiveView from './views/LiveView.vue'

export default defineComponent({
  name: 'App',
  components: {
    FloorPlanView,
    LiveView
  },
  setup() {
    const view = ref<'plan' | 'live'>('plan')
    return { view }
  }
})
</script>

<style>
:root {
  --bg: #0f1013;
  --panel: #17181c;
  --line: #2a2c33;
  --text: #e6e7ea;
  --muted: #8b8f99;
  --accent: #ffb547;
}
html, body, #app {
  margin: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
}
button, input, select {
  font: inherit;
  color: var(--text);
  background: #23252c;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 10px;
}
button { cursor: pointer; }
button:hover { background: #2c2f37; }
input[type='color'] { padding: 2px; height: 30px; width: 60px; }
input[type='range'] { padding: 0; accent-color: var(--accent); }
</style>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  height: 100%;
}
header {
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 0 16px;
  border-bottom: 1px solid var(--line);
  background: var(--panel);
}
nav {
  display: flex;
  gap: 4px;
}
nav button.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a1a1a;
}
main {
  flex: 1;
  min-height: 0;
}
</style>
