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
        <button v-if="offerFullscreen" class="full-btn" :title="fullscreen ? 'Exit full screen' : 'Full screen'" :aria-label="fullscreen ? 'Exit full screen' : 'Full screen'" @click="toggleFullscreen">{{ fullscreen ? '⤡' : '⤢' }}</button>
      </div>
      <!-- iPhones can't put a web page full screen; a home-screen app opens without Safari's bars. -->
      <div v-if="homeTip" class="home-tip" role="dialog" aria-label="Full screen on iPhone">
        <b>Full screen on iPhone</b>
        <p>In Safari, tap Share <span class="share">⬆︎</span> then <b>Add to Home Screen</b>, and open Previs from your home screen: no browser bars, top or bottom. From Instagram, open the link in Safari first (••• → Open in browser).</p>
        <p class="small">The home-screen app keeps its own saved work, separate from Safari. Export a production to move it across.</p>
        <button @click="homeTip = false">Got it</button>
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
    <SetBar />
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import { nav } from './nav'
import { setContext, track } from './analytics'
import { isPhone } from './phone'
import { captureState } from './setups/capture'
import { FEEDBACK_URL } from './feedback'
import MobileNotice from './components/MobileNotice.vue'
import SetBar from './components/SetBar.vue'
import { openSetFromUrl } from './sets'
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
    MobileNotice,
    SetBar
  },
  setup() {
    initSetups().then(ensureSamples)
    openSetFromUrl()

    // iPhones ignore the viewport's no-zoom setting for pinches; this stops the page itself zooming
    // (the plan and the 3D view still pinch, they read the fingers directly).
    const noZoom = (e: Event) => e.preventDefault()
    ;['gesturestart', 'gesturechange'].forEach(type => document.addEventListener(type, noZoom, { passive: false }))

    // Full screen on phones: real full screen where the browser allows it (Android), otherwise
    // (iPhone) how to add the app to the home screen. Not offered when already running from there.
    const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches || (navigator as { standalone?: boolean }).standalone === true
    const canFullscreen = !!document.fullscreenEnabled && typeof document.documentElement.requestFullscreen === 'function'
    const offerFullscreen = computed(() => isPhone.value && !installed)
    setContext({ display: installed ? 'home screen app' : 'browser' })
    const fullscreen = ref(false)
    const homeTip = ref(false)
    document.addEventListener('fullscreenchange', () => { fullscreen.value = !!document.fullscreenElement })
    const toggleFullscreen = () => {
      if (!document.fullscreenElement) track('Full screen', { how: canFullscreen ? 'full screen' : 'home screen tip' })
      if (!canFullscreen) { homeTip.value = !homeTip.value; return }
      if (document.fullscreenElement) document.exitFullscreen()
      else document.documentElement.requestFullscreen().catch(() => { homeTip.value = true })
    }
    return { nav, captureState, FEEDBACK_URL, offerFullscreen, fullscreen, homeTip, toggleFullscreen }
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
/* The app never scrolls or zooms as a page: panels scroll inside themselves, and only the plan
   and the 3D view take pinches. */
html, body { overflow: hidden; overscroll-behavior: none; touch-action: pan-x pan-y; }
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
  position: relative;
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
/* Phones held sideways: a slim single-row header, so the plan and the shot get the height. */
@media (max-height: 500px) {
  header { height: 36px; gap: 12px; padding: 0 10px; }
  header .brand { font-size: 14px; }
  header .brand span { display: none; }
  header button, .feedback-btn { padding: 3px 9px; font-size: 13px; }
}
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
.full-btn { padding: 3px 9px; font-size: 16px; line-height: 1; }
.home-tip {
  position: absolute; top: calc(100% + 6px); right: 8px; z-index: 80; width: min(320px, calc(100vw - 16px)); box-sizing: border-box;
  padding: 12px 14px; background: var(--panel); border: 1px solid var(--accent); border-radius: 10px;
  box-shadow: 0 14px 34px rgba(0, 0, 0, 0.5); font-size: 13px; line-height: 1.45;
}
.home-tip p { margin: 6px 0; }
.home-tip .small { color: var(--muted); font-size: 12px; }
.home-tip .share { color: var(--accent); }
.home-tip button { margin-top: 4px; background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; }
main {
  flex: 1;
  min-height: 0;
}
</style>
