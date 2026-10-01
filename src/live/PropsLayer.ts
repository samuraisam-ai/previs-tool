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

  // Returns true when anything changed (shadows and depth need refreshing).
  sync(props: PropItem[]): boolean {
    let changed = false
    const seen = new Set<string>()
    props.forEach(item => {
      seen.add(item.id)
      const { x, z, rotationY, props: p } = item
      const shapeKey = JSON.stringify([p.catalogId, p.w, p.d, p.h, p.options, p.finishes])
      let b = this.built.get(item.id)
      if (!b || b.shapeKey !== shapeKey) {
        if (b) this.remove(item.id)
        b = this.build(item, shapeKey)
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
    return changed
  }

  private build(item: PropItem, shapeKey: string): Built {
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
        const material = this.materials.acquire(finishOf(item, part.slot), part.fit)
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
    this.built.forEach(b => b.meshes.forEach(m => { if (includeSmall || !m.small) out.push(m.mesh) }))
    return out
  }

  get count(): number {
    return this.built.size
  }

  dispose(): void {
    Array.from(this.built.keys()).forEach(id => this.remove(id))
    this.materials.dispose()
    this.root.dispose()
  }
}
