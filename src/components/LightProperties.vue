<template>
  <div v-if="light" class="light-props">
    <label>Fixture
      <select :value="light.props.fixtureId" @change="onFixture">
        <optgroup v-for="(label, key) in categories" :key="key" :label="label">
          <option v-for="f in fixturesIn(key)" :key="f.id" :value="f.id">{{ f.model }}{{ f.approx ? ' ≈' : '' }}</option>
        </optgroup>
      </select>
    </label>
    <div class="spec">
      {{ resolved.fixture.brand }} · {{ resolved.fixture.watts }}W · {{ colourLabels[resolved.fixture.colour] }}
      · {{ baseOutput }}
      <span v-if="resolved.fixture.approx" class="approx" title="Some specs are estimated from sibling models">≈ est.</span>
      <div v-if="resolved.fixture.note" class="note">{{ resolved.fixture.note }}</div>
    </div>

    <label>Modifier
      <select :value="light.props.modifierId" @change="onModifier">
        <option v-for="m in modifiers" :key="m.id" :value="m.id">{{ m.name }}{{ m.approx ? ' ≈' : '' }}</option>
      </select>
    </label>

    <label v-if="zoomRange">Beam <span>{{ light.props.zoom }}°</span>
      <input type="range" :min="zoomRange[0]" :max="zoomRange[1]" step="1" v-model.number="light.props.zoom" />
    </label>

    <label>Dimmer <span>{{ light.props.dimmer }}%</span>
      <input type="range" min="0" max="100" step="1" v-model.number="light.props.dimmer" />
    </label>

    <div v-if="resolved.fixture.colour === 'rgb'" class="modes">
      <button :class="{ on: light.props.mode === 'cct' }" @click="light.props.mode = 'cct'">CCT</button>
      <button :class="{ on: light.props.mode === 'hsi' }" @click="light.props.mode = 'hsi'">HSI</button>
    </div>

    <template v-if="resolved.fixture.colour === 'daylight'">
      <div class="readout">Colour: 5600K (daylight only) <i class="swatch" :style="{ background: resolved.colourHex }"></i></div>
    </template>
    <template v-else-if="light.props.mode === 'cct' || resolved.fixture.colour !== 'rgb'">
      <label>Colour temperature <span>{{ light.props.cct }}K <i class="swatch" :style="{ background: resolved.colourHex }"></i></span>
        <input type="range" class="kelvin" :min="resolved.fixture.cct[0]" :max="resolved.fixture.cct[1]" step="50" v-model.number="light.props.cct" />
      </label>
      <label v-if="resolved.fixture.colour === 'rgb'">G / M <span>{{ gmLabel }}</span>
        <input type="range" class="gm" min="-100" max="100" step="5" v-model.number="light.props.gm" />
      </label>
    </template>
    <template v-else>
      <label>Hue <span>{{ light.props.hue }}° <i class="swatch" :style="{ background: resolved.colourHex }"></i></span>
        <input type="range" class="hue" min="0" max="360" step="1" v-model.number="light.props.hue" />
      </label>
      <label>Saturation <span>{{ light.props.sat }}%</span>
        <input type="range" min="0" max="100" step="1" v-model.number="light.props.sat" />
      </label>
    </template>

    <label v-if="resolved.emitter.shape === 'tube'">Orientation
      <select v-model="light.props.orientation">
        <option value="vertical">Vertical</option>
        <option value="horizontal">Horizontal</option>
      </select>
    </label>
    <div v-if="!(resolved.emitter.shape === 'tube' && light.props.orientation === 'vertical') && !resolved.omni" class="tilt">
      <span class="caption">Tilt</span>
      <TiltWheel v-model="light.props.tilt" icon="light" label="Light tilt" />
    </div>

    <div class="readout">
      {{ resolved.omni ? 'Omni' : `Beam ${Math.round(resolved.beam)}°` }} · {{ Math.round(resolved.candela).toLocaleString() }} cd on-axis
      <div v-for="reading in readings" :key="reading.name">→ {{ reading.name }}: {{ reading.lux }} lux</div>
    </div>
  </div>
</template>

<script lang="ts">
import { computed, defineComponent } from 'vue'
import TiltWheel from './controls/TiltWheel.vue'
import { FIXTURES } from '../library/fixtures'
import { modifiersFor } from '../library/modifiers'
import { illuminanceAt, isZoomable, resolveLight, subjectMeterPoint } from '../library/photometry'
import { CATEGORY_LABELS, COLOUR_LABELS, FixtureCategory } from '../library/types'
import { getItem, scene, setFixture, setModifier } from '../scene/store'
import { LightItem, SubjectItem } from '../scene/types'

export default defineComponent({
  name: 'LightProperties',
  components: { TiltWheel },
  props: {
    id: { type: String, required: true }
  },
  setup(props) {
    const light = computed(() => {
      const item = getItem(props.id)
      return item && item.kind === 'light' ? item : undefined
    })
    const resolved = computed(() => resolveLight(light.value as LightItem))
    const modifiers = computed(() => modifiersFor(resolved.value.fixture))
    const zoomRange = computed(() => {
      const m = resolved.value.modifier
      return isZoomable(m) ? m.beam : null
    })
    const baseOutput = computed(() => {
      const f = resolved.value.fixture
      return f.lumens ? `${f.lumens} lm` : `${f.luxAt1m.toLocaleString()} lux@1m${f.category === 'spot' ? ' (reflector)' : ''}`
    })
    const gmLabel = computed(() => {
      const gm = (light.value as LightItem).props.gm
      return gm === 0 ? '0' : gm < 0 ? `${-gm} green` : `${gm} magenta`
    })
    const readings = computed(() => {
      const item = light.value as LightItem
      return scene.items
        .filter((s): s is SubjectItem => s.kind === 'subject')
        .map(s => ({ name: s.name, lux: Math.round(illuminanceAt(item, subjectMeterPoint(s))).toLocaleString() }))
    })

    const fixturesIn = (category: FixtureCategory) => FIXTURES.filter(f => f.category === category)
    const onFixture = (event: Event) => setFixture(light.value as LightItem, (event.target as HTMLSelectElement).value)
    const onModifier = (event: Event) => setModifier(light.value as LightItem, (event.target as HTMLSelectElement).value)

    return {
      light, resolved, modifiers, zoomRange, baseOutput, gmLabel, readings, fixturesIn, onFixture, onModifier,
      categories: CATEGORY_LABELS, colourLabels: COLOUR_LABELS
    }
  }
})
</script>

<style scoped>
.light-props { display: flex; flex-direction: column; gap: 12px; }
.tilt { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.tilt .caption { align-self: flex-start; color: var(--muted); }
label { display: flex; flex-direction: column; gap: 4px; color: var(--muted); }
label > span { color: var(--text); display: flex; align-items: center; gap: 6px; }
select { width: 100%; box-sizing: border-box; }
.spec, .readout { color: var(--muted); font-size: 12px; line-height: 1.5; }
.note { font-style: italic; }
.approx { color: #1a1a1a; background: var(--muted); border-radius: 3px; padding: 0 4px; font-size: 11px; }
.modes { display: flex; gap: 4px; }
.modes button { flex: 1; }
.modes button.on { background: var(--accent); border-color: var(--accent); color: #1a1a1a; }
.swatch { display: inline-block; width: 12px; height: 12px; border-radius: 50%; border: 1px solid var(--line); }
.kelvin { background: linear-gradient(to right, #ff9a3c, #ffd9b0, #fff, #cfe0ff); border-radius: 4px; height: 6px; }
.gm { background: linear-gradient(to right, #7ddc7d, #eee, #e07de0); border-radius: 4px; height: 6px; }
.hue { background: linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red); border-radius: 4px; height: 6px; }
</style>
