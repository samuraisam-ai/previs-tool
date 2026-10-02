<template>
  <div v-if="subject" class="subject-panel">
    <h4 class="section">Pose</h4>
    <div v-for="group in groups" :key="group.name" class="pose-group">
      <span class="group-name">{{ group.name }}</span>
      <div class="poses">
        <button
          v-for="pose in group.poses"
          :key="pose.id"
          :class="['pose', { on: p.pose === pose.id }]"
          :title="pose.name"
          @click="p.pose = pose.id"
        >
          <svg :viewBox="pose.box" width="44" height="44">
            <line v-for="(s, i) in pose.lines" :key="i" :x1="s[0]" :y1="s[1]" :x2="s[2]" :y2="s[3]" :stroke-width="s[4]" />
            <circle :cx="pose.head[0]" :cy="pose.head[1]" :r="pose.head[2]" />
          </svg>
          <small>{{ pose.name }}</small>
        </button>
      </div>
    </div>

    <h4 class="section">Head &amp; body</h4>
    <div class="wheels">
      <div class="wheel"><span>Head turn</span><AngleWheel v-model="p.headYaw" signed :min="-80" :max="80" :step="1" :snap="5" :size="96" label="Head turn" /></div>
      <div class="wheel"><span>Head tilt</span><TiltWheel v-model="p.headPitch" icon="person" :min="-45" :max="45" :size="96" label="Head tilt" /></div>
      <div class="wheel"><span>Lean</span><TiltWheel v-model="p.lean" icon="person" :min="-25" :max="40" :size="96" label="Lean" down-word="forward" up-word="back" /></div>
    </div>
    <label>Look at
      <select v-model="p.lookAt">
        <option :value="null">Nobody (use the wheels)</option>
        <option v-for="t in targets" :key="t.id" :value="t.id">{{ t.name }}{{ t.kind === 'camera' ? ' (camera)' : '' }}</option>
      </select>
    </label>
    <p v-if="p.lookAt" class="readout">The head turns to follow them; the wheels add on top.</p>

    <h4 class="section">Look</h4>
    <span class="field">Skin tone</span>
    <div class="swatches">
      <button v-for="c in skinTones" :key="c" :class="['sw', { on: p.skin === c }]" :style="{ background: c }" :title="c" @click="p.skin = c" />
      <input v-model="p.skin" type="color" title="Any skin tone" />
    </div>
    <div class="wardrobe">
      <label>Top <input v-model="p.top" type="color" /></label>
      <label>Bottom <input v-model="p.bottom" type="color" /></label>
      <label>Shoes <input v-model="p.shoes" type="color" /></label>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import AngleWheel from '../../components/controls/AngleWheel.vue'
import TiltWheel from '../../components/controls/TiltWheel.vue'
import { getItem, scene } from '../../scene/store'
import { SubjectItem } from '../../scene/types'
import { SKIN_TONES, segments, solve } from '../../subjects/kinematics'
import { POSE_GROUPS, POSES } from '../../subjects/poses'

// Side-on silhouettes of every pose (seen from the figure's right), drawn from the kinematics.
const thumbs = POSES.map(pose => {
  const posed = solve(pose.v, pose.contact, { height: 1.75, surface: pose.contact === 'seat' ? 0.45 : 0 })
  const lines = segments(posed)
    .filter(s => s.id !== 'head')
    .map(s => [s.a[2], -s.a[1], s.b[2], -s.b[1], Math.max(0.05, s.r * 1.6)] as number[])
  const head = [posed.pos.head[2] + (posed.eye[2] - posed.pos.head[2]) * 0.3, -(posed.pos.head[1] + 0.11), 0.11]
  const xs = lines.flatMap(l => [l[0], l[2]]).concat(head[0])
  const ys = lines.flatMap(l => [l[1], l[3]]).concat(head[1] - 0.12)
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1) + 0.3
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2
  const bottom = Math.max(...ys) + 0.1
  return { ...pose, lines, head, box: `${cx - size / 2} ${bottom - size} ${size} ${size}` }
})

export default defineComponent({
  name: 'SubjectPanel',
  components: { AngleWheel, TiltWheel },
  props: { id: { type: String, required: true } },
  setup(props) {
    const subject = computed(() => {
      const item = getItem(props.id)
      return item && item.kind === 'subject' ? (item as SubjectItem) : undefined
    })
    const p = computed(() => (subject.value as SubjectItem).props)
    const targets = computed(() => scene.items.filter(i => (i.kind === 'subject' || i.kind === 'camera') && i.id !== props.id))
    const groups = POSE_GROUPS.map(name => ({ name, poses: thumbs.filter(t => t.group === name) }))
    return { subject, p, targets, groups, skinTones: SKIN_TONES }
  }
})
</script>

<style scoped>
.pose-group { margin-bottom: 6px; }
.group-name { display: block; font-size: 11px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin: 6px 0 4px; }
.poses { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; }
.pose { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 2px; background: #1d1f25; }
.pose.on { border-color: var(--accent); background: rgba(255, 181, 71, 0.12); }
.pose svg line { stroke: #c9ccd4; stroke-linecap: round; }
.pose svg circle { fill: #c9ccd4; }
.pose.on svg line { stroke: var(--accent); }
.pose.on svg circle { fill: var(--accent); }
.pose small { font-size: 10px; line-height: 1.15; color: var(--muted); text-align: center; }
.wheels { display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; }
.wheel { display: flex; flex-direction: column; align-items: center; font-size: 12px; color: var(--muted); }
.field { display: block; font-size: 12px; color: var(--muted); margin: 6px 0 4px; }
.swatches { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
.sw { width: 22px; height: 22px; padding: 0; border-radius: 50%; border: 2px solid transparent; }
.sw.on { border-color: var(--accent); }
.swatches input[type='color'] { width: 34px; height: 26px; }
.wardrobe { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px; }
.wardrobe input[type='color'] { width: 100%; }
</style>
