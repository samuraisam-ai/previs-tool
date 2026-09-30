<template>
  <div class="scene-form">
    <label class="num">
      Scene
      <input :value="value.number" placeholder="12" @input="set('number', $event)" />
    </label>
    <label>
      Int / Ext
      <select :value="value.setting" @change="set('setting', $event)">
        <option v-for="s in SETTINGS" :key="s" :value="s">{{ s }}</option>
      </select>
    </label>
    <label class="grow">
      Location
      <input :value="value.location" placeholder="Kitchen" @input="set('location', $event)" />
    </label>
    <label>
      Time of day
      <select :value="value.timeOfDay" @change="set('timeOfDay', $event)">
        <option v-for="t in TIMES_OF_DAY" :key="t" :value="t">{{ t }}</option>
      </select>
    </label>
    <label class="full">
      What happens
      <textarea :value="value.synopsis" rows="2" placeholder="Briefly, what happens in this scene" @input="set('synopsis', $event)"></textarea>
    </label>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType } from 'vue'
import { SceneFields } from '../store'
import { SETTINGS, TIMES_OF_DAY } from '../types'

// Edits a scene's heading fields; emits each change as a patch for the parent to apply.
export default defineComponent({
  name: 'SceneForm',
  props: {
    value: { type: Object as PropType<SceneFields>, required: true }
  },
  emits: ['patch'],
  setup(_, { emit }) {
    const set = (key: keyof SceneFields, event: Event) =>
      emit('patch', { [key]: (event.target as HTMLInputElement).value })
    return { SETTINGS, TIMES_OF_DAY, set }
  }
})
</script>

<style scoped>
.scene-form { display: flex; flex-wrap: wrap; gap: 10px; }
label { display: flex; flex-direction: column; gap: 4px; font-size: 12px; color: var(--muted); }
label.num input { width: 64px; }
label.grow { flex: 1; min-width: 140px; }
label.full { flex-basis: 100%; }
textarea { resize: vertical; }
input, select, textarea { color: var(--text); font-size: 13px; }
</style>
