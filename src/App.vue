<template>
  <div class="shell">
    <header>
      <strong class="brand">Previs Tool <span>by Leverage AI</span></strong>
      <nav>
        <button :class="{ on: nav.view === 'plan' }" @click="nav.view = 'plan'">Floor Plan</button>
        <button :class="{ on: nav.view === 'live' }" @click="nav.view = 'live'">Live View</button>
        <button :class="{ on: nav.view === 'setups' }" @click="nav.view = 'setups'">Setups</button>
      </nav>
      <div class="header-actions">
        <a class="feedback-btn" :href="FEEDBACK_URL" target="_blank" rel="noopener" title="Share feedback">Feedback</a>
        <button :class="['guide-btn', { on: nav.view === 'guide' }]" title="User guide" @click="nav.view = 'guide'">? Guide</button>
      </div>
    </header>
    <main>
      <!-- Both views stay mounted so the Babylon engine is created once. -->
      <FloorPlanView v-show="nav.view === 'plan'" :active="nav.view === 'plan'" />
      <LiveView v-show="nav.view === 'live'" :active="nav.view === 'live'" />
      <SetupsView v-if="nav.view === 'setups'" />
      <GuideView v-if="nav.view === 'guide'" />
    </main>
    <CaptureDialog v-if="captureState.request" :key="captureState.request.previewUrl" :request="captureState.request" />
    <CaptureToast />
    <MobileNotice />
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import { nav } from './nav'
import { captureState } from './setups/capture'
import { FEEDBACK_URL } from './feedback'
import MobileNotice from './components/MobileNotice.vue'
import CaptureDialog from './setups/components/CaptureDialog.vue'
import CaptureToast from './setups/components/CaptureToast.vue'
import { ensureSamples } from './setups/samples'
import { initSetups } from './setups/store'
import GuideView from './guide/GuideView.vue'
import FloorPlanView from './views/FloorPlanView.vue'
import LiveView from './views/LiveView.vue'
import SetupsView from './views/SetupsView.vue'

export default defineComponent({
  name: 'App',
  components: {
    FloorPlanView,
    LiveView,
    SetupsView,
    GuideView,
    CaptureDialog,
    CaptureToast,
    MobileNotice
  },
  setup() {
    initSetups().then(ensureSamples)
    return { nav, captureState, FEEDBACK_URL }
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
header .brand { white-space: nowrap; }
header .brand span { font-weight: 400; font-size: 12px; color: var(--muted); margin-left: 4px; }
@media (max-width: 640px) {
  header .brand span { display: none; }
  /* Two rows on phones so nothing is pushed off-screen: brand + Feedback/Guide, then the view tabs. */
  header { height: auto; flex-wrap: wrap; gap: 6px 8px; padding: 6px 8px; }
  nav { order: 3; width: 100%; }
  nav button { flex: 1; padding: 5px 4px; white-space: nowrap; }
}
nav {
  display: flex;
  gap: 4px;
}
nav button.on, .guide-btn.on {
  background: var(--accent);
  border-color: var(--accent);
  color: #1a1a1a;
}
.header-actions { margin-left: auto; display: flex; gap: 4px; }
.feedback-btn {
  white-space: nowrap;
  color: var(--text);
  text-decoration: none;
  background: #23252c;
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 10px;
}
.feedback-btn:hover { background: #2c2f37; }
.guide-btn { white-space: nowrap; }
main {
  flex: 1;
  min-height: 0;
}
</style>
