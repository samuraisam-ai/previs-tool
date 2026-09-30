import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { ShadowLight } from '@babylonjs/core/Lights/shadowLight'
import { SpotLight } from '@babylonjs/core/Lights/spotLight'
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Scene } from '@babylonjs/core/scene'

// A fixed pool of Babylon lights that fixtures borrow. Every material's shader depends on how many
// lights (and shadowed lights) exist, so creating or deleting a light forces every shader to
// recompile — seconds on integrated GPUs. With a pool, adding a fixture just claims a free slot:
// the shader never changes. Free slots stay at zero intensity.
//
// Shadows are the expensive part per pixel, and cost rises steeply with the number of shadowed
// lights in one shader (measured on an Intel Iris Plus: 2 shadowed ≈ 25 ms, 3 ≈ 114 ms, 5 ≈ 350 ms
// at 1.5× on a 1024 px view), so only a budgeted number of slots carry shadow maps. The most
// important fixtures get those.

export type SlotType = 'spot' | 'point'

export interface Slot {
  type: SlotType
  light: ShadowLight
  shadows: ShadowGenerator | null
  owner: string | null
}

export interface PoolShape {
  spots: number // total spot slots
  points: number // total point slots
  shadowSpots: number // of which carry shadows
  shadowPoints: number
  shadowMapSize: number
  softShadows: boolean // contact-hardening (PCSS) vs PCF
}

export interface LightRequest {
  id: string
  type: SlotType
  shadow: boolean
}

export class LightPool {
  private slots: Slot[] = []
  private shape: PoolShape | null = null

  constructor(private scene: Scene) {}

  // (Re)build the pool. Only called when the quality tier changes (one recompile).
  configure(shape: PoolShape): void {
    if (this.shape && JSON.stringify(this.shape) === JSON.stringify(shape)) return
    this.slots.forEach(s => { s.shadows?.dispose(); s.light.dispose() })
    this.slots = []
    this.shape = shape
    for (let i = 0; i < shape.spots; i++) this.slots.push(this.makeSlot('spot', i < shape.shadowSpots))
    for (let i = 0; i < shape.points; i++) this.slots.push(this.makeSlot('point', i < shape.shadowPoints))
  }

  private makeSlot(type: SlotType, shadowed: boolean): Slot {
    const index = this.slots.length
    const light: ShadowLight = type === 'spot'
      ? new SpotLight(`slot-${index}`, Vector3.Zero(), new Vector3(0, -1, 0), Math.PI / 3, 1, this.scene)
      : new PointLight(`slot-${index}`, Vector3.Zero(), this.scene)
    light.intensity = 0
    light.shadowMinZ = 0.05
    light.shadowMaxZ = 25
    let shadows: ShadowGenerator | null = null
    if (shadowed && this.shape) {
      shadows = new ShadowGenerator(type === 'point' ? Math.min(1024, this.shape.shadowMapSize) : this.shape.shadowMapSize, light)
      if (type === 'point') shadows.usePoissonSampling = true
      else if (this.shape.softShadows) {
        shadows.useContactHardeningShadow = true
        shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM
      } else {
        shadows.usePercentageCloserFiltering = true
        shadows.filteringQuality = ShadowGenerator.QUALITY_LOW
      }
      shadows.bias = 0.0008
      const map = shadows.getShadowMap() as RenderTargetTexture
      map.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE
    }
    return { type, light, shadows, owner: null }
  }

  // Give each request a slot of its type (shadowed if asked and available), keeping existing
  // assignments where possible. Grows the pool if it runs out (a one-off recompile).
  assign(requests: LightRequest[]): Map<string, Slot> {
    const result = new Map<string, Slot>()
    const wanted = new Set(requests.map(r => r.id))
    this.slots.forEach(s => { if (s.owner && !wanted.has(s.owner)) this.free(s) })
    const fits = (s: Slot, r: LightRequest) => s.type === r.type && !!s.shadows === r.shadow
    // Keep slots that still match.
    requests.forEach(r => {
      const current = this.slots.find(s => s.owner === r.id)
      if (current && fits(current, r)) result.set(r.id, current)
      else if (current) this.free(current)
    })
    requests.forEach(r => {
      if (result.has(r.id)) return
      let slot = this.slots.find(s => !s.owner && fits(s, r))
      // No shadowed slot left: fall back to an unshadowed one rather than growing shadows.
      if (!slot && r.shadow) slot = this.slots.find(s => !s.owner && s.type === r.type && !s.shadows)
      if (!slot) {
        slot = this.makeSlot(r.type, false)
        this.slots.push(slot)
      }
      slot.owner = r.id
      result.set(r.id, slot)
    })
    return result
  }

  private free(slot: Slot): void {
    slot.owner = null
    slot.light.intensity = 0
  }

  get shadowGenerators(): ShadowGenerator[] {
    return this.slots.map(s => s.shadows).filter((g): g is ShadowGenerator => g !== null)
  }

  // Assign casters to every shadow map and re-render them once.
  refreshShadows(casters: AbstractMesh[] | null): void {
    this.slots.forEach(s => {
      const map = s.shadows?.getShadowMap() as RenderTargetTexture | null | undefined
      if (!map) return
      if (casters) map.renderList = casters.slice()
      map.resetRefreshCounter()
    })
  }

  get budget(): { spots: number; points: number } {
    return { spots: this.shape?.shadowSpots ?? 0, points: this.shape?.shadowPoints ?? 0 }
  }
}
