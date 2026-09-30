import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { nextTick } from 'vue'
import { lightPropsFor, makeRoom, makeWall, scene } from '../scene/store'
import { LightItem, Opening, SceneDoc } from '../scene/types'
import { LiveScene } from './LiveScene'

// Dev-only performance benchmark. Each "frame" does the real work of one frame — apply a change,
// let the scene sync, render, and wait for the GPU — and is timed, so both average cost and the
// spikes that cause jitter are measured even when the browser throttles animation frames.

interface Stats { p50: number; p95: number; max: number; mean: number }

function stats(samples: number[]): Stats {
  const s = [...samples].sort((a, b) => a - b)
  const at = (q: number) => s[Math.min(s.length - 1, Math.floor(q * s.length))]
  const round = (v: number) => Math.round(v * 10) / 10
  return { p50: round(at(0.5)), p95: round(at(0.95)), max: round(s[s.length - 1]), mean: round(s.reduce((a, b) => a + b, 0) / s.length) }
}

// Block until the GPU has finished everything queued so far.
function gpuSync(live: LiveScene): void {
  const gl = (live.scene.getEngine() as unknown as { _gl: WebGL2RenderingContext })._gl
  const px = new Uint8Array(4)
  gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
}

async function timeFrames(live: LiveScene, frames: number, step: (i: number) => void | Promise<void>, archChanged = false): Promise<Stats> {
  const samples: number[] = []
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now()
    await step(i)
    await nextTick()
    // The app batches syncs per animation frame; call it directly so its cost is measured.
    live.sync(scene, archChanged)
    live.scene.render()
    gpuSync(live)
    samples.push(performance.now() - t0)
  }
  return stats(samples)
}

async function timeDial(live: LiveScene, frames: number, step: (i: number) => void): Promise<Stats> {
  const samples: number[] = []
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now()
    step(i)
    await nextTick()
    live.sync(scene, false)
    live.drawPending()
    gpuSync(live)
    samples.push(performance.now() - t0)
  }
  return stats(samples)
}

// A three-room test house with five lights (one outside a window) and two cameras.
export function buildTestHouse(doc: SceneDoc = scene): void {
  const rect = (x0: number, z0: number, x1: number, z1: number) => [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]
  const rooms = [makeRoom('Living', rect(-3, -2.5, 3, 2.5)), makeRoom('Kitchen', rect(3, -2.5, 7, 2.5)), makeRoom('Bedroom', rect(-3, 2.5, 3, 6.5))]
  const walls = [
    makeWall({ x: -3, z: -2.5 }, { x: 3, z: -2.5 }), makeWall({ x: 3, z: -2.5 }, { x: 7, z: -2.5 }),
    makeWall({ x: 7, z: -2.5 }, { x: 7, z: 2.5 }), makeWall({ x: 7, z: 2.5 }, { x: 3, z: 2.5 }),
    makeWall({ x: 3, z: 2.5 }, { x: 3, z: -2.5 }), makeWall({ x: 3, z: 2.5 }, { x: 3, z: 6.5 }),
    makeWall({ x: 3, z: 6.5 }, { x: -3, z: 6.5 }), makeWall({ x: -3, z: 6.5 }, { x: -3, z: 2.5 }),
    makeWall({ x: -3, z: 2.5 }, { x: -3, z: -2.5 }), makeWall({ x: -3, z: 2.5 }, { x: 3, z: 2.5 })
  ]
  const opening = (id: string, wallIndex: number, kind: Opening['kind'], offset: number, openAngle = 0): Opening => ({
    id, wallId: walls[wallIndex].id, kind, offset, width: kind === 'window' ? 1.2 : 0.9, height: kind === 'window' ? 1.2 : 2.1,
    sill: kind === 'window' ? 0.9 : 0, hinge: 'left', swing: 'in', openAngle, openTo: 90
  })
  const openings = [opening('bench-door-1', 4, 'door', 2.5, 90), opening('bench-door-2', 9, 'door', 3, 75), opening('bench-win-1', 2, 'window', 2.5), opening('bench-win-2', 6, 'window', 3)]
  const light = (id: string, fixtureId: string, x: number, z: number, rotationY: number, height: number, modifierId?: string): LightItem => {
    const props = lightPropsFor(fixtureId)
    if (modifierId) props.modifierId = modifierId
    props.dimmer = 40
    return { id, kind: 'light', name: id, x, z, rotationY, height, props }
  }
  const cameras = doc.items.filter(i => i.kind === 'camera')
  const subjects = doc.items.filter(i => i.kind === 'subject')
  doc.walls.splice(0, doc.walls.length, ...walls)
  doc.rooms.splice(0, doc.rooms.length, ...rooms)
  doc.openings.splice(0, doc.openings.length, ...openings)
  doc.items.splice(0, doc.items.length, ...subjects, ...cameras,
    light('bench-key', 'forza-300b-ii', -1.5, -0.6, 50, 2.1, 'para-90'),
    light('bench-fill', 'pavoslim-120c', 1.8, -1, 320, 1.8),
    light('bench-tube', 'pavotube-ii-30c', 5, 1.5, 200, 1.2),
    light('bench-bulb', 'pavobulb-10c', -2, 5, 0, 1.4),
    light('bench-sun', 'fc-500c', 9, 0.5, 270, 2.4, 'rf-bm-45'))
}

// Rough GPU memory held by render targets and textures.
function gpuMemoryMB(live: LiveScene): number {
  const textures = (live.scene.getEngine() as unknown as { getLoadedTexturesCache(): Array<{ width: number; height: number; type: number; samples?: number }> }).getLoadedTexturesCache()
  let bytes = 0
  textures.forEach(t => {
    const bpp = t.type === 1 ? 16 : t.type === 2 ? 8 : 4
    bytes += t.width * t.height * bpp * Math.max(1, t.samples ?? 1)
  })
  return Math.round(bytes / 1048576)
}

export type Test = 'idle' | 'orbit' | 'planDrag' | 'settingsChange' | 'dial'

// One benchmark test (call them one at a time; each takes a few seconds).
export async function measure(live: LiveScene, test: Test, frames = 20): Promise<Stats & { test: string; view: string; px: string }> {
  const engine = live.scene.getEngine()
  const cam = live.scene.activeCamera
  const orbit = cam instanceof ArcRotateCamera ? cam : null
  const wall = scene.walls[0]
  const camera = scene.items.find(i => i.kind === 'camera')
  const steps: Record<Test, (i: number) => void> = {
    idle: () => undefined,
    orbit: () => { if (orbit) orbit.alpha += 0.01 },
    // A wall end being dragged on the plan (60× a second during a drag).
    planDrag: i => { wall.b = { x: wall.b.x + (i % 2 ? 0.01 : -0.01), z: wall.b.z } },
    // Turning the ISO dial: nothing in the scene geometry changes.
    settingsChange: i => { if (camera?.kind === 'camera') camera.props.iso = i % 2 ? 800 : 1000 },
    dial: i => { if (camera?.kind === 'camera') camera.props.tStop = i % 2 ? 2.8 : 4 }
  }
  // 'dial' goes through the app's own frame logic (which re-processes instead of redrawing).
  const result = test === 'dial' ? await timeDial(live, frames, steps.dial) : await timeFrames(live, frames, steps[test], test === 'planDrag')
  return { test, view: cam?.name ?? 'none', px: `${engine.getRenderWidth()}x${engine.getRenderHeight()}`, ...result }
}

// Time from adding a light until a correct frame is on screen.
export async function lightAdd(live: LiveScene): Promise<number> {
  const t0 = performance.now()
  scene.items.push({ id: 'bench-added', kind: 'light', name: 'added', x: 0, z: 1.5, rotationY: 180, height: 2, props: lightPropsFor('forza-60b-ii') })
  await nextTick()
  live.sync(scene, false)
  // Render until every mesh's shaders are ready (what a user waits for).
  for (let n = 0; n < 400 && !live.scene.isReady(); n++) {
    live.scene.render()
    gpuSync(live)
    await new Promise(r => setTimeout(r, 5))
  }
  live.scene.render()
  gpuSync(live)
  const ms = Math.round(performance.now() - t0)
  const i = scene.items.findIndex(x => x.id === 'bench-added')
  if (i >= 0) scene.items.splice(i, 1)
  return ms
}

export { gpuMemoryMB }

// Build the test house and wait until everything is ready (optionally looking through Camera A).
export async function setup(live: LiveScene, cameraView: boolean): Promise<void> {
  buildTestHouse()
  await nextTick()
  live.sync(scene, true)
  const camera = scene.items.find(i => i.kind === 'camera')
  live.viewThrough(cameraView && camera ? camera.id : null)
  live.sync(scene, false)
  for (let i = 0; i < 60 && !live.scene.isReady(); i++) {
    live.scene.render()
    await new Promise(r => setTimeout(r, 100))
  }
  live.drawPending()
}
