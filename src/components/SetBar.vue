<template>
  <div v-if="show" class="setbar" :class="{ phone: phoneBridge, failed: setLink.state === 'failed' }" role="status">
    <template v-if="setLink.state === 'loading'">
      <span class="title">Opening set{{ setLink.title ? ` · ${setLink.title}` : '' }}…</span>
    </template>
    <template v-else-if="setLink.state === 'failed'">
      <span class="text">{{ setLink.message }}</span>
      <button class="close" title="Close" @click="dismissed = true">✕</button>
    </template>
    <template v-else-if="phoneBridge">
      <div class="text">
        <span class="title">{{ setLink.title }}</span>
        <span v-if="manualUrl" class="sub url">Copy this link: {{ manualUrl }}</span>
        <span v-else class="sub">Drag to look around, pinch to zoom. Editing works on a laptop or tablet.</span>
      </div>
      <button class="primary" @click="sendToLaptop">{{ sent || 'Send to my laptop' }}</button>
    </template>
    <template v-else>
      <span class="text"><span class="title">{{ setLink.title }}</span> · It's yours to change: move things in Floor Plan, swap lenses through the camera here.</span>
      <button class="close" title="Close" @click="dismissed = true">✕</button>
    </template>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, ref } from 'vue'
import { track } from '../analytics'
import { isPhone } from '../phone'
import { phoneBridge, setLink, setUrl } from '../sets'

export default defineComponent({
  name: 'SetBar',
  setup() {
    const dismissed = ref(false)
    const sent = ref('')
    const manualUrl = ref('')
    // On phones a failed link is explained by the phone notice instead.
    const show = computed(() => setLink.state !== 'none' && !dismissed.value && !(setLink.state === 'failed' && isPhone.value))

    // In-app browsers (Instagram's included) often block the Clipboard API; the old copy command
    // still works in most of them.
    const legacyCopy = (text: string): boolean => {
      const area = document.createElement('textarea')
      area.value = text
      area.setAttribute('readonly', '')
      area.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      document.body.appendChild(area)
      area.select()
      let ok = false
      try { ok = document.execCommand('copy') } catch { ok = false }
      area.remove()
      return ok
    }

    // The phone's share sheet (AirDrop, email, WhatsApp to yourself) where there is one, else copy,
    // else show the link to copy by hand.
    const sendToLaptop = async () => {
      const url = setUrl()
      // The phone-to-laptop hand-off is the campaign's conversion step, so count how it went.
      const sentBy = (method: string) => track('Set sent to laptop', { set: setLink.slug, method })
      if (navigator.share) {
        try {
          await navigator.share({ title: `Previs Tool · ${setLink.title}`, url })
          sentBy('share sheet')
          return
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return
        }
      }
      let copied = false
      try {
        await navigator.clipboard.writeText(url)
        copied = true
      } catch {
        copied = legacyCopy(url)
      }
      sentBy(copied ? 'copied' : 'shown to copy')
      if (copied) {
        sent.value = 'Link copied'
        window.setTimeout(() => { sent.value = '' }, 2500)
      } else {
        manualUrl.value = url
      }
    }

    return { show, setLink, phoneBridge, dismissed, sent, manualUrl, sendToLaptop }
  }
})
</script>

<style scoped>
.setbar {
  position: fixed;
  left: 50%;
  bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  transform: translateX(-50%);
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: min(760px, calc(100% - 24px));
  box-sizing: border-box;
  padding: 8px 8px 8px 14px;
  font-size: 13px;
  line-height: 1.4;
  background: rgba(23, 24, 28, 0.94);
  border: 1px solid var(--line);
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
}
.setbar.failed { border-color: #b4535a; }
.title { font-weight: 600; color: var(--accent); }
.text { min-width: 0; }
.close { flex-shrink: 0; padding: 3px 8px; background: transparent; border-color: transparent; color: var(--muted); }
.close:hover { color: var(--text); }
.primary { flex-shrink: 0; padding: 8px 12px; background: var(--accent); border-color: var(--accent); color: #1a1a1a; font-weight: 600; max-width: 45vw; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.primary:hover { background: var(--accent); filter: brightness(1.08); }
.setbar.phone {
  left: 0;
  right: 0;
  bottom: 0;
  transform: none;
  max-width: none;
  border-radius: 0;
  border-width: 1px 0 0;
  padding: 10px max(12px, env(safe-area-inset-right, 0px)) calc(10px + env(safe-area-inset-bottom, 0px)) max(12px, env(safe-area-inset-left, 0px));
}
.setbar.phone .text { display: flex; flex-direction: column; gap: 2px; flex: 1; }
.setbar.phone .sub { color: var(--muted); font-size: 12px; }
.setbar.phone .url { color: var(--text); user-select: all; -webkit-user-select: all; word-break: break-all; }
</style>
