<template>
  <div class="scope-dock">
    <figure v-for="id in scopes" :key="id" class="scope">
      <canvas :ref="el => setCanvas(id, el)" :width="SIZES[id][0]" :height="SIZES[id][1]"></canvas>
      <figcaption>{{ LABELS[id] }}</figcaption>
    </figure>
  </div>
</template>

<script lang="ts">
import { defineComponent, PropType, watch } from 'vue'
import { FrameCapture } from '../../live/LiveScene'
import { drawHistogram, drawVectorscope, drawWaveform, sample } from '../../live/scopes'
import { ScopeId } from '../../scene/types'

const SIZES: Record<ScopeId, [number, number]> = {
  histogram: [240, 90],
  waveform: [240, 120],
  parade: [240, 120],
  vectorscope: [130, 130]
}
const LABELS: Record<ScopeId, string> = {
  histogram: 'HISTOGRAM',
  waveform: 'WAVEFORM RGB',
  parade: 'RGB PARADE',
  vectorscope: 'VECTORSCOPE'
}

export default defineComponent({
  name: 'ScopeDock',
  props: {
    frame: { type: Object as PropType<FrameCapture | null>, default: null },
    scopes: { type: Array as PropType<ScopeId[]>, required: true }
  },
  setup(props) {
    const canvases = new Map<ScopeId, HTMLCanvasElement>()
    const setCanvas = (id: ScopeId, el: unknown) => {
      if (el instanceof HTMLCanvasElement) canvases.set(id, el)
      else canvases.delete(id)
    }

    watch(() => props.frame, frame => {
      if (!frame) return
      const s = sample(frame)
      props.scopes.forEach(id => {
        const ctx = canvases.get(id)?.getContext('2d')
        if (!ctx) return
        if (id === 'histogram') drawHistogram(ctx, s)
        else if (id === 'vectorscope') drawVectorscope(ctx, s)
        else drawWaveform(ctx, s, id === 'parade')
      })
    })

    return { setCanvas, SIZES, LABELS }
  }
})
</script>

<style scoped>
.scope-dock { display: flex; gap: 6px; align-items: flex-end; pointer-events: none; }
.scope { margin: 0; background: rgba(0, 0, 0, 0.62); border: 1px solid rgba(255, 255, 255, 0.12); border-radius: 3px; padding: 3px; }
canvas { display: block; }
figcaption { font-size: 8px; letter-spacing: 1px; color: rgba(255, 255, 255, 0.55); margin-top: 2px; }
</style>
