<template>
  <div :class="['finish', { open }]">
    <button class="head" :aria-expanded="open" @click="open = !open">
      <span class="chip" :style="chipStyle"></span>
      <span class="label">{{ label }}</span>
      <span class="kind">{{ MATERIALS[value.material].label }}</span>
      <span class="caret">{{ open ? '▾' : '▸' }}</span>
    </button>

    <div v-if="open" class="editor">
      <label>Material
        <select :value="value.material" @change="setMaterial($event)">
          <option v-for="m in MATERIAL_ORDER" :key="m" :value="m">{{ MATERIALS[m].label }}</option>
        </select>
      </label>

      <div class="swatches" role="list" aria-label="Swatches">
        <button
          v-for="s in MATERIALS[value.material].swatches"
          :key="s.name"
          :class="['sw', { on: s.colour.toLowerCase() === value.colour.toLowerCase() }]"
          :title="s.name"
          :style="{ background: s.colour }"
          @click="emitPatch({ colour: s.colour, colour2: s.colour2 ?? value.colour2 })"
        ></button>
      </div>

      <div class="row">
        <label class="grow">Colour
          <span class="pick"><input type="color" :value="value.colour" @input="emitPatch({ colour: text($event) })" /><input class="hex" :value="value.colour" @change="hex($event, 'colour')" /></span>
        </label>
        <label v-if="value.pattern !== 'none' && value.pattern !== 'image'" class="grow">Second colour
          <span class="pick"><input type="color" :value="value.colour2" @input="emitPatch({ colour2: text($event) })" /><input class="hex" :value="value.colour2" @change="hex($event, 'colour2')" /></span>
        </label>
      </div>

      <span class="caption">Texture / pattern</span>
      <div class="patterns">
        <button
          v-for="p in PATTERNS"
          :key="p.id"
          :class="['pt', { on: value.pattern === p.id }]"
          :title="p.label"
          @click="setPattern(p.id)"
        >
          <img v-if="p.id !== 'image' && p.id !== 'none'" :src="patternPreview(p.id, value.colour, value.colour2)" alt="" />
          <span v-else-if="p.id === 'none'" class="plain" :style="{ background: value.colour }"></span>
          <img v-else-if="imageUrl" :src="imageUrl" alt="" />
          <span v-else class="plain up">＋</span>
          <small>{{ p.label }}</small>
        </button>
      </div>

      <template v-if="value.pattern !== 'none'">
        <div class="row">
          <label v-if="!(value.pattern === 'image' && fit)" class="grow">{{ value.pattern === 'image' ? 'Image covers' : 'Pattern size' }} (m)
            <input type="number" min="0.01" max="20" step="0.01" :value="value.scale" @change="num($event, 'scale', 0.01, 20)" />
          </label>
          <div class="wheel">
            <AngleWheel :model-value="value.rotation" :min="0" :max="359" :snap="15" :size="64" label="Pattern rotation" @update:model-value="emitPatch({ rotation: $event })" />
          </div>
        </div>
        <button v-if="value.pattern === 'image'" class="small" @click="pickImage">{{ value.imageId ? 'Replace image…' : 'Choose image…' }}</button>
      </template>

      <span class="caption">Surface</span>
      <label class="slider">Gloss
        <input type="range" min="0" max="1" step="0.01" :value="1 - value.roughness" @input="emitPatch({ roughness: 1 - Number(text($event)) })" />
        Matte
      </label>
      <label v-if="value.material === 'metal' || value.material === 'mirror' || value.metalness > 0" class="slider">Metallic
        <input type="range" min="0" max="1" step="0.01" :value="value.metalness" @input="emitPatch({ metalness: Number(text($event)) })" />
      </label>
      <label v-if="value.material === 'glass' || value.opacity < 1" class="slider">See-through
        <input type="range" min="0.05" max="1" step="0.01" :value="1 - value.opacity + 0.05" @input="emitPatch({ opacity: Math.min(1, 1.05 - Number(text($event))) })" />
        Solid
      </label>

      <div class="tools">
        <button class="small" title="Copy this finish" @click="finishTools.clipboard = { ...value }">Copy</button>
        <button class="small" :disabled="!finishTools.clipboard" title="Paste a copied finish" @click="paste">Paste</button>
        <button class="small" title="Save as one of My materials" @click="saveAs">Save…</button>
        <button class="small" title="Back to this part's default" @click="$emit('reset')">Reset</button>
      </div>
      <div v-if="finishTools.presets.length" class="presets">
        <span class="caption">My materials</span>
        <div class="preset-list">
          <button v-for="p in finishTools.presets" :key="p.name" class="preset" :title="`Apply ${p.name}`" @click="$emit('update', { ...p.finish })">
            <span class="chip" :style="chip(p.finish)"></span>{{ p.name }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent, PropType, ref } from 'vue'
import AngleWheel from '../components/controls/AngleWheel.vue'
import { Finish, MaterialKind, PatternKind } from '../scene/types'
import { changeMaterial, MATERIAL_ORDER, MATERIALS, PATTERNS } from './finish'
import { finishTools, imagePreview, savePreset, uploadImage } from './finishTools'
import { patternPreview } from './patterns'

export default defineComponent({
  name: 'FinishEditor',
  components: { AngleWheel },
  props: {
    value: { type: Object as PropType<Finish>, required: true },
    label: { type: String, required: true },
    // Artwork / screens: an image fills the part instead of tiling.
    fit: { type: Boolean, default: false },
    startOpen: { type: Boolean, default: false }
  },
  emits: ['update', 'reset'],
  setup(props, { emit }) {
    const open = ref(props.startOpen)
    const emitPatch = (patch: Partial<Finish>) => emit('update', { ...props.value, ...patch })
    const text = (e: Event) => (e.target as HTMLInputElement).value
    const hex = (e: Event, key: 'colour' | 'colour2') => {
      const v = text(e).trim()
      if (/^#?[0-9a-f]{6}$/i.test(v)) emitPatch({ [key]: v.startsWith('#') ? v : `#${v}` })
    }
    const num = (e: Event, key: 'scale', min: number, max: number) => {
      const v = Number(text(e))
      if (isFinite(v)) emitPatch({ [key]: Math.min(max, Math.max(min, v)) })
    }
    const setMaterial = (e: Event) => emit('update', changeMaterial(props.value, text(e) as MaterialKind))
    const pickImage = async () => {
      const id = await uploadImage()
      if (id) emitPatch({ pattern: 'image', imageId: id, colour: '#ffffff', scale: props.fit ? props.value.scale : 1 })
    }
    const setPattern = (p: PatternKind) => {
      if (p === 'image' && !props.value.imageId) { pickImage(); return }
      emitPatch({ pattern: p })
    }
    const paste = () => { if (finishTools.clipboard) emit('update', { ...finishTools.clipboard }) }
    const saveAs = () => {
      const name = window.prompt('Name this material (e.g. “Sofa velvet – oxblood”)', `${props.label} – ${MATERIALS[props.value.material].label}`)
      if (name?.trim()) savePreset(name.trim(), props.value)
    }
    const imageUrl = computed(() => imagePreview(props.value.imageId))
    const chip = (f: Finish) => (f.pattern === 'image' && f.imageId
      ? { background: `center / cover url(${imagePreview(f.imageId) ?? ''})` }
      : f.pattern !== 'none' ? { background: `center / cover url(${patternPreview(f.pattern, f.colour, f.colour2)})` } : { background: f.colour })
    const chipStyle = computed(() => chip(props.value))
    return {
      open, emitPatch, text, hex, num, setMaterial, setPattern, pickImage, paste, saveAs, imageUrl, chip, chipStyle,
      finishTools, patternPreview, MATERIALS, MATERIAL_ORDER, PATTERNS
    }
  }
})
</script>

<style scoped>
.finish { border: 1px solid var(--line); border-radius: 8px; }
.finish.open { border-color: #3a3d46; }
.head { width: 100%; display: flex; align-items: center; gap: 8px; border: none; background: none; padding: 7px 8px; text-align: left; }
.chip { width: 18px; height: 18px; border-radius: 4px; border: 1px solid rgba(255, 255, 255, 0.2); flex-shrink: 0; display: inline-block; }
.label { flex: 1; font-size: 13px; }
.kind { font-size: 11px; color: var(--muted); }
.caret { color: var(--muted); font-size: 11px; }
.editor { padding: 4px 8px 10px; display: flex; flex-direction: column; gap: 8px; }
.editor label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
.swatches { display: flex; flex-wrap: wrap; gap: 5px; }
.sw { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
.sw.on { border-color: var(--accent); }
.row { display: flex; gap: 8px; align-items: flex-end; }
.grow { flex: 1; min-width: 0; }
.pick { display: flex; gap: 4px; }
.pick input[type='color'] { width: 34px; height: 28px; padding: 1px; flex-shrink: 0; }
.hex { flex: 1; min-width: 0; font-family: ui-monospace, monospace; font-size: 12px; padding: 3px 6px; }
.caption { font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.6px; }
.patterns { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.pt { padding: 3px; display: flex; flex-direction: column; align-items: center; gap: 2px; border-radius: 6px; }
.pt.on { border-color: var(--accent); }
.pt img, .pt .plain { width: 100%; aspect-ratio: 1; border-radius: 4px; object-fit: cover; display: block; }
.pt .up { display: flex; align-items: center; justify-content: center; background: #23252c; color: var(--muted); font-size: 16px; }
.pt small { font-size: 9.5px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.wheel { flex-shrink: 0; }
.slider { flex-direction: row !important; align-items: center; gap: 6px !important; }
.slider input { flex: 1; }
.tools { display: flex; gap: 4px; flex-wrap: wrap; }
.small { padding: 3px 8px; font-size: 12px; }
.small:disabled { opacity: 0.4; }
.preset-list { display: flex; flex-direction: column; gap: 3px; margin-top: 4px; max-height: 140px; overflow-y: auto; }
.preset { display: flex; align-items: center; gap: 6px; padding: 3px 6px; font-size: 12px; text-align: left; }
</style>
