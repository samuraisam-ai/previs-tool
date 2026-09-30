<template>
  <div class="backdrop" @mousedown.self="cancel">
    <form ref="dialog" class="dialog" role="dialog" aria-modal="true" :aria-label="title" tabindex="-1" @submit.prevent="save" @keydown.esc.stop="cancel">
      <div class="preview"><img :src="request.previewUrl" alt="Captured image" /></div>
      <div class="fields">
        <h3>{{ title }}</h3>

        <label>
          Production
          <select v-if="setups.productions.length" v-model="productionId">
            <option v-for="p in setups.productions" :key="p.id" :value="p.id">{{ p.title }}</option>
            <option :value="NEW">＋ New production…</option>
          </select>
        </label>
        <input v-if="productionId === NEW" ref="productionInput" v-model="productionTitle" placeholder="Production title" />

        <label v-if="productionId !== NEW">
          Scene
          <select v-model="sceneId">
            <option v-for="s in scenes" :key="s.id" :value="s.id">{{ slugLine(s) }}</option>
            <option :value="NEW">＋ New scene…</option>
          </select>
        </label>
        <div v-if="sceneId === NEW || productionId === NEW" class="new-scene">
          <span class="sub">New scene</span>
          <SceneForm :value="sceneDraft" @patch="Object.assign(sceneDraft, $event)" />
        </div>

        <div class="saved-as">Saves as <b>{{ savedAs }}</b></div>

        <template v-if="request.kind === 'frame'">
          <div class="sizes" role="radiogroup" aria-label="Shot size">
            <button v-for="s in SHOT_SIZES" :key="s" type="button" role="radio" :aria-checked="shot.size === s" :class="{ on: shot.size === s }" @click="shot.size = s">{{ s }}</button>
          </div>
          <label>Movement <input v-model="shot.movement" placeholder="Static, push in, pan left…" /></label>
          <label>Action <textarea v-model="shot.action" rows="2" placeholder="What happens in the shot"></textarea></label>
          <label>Dialogue <textarea v-model="shot.dialogue" rows="2" placeholder="Optional"></textarea></label>
          <small v-if="cameraSummary" class="auto">{{ cameraSummary }}</small>
        </template>

        <label>Name <input ref="nameInput" v-model="name" :placeholder="request.kind === 'setup' ? 'e.g. Window key, practical fill' : 'e.g. Maya enters'" /></label>
        <label>Description <textarea v-model="description" rows="3" placeholder="Notes: intent, gear, what changed"></textarea></label>

        <div class="buttons">
          <button type="button" @click="cancel">Cancel</button>
          <button class="primary" type="submit" :disabled="saving || !setups.available">{{ saving ? 'Saving…' : 'Save' }}</button>
        </div>
        <p v-if="!setups.available" class="error">Setups can't be saved in this browser mode.</p>
      </div>
    </form>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, nextTick, onMounted, PropType, reactive, ref, watch } from 'vue'
import { nav } from '../../nav'
import { CaptureRequest, closeCapture, enqueue, lastTarget, showToast } from '../capture'
import { addCapture, createProduction, createScene, getProduction, getScene, nextCaptureNumber, nextSceneNumber, SceneFields, scenesOf, setups } from '../store'
import { captureLabel, Shot, SHOT_SIZES, ShotSize, slugLine } from '../types'
import SceneForm from './SceneForm.vue'

const NEW = '__new'

export default defineComponent({
  name: 'CaptureDialog',
  components: { SceneForm },
  props: {
    request: { type: Object as PropType<CaptureRequest>, required: true }
  },
  setup(props) {
    const dialog = ref<HTMLFormElement | null>(null)
    const nameInput = ref<HTMLInputElement | null>(null)
    const productionInput = ref<HTMLInputElement | null>(null)
    const title = computed(() => (props.request.kind === 'setup' ? 'Save floor plan setup' : 'Save storyboard frame'))

    // Default target: where the last capture went, else the scene open in Setups, else the most recent.
    const firstProduction = () => {
      const candidates = [lastTarget.productionId, nav.productionId, setups.productions[0]?.id ?? null]
      return candidates.find(id => id && getProduction(id)) ?? NEW
    }
    const productionId = ref<string>(firstProduction())
    const production = computed(() => (productionId.value === NEW ? undefined : getProduction(productionId.value)))
    const scenes = computed(() => (production.value ? scenesOf(production.value) : []))
    const pickScene = () => {
      const list = scenes.value
      const preferred = [lastTarget.sceneId, nav.sceneId].find(id => id && list.some(s => s.id === id))
      return preferred ?? list[list.length - 1]?.id ?? NEW
    }
    const sceneId = ref<string>(pickScene())
    const sceneDraft = reactive<SceneFields>({ number: '1', setting: 'INT', location: '', timeOfDay: 'DAY', synopsis: '' })
    const resetDraft = () => { sceneDraft.number = production.value ? nextSceneNumber(production.value) : '1' }
    resetDraft()
    watch(productionId, async id => {
      sceneId.value = pickScene()
      resetDraft()
      if (id === NEW) { await nextTick(); productionInput.value?.focus() }
    })

    const productionTitle = ref('')
    const name = ref('')
    const description = ref('')
    const shot = reactive({ size: 'MS' as ShotSize, movement: '', action: '', dialogue: '' })
    const saving = ref(false)

    const savedAs = computed(() => {
      const kind = props.request.kind
      const existing = sceneId.value !== NEW && productionId.value !== NEW ? getScene(sceneId.value) : undefined
      const number = existing ? nextCaptureNumber(existing, kind) : '1'
      return captureLabel({ number: existing ? existing.number : sceneDraft.number || '?' }, { kind, number })
    })
    const cameraSummary = computed(() => {
      const c = props.request.shot?.camera
      return c ? `${c.name} · ${c.lensMm}mm · T${c.tStop} · ISO ${c.iso} · ${c.shutter} · ${c.wbK}K · ${c.heightM.toFixed(2)} m` : ''
    })

    const cancel = () => closeCapture()
    // Closes at once; rendering and encoding the full image (~1 s) finish in the background.
    const save = () => {
      if (saving.value) return
      saving.value = true
      const request = props.request
      const prod = production.value ?? createProduction(productionTitle.value)
      const scene = (sceneId.value !== NEW && productionId.value !== NEW && getScene(sceneId.value)) ||
        createScene(prod, { ...sceneDraft, number: sceneDraft.number.trim() || nextSceneNumber(prod) })
      lastTarget.productionId = prod.id
      lastTarget.sceneId = scene.id
      const kind = request.kind
      const title = name.value.trim()
      const notes = description.value.trim()
      const fullShot: Shot | undefined = request.shot ? { ...request.shot, ...shot } : undefined
      const where = { productionId: prod.id, sceneId: scene.id, tab: kind === 'setup' ? 'setups' as const : 'storyboard' as const }
      closeCapture(true)
      showToast({ text: `Saving to Sc ${scene.number}…`, state: 'saving', ...where })
      enqueue(async () => {
        const label = captureLabel(scene, { kind, number: nextCaptureNumber(scene, kind) })
        try {
          const { image, thumb } = await request.render({ productionTitle: prod.title, sceneSlug: slugLine(scene), label, name: title, description: notes })
          await addCapture(scene, { kind, name: title, description: notes, image, thumb, sceneJson: request.sceneJson, shot: fullShot })
          showToast({ text: `Saved ${label}${title ? ` — ${title}` : ''}`, state: 'saved', ...where })
        } catch (e) {
          showToast({ text: `Couldn't save ${label}: ${e instanceof Error ? e.message : 'unknown error'}`, state: 'error', ...where })
        } finally {
          URL.revokeObjectURL(request.previewUrl)
        }
      })
    }

    onMounted(() => {
      if (productionId.value === NEW) productionInput.value?.focus()
      else nameInput.value?.focus()
    })

    return {
      NEW, SHOT_SIZES, setups, dialog, nameInput, productionInput, title, productionId, scenes, sceneId, sceneDraft,
      productionTitle, name, description, shot, saving, savedAs, cameraSummary, cancel, save, slugLine
    }
  }
})
</script>

<style scoped>
.backdrop { position: fixed; inset: 0; z-index: 60; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 20px; }
.dialog { display: flex; width: min(1060px, 100%); max-height: 100%; background: var(--panel); border: 1px solid var(--line); border-radius: 12px; overflow: hidden; outline: none; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5); }
.preview { flex: 1; min-width: 0; background: #0b0c0f; display: flex; align-items: center; justify-content: center; }
.preview img { max-width: 100%; max-height: calc(100vh - 40px); display: block; }
.fields { width: 360px; flex-shrink: 0; padding: 16px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; }
h3 { margin: 0 0 4px; font-size: 16px; font-weight: 600; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
input, select, textarea { color: var(--text); font-size: 13px; }
textarea { resize: vertical; }
.new-scene { border: 1px solid var(--line); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px; }
.sub { font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: var(--muted); }
.saved-as { font-size: 12px; color: var(--muted); }
.saved-as b { color: var(--accent); font-weight: 600; }
.sizes { display: flex; flex-wrap: wrap; gap: 4px; }
.sizes button { padding: 3px 8px; font-size: 12px; border-radius: 12px; }
.sizes button.on { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.auto { color: var(--muted); font-size: 12px; }
.buttons { display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px; }
button.primary { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
button.primary:disabled { opacity: 0.5; cursor: default; }
.error { color: #ff7b7f; margin: 0; font-size: 13px; }
@media (max-width: 760px) {
  .dialog { flex-direction: column; overflow-y: auto; }
  .fields { width: auto; }
}
</style>
