<template>
  <div class="shell">
    <header>
      <strong>Previs</strong>
      <nav>
        <button :class="{ on: nav.view === 'plan' }" @click="nav.view = 'plan'">Floor Plan</button>
        <button :class="{ on: nav.view === 'live' }" @click="nav.view = 'live'">Live View</button>
        <button :class="{ on: nav.view === 'setups' }" @click="nav.view = 'setups'">Setups</button>
      </nav>
    </header>
    <main>
      <!-- Both views stay mounted so the Babylon engine is created once. -->
      <FloorPlanView v-show="nav.view === 'plan'" :active="nav.view === 'plan'" />
      <LiveView v-show="nav.view === 'live'" :active="nav.view === 'live'" />
      <SetupsView v-if="nav.view === 'setups'" />
    </main>
    <CaptureDialog v-if="captureState.request" :key="captureState.request.previewUrl" :request="captureState.request" />
    <CaptureToast />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { nav } from './nav'
import { captureState } from './setups/capture'
import CaptureDialog from './setups/components/CaptureDialog.vue'
import CaptureToast from './setups/components/CaptureToast.vue'
import { initSetups } from './setups/store'
import FloorPlanView from './views/FloorPlanView.vue'
import LiveView from './views/LiveView.vue'
import SetupsView from './views/SetupsView.vue'

export default defineComponent({
  name: 'App',
  components: {
    FloorPlanView,
    LiveView,
    SetupsView,
    CaptureDialog,
    CaptureToast
  },
  setup() {
    initSetups()
    return { nav, captureState }
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
textarea { font: inherit; color: var(--text); background: #23252c; border: 1px solid var(--line); border-radius: 6px; padding: 5px 10px; }
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
