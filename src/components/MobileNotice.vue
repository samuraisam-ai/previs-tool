<template>
  <div v-if="show" class="backdrop" :style="box">
    <div class="card" role="dialog" aria-modal="true" aria-labelledby="mobile-notice-title">
      <div class="icon" aria-hidden="true">📱</div>
      <h3 id="mobile-notice-title">Best on a bigger screen</h3>
      <p>This previs platform is built for tablets, laptops and desktop computers. Please open it on one of those for the full experience.</p>
      <p class="soon">Phone optimisation coming soon.</p>
      <button class="primary" @click="dismiss">Continue anyway</button>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import type { CSSProperties } from 'vue'
import { isPhone } from '../phone'

const DISMISSED_KEY = 'previs.mobileNoticeDismissed'

function wasDismissed(): boolean {
  try {
    return sessionStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false
  }
}

export default defineComponent({
  name: 'MobileNotice',
  setup() {
    const dismissed = ref(wasDismissed())
    const show = ref(false)
    const box = ref<CSSProperties>({})

    // The app is wider than a phone, so the page overflows the screen. Cover only what's
    // actually visible (the visual viewport) so the card lands in the middle of the screen.
    function fitToScreen() {
      const vv = window.visualViewport
      if (!vv) return
      box.value = { left: `${vv.offsetLeft}px`, top: `${vv.offsetTop}px`, width: `${vv.width}px`, height: `${vv.height}px` }
    }

    function check() {
      show.value = isPhone.value && !dismissed.value
      fitToScreen()
    }

    function dismiss() {
      dismissed.value = true
      show.value = false
      try {
        sessionStorage.setItem(DISMISSED_KEY, '1')
      } catch {
        // Storage blocked (private mode etc.) — dismissal just won't survive a reload.
      }
    }

    onMounted(() => {
      check()
      window.addEventListener('resize', check)
      window.addEventListener('orientationchange', check)
      window.visualViewport?.addEventListener('resize', fitToScreen)
      window.visualViewport?.addEventListener('scroll', fitToScreen)
    })
    onBeforeUnmount(() => {
      window.removeEventListener('resize', check)
      window.removeEventListener('orientationchange', check)
      window.visualViewport?.removeEventListener('resize', fitToScreen)
      window.visualViewport?.removeEventListener('scroll', fitToScreen)
    })

    return { show, box, dismiss }
  }
})
</script>

<style scoped>
.backdrop { position: fixed; inset: 0; box-sizing: border-box; z-index: 70; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 16px; }
.card { width: min(360px, 100%); box-sizing: border-box; padding: 20px; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); text-align: center; }
.icon { font-size: 32px; line-height: 1; }
h3 { margin: 10px 0 8px; }
p { margin: 0 0 10px; font-size: 14px; line-height: 1.45; }
.soon { color: var(--accent); font-size: 13px; font-weight: 600; }
.primary { width: 100%; margin-top: 6px; padding: 9px 10px; background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; }
.primary:hover { background: var(--accent); filter: brightness(1.08); }
</style>
