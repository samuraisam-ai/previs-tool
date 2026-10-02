import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { getDef } from '../props/catalog'
import { finishOf, paramsOf } from '../props/create'
import { PropItem } from '../scene/types'
import { BabylonKit } from './propKit'
import { PropMaterials } from './propMaterials'

// The 3D set dressing. Each prop is built once from its catalogue generator (one mesh per finish
// slot) and only rebuilt when its shape or finishes change; moving or turning it just moves its node.

const DEG = Math.PI / 180

export interface Glow { colour: [number, number, number]; level: number }

interface Built {
  shapeKey: string
  node: TransformNode
  meshes: Array<{ mesh: Mesh; material: PBRMaterial; small: boolean }>
}

export class PropsLayer {
  private root: TransformNode
  private built = new Map<string, Built>()
  readonly materials: PropMaterials

  constructor(
    private scene: Scene,
    surface: (name: string) => PBRMaterial,
    textureSize: () => number,
    imageUrl: (id: string) => Promise<string | null>,
    onChange: () => void,
    private layerMask: number
  ) {
    this.root = new TransformNode('props', scene)
    this.materials = new PropMaterials(scene, surface, textureSize, imageUrl, onChange)
  }

  // Props still waiting to be built (a big set builds over several frames).
  pending = 0
  // When the set is still, every prop sharing a material is merged into one batch mesh: hundreds of
  // draw calls become roughly one per material. Editing un-batches; it re-batches once idle.
  private batches: Array<{ mesh: Mesh; small: boolean }> = []
  private lastChange = 0

  // Returns true when anything changed (shadows and depth need refreshing).
  // `glowFor` gives a lit practical's shade glow (bulb colour, level), or null.
  // Building stops at `deadline` (performance.now() ms); the rest wait for the next call, so a
  // whole house never freezes the app — it fills in over a few frames.
  sync(props: PropItem[], glowFor: (id: string) => Glow | null = () => null, deadline = Infinity): boolean {
    let changed = false
    this.pending = 0
    const seen = new Set<string>()
    props.forEach(item => {
      seen.add(item.id)
      const { x, z, rotationY, props: p } = item
      const glow = glowFor(item.id)
      const shapeKey = JSON.stringify([p.catalogId, p.w, p.d, p.h, p.options, p.finishes, glow])
      let b = this.built.get(item.id)
      if (!b || b.shapeKey !== shapeKey) {
        if (performance.now() > deadline) { this.pending++; return }
        if (b) this.remove(item.id)
        b = this.build(item, shapeKey, glow)
        this.built.set(item.id, b)
        changed = true
      }
      const n = b.node
      if (n.position.x !== x || n.position.y !== p.elevation || n.position.z !== z || n.rotation.y !== rotationY * DEG) {
        n.position.set(x, p.elevation, z)
        n.rotation.y = rotationY * DEG
        changed = true
      }
    })
    Array.from(this.built.keys()).forEach(id => {
      if (!seen.has(id)) { this.remove(id); changed = true }
    })
    if (changed) {
      this.unbatch()
      this.lastChange = performance.now()
    }
    return changed
  }

  // Merge the still set into per-material batches. Returns true when it did (shadows need a refresh).
  batchIfIdle(idleMs = 500): boolean {
    if (this.batches.length || this.pending || !this.built.size || performance.now() - this.lastChange < idleMs) return false
    const groups = new Map<string, { material: PBRMaterial; small: boolean; meshes: Mesh[] }>()
    this.built.forEach(b => b.meshes.forEach(m => {
      const key = `${m.material.uniqueId}|${m.small ? 1 : 0}`
      const g = groups.get(key) ?? { material: m.material, small: m.small, meshes: [] }
      g.meshes.push(m.mesh)
      groups.set(key, g)
    }))
    groups.forEach(g => {
      if (g.meshes.length < 2) return
      const merged = Mesh.MergeMeshes(g.meshes, false, true, undefined, false, false)
      if (!merged) return
      merged.name = `prop-batch-${g.material.name}`
      merged.material = g.material
      merged.isPickable = false
      merged.receiveShadows = true
      merged.layerMask = this.layerMask
      merged.freezeWorldMatrix()
      g.meshes.forEach(m => m.setEnabled(false))
      this.batches.push({ mesh: merged, small: g.small })
    })
    return this.batches.length > 0
  }

  private unbatch(): void {
    if (!this.batches.length) return
    this.batches.forEach(b => b.mesh.dispose(false, false))
    this.batches = []
    this.built.forEach(b => b.meshes.forEach(m => m.mesh.setEnabled(true)))
  }

  private build(item: PropItem, shapeKey: string, glow: Glow | null): Built {
    const node = new TransformNode(item.id, this.scene)
    node.parent = this.root
    const def = getDef(item.props.catalogId)
    const meshes: Built['meshes'] = []
    if (def) {
      const kit = new BabylonKit(this.scene)
      try {
        def.build(kit, paramsOf(item.props))
      } catch (e) {
        console.warn(`Prop ${def.id} failed to build`, e)
      }
      kit.finish(item.id).forEach(part => {
        const lit = glow && def.practical?.glowSlot === part.slot ? glow : undefined
        const material = this.materials.acquire(finishOf(item, part.slot), part.fit, lit)
        part.mesh.material = material
        part.mesh.parent = node
        part.mesh.isPickable = false
        part.mesh.receiveShadows = true
        part.mesh.layerMask = this.layerMask
        part.mesh.freezeNormals()
        meshes.push({ mesh: part.mesh, material, small: part.small })
      })
    }
    return { shapeKey, node, meshes }
  }

  private remove(id: string): void {
    const b = this.built.get(id)
    if (!b) return
    b.meshes.forEach(({ mesh, material }) => {
      mesh.dispose(false, false)
      this.materials.release(material)
    })
    b.node.dispose()
    this.built.delete(id)
  }

  // Shadow casters; the Lite tier leaves small details out.
  casters(includeSmall: boolean): AbstractMesh[] {
    const out: AbstractMesh[] = []
    this.batches.forEach(b => { if (includeSmall || !b.small) out.push(b.mesh) })
    this.built.forEach(b => b.meshes.forEach(m => { if (m.mesh.isEnabled() && (includeSmall || !m.small)) out.push(m.mesh) }))
    return out
  }

  get count(): number {
    return this.built.size
  }

  dispose(): void {
    this.unbatch()
    Array.from(this.built.keys()).forEach(id => this.remove(id))
    this.materials.dispose()
    this.root.dispose()
  }
}
