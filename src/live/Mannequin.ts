import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Quaternion } from '@babylonjs/core/Maths/math.vector'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { CreateCapsule } from '@babylonjs/core/Meshes/Builders/capsuleBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Scene } from '@babylonjs/core/scene'
import { SubjectProps } from '../scene/types'
import { M3, Posed } from '../subjects/kinematics'
import { JOINTS, JointId } from '../subjects/skeleton'

// The posable mannequin: one node per joint of the canonical skeleton, with smooth low-poly
// segments (tapered capsules, an ellipsoid head, mitten hands, shoes) hanging off them. Built at
// unit height and scaled to the subject; posing only moves nodes, so it costs nothing to re-pose.

type Slot = 'skin' | 'top' | 'bottom' | 'shoes'

// Shared, reference-counted surface materials keyed by colour (eight subjects in the same shirt
// colour share one material).
export class FigureMaterials {
  private cache = new Map<string, { material: PBRMaterial; users: number }>()
  constructor(private create: (name: string, colour: Color3, roughness: number) => PBRMaterial) {}

  acquire(hex: string, slot: Slot): PBRMaterial {
    const roughness = slot === 'skin' ? 0.55 : slot === 'shoes' ? 0.45 : 0.85
    const key = `${hex}|${roughness}`
    let entry = this.cache.get(key)
    if (!entry) {
      entry = { material: this.create(`figure-${key}`, Color3.FromHexString(hex).toLinearSpace(), roughness), users: 0 }
      this.cache.set(key, entry)
    }
    entry.users++
    return entry.material
  }

  release(material: PBRMaterial): void {
    this.cache.forEach((entry, key) => {
      if (entry.material !== material) return
      if (--entry.users <= 0) { entry.material.dispose(); this.cache.delete(key) }
    })
  }

  all(): PBRMaterial[] { return Array.from(this.cache.values()).map(e => e.material) }
}

interface Part { slot: Slot; mesh: Mesh }

export class Mannequin {
  readonly node: TransformNode
  readonly meshes: Mesh[] = []
  private bones = new Map<JointId, TransformNode>()
  private parts: Part[] = []
  private colours: { [slot in Slot]?: string } = {}

  constructor(private scene: Scene, private materials: FigureMaterials, parent: TransformNode) {
    this.node = new TransformNode('figure', scene)
    this.node.parent = parent
    JOINTS.forEach(j => {
      const bone = new TransformNode(j.id, scene)
      bone.parent = j.parent ? (this.bones.get(j.parent) as TransformNode) : this.node
      bone.position.set(...j.offset)
      bone.rotationQuaternion = Quaternion.Identity()
      this.bones.set(j.id, bone)
    })
    this.build()
  }

  private add(joint: JointId, slot: Slot, mesh: Mesh): Mesh {
    mesh.parent = this.bones.get(joint) as TransformNode
    mesh.isPickable = false
    mesh.receiveShadows = true
    this.parts.push({ slot, mesh })
    this.meshes.push(mesh)
    return mesh
  }

  // A tapered limb from the joint along ±y.
  private limb(joint: JointId, slot: Slot, length: number, r0: number, r1: number, down = true, depth = 1): void {
    const mesh = CreateCapsule(`${joint}-seg`, { height: length + (r0 + r1) * 0.9, radiusTop: down ? r0 : r1, radiusBottom: down ? r1 : r0, tessellation: 12, capSubdivisions: 3, subdivisions: 1 }, this.scene)
    mesh.position.y = down ? -length / 2 : length / 2
    mesh.scaling.z = depth
    this.add(joint, slot, mesh)
  }

  private blob(joint: JointId, slot: Slot, size: [number, number, number], at: [number, number, number], segments = 12): Mesh {
    const mesh = CreateSphere(`${joint}-blob`, { diameter: 1, segments }, this.scene)
    mesh.scaling.set(...size)
    mesh.position.set(...at)
    return this.add(joint, slot, mesh)
  }

  private build(): void {
    // Torso
    this.blob('hips', 'bottom', [0.2, 0.13, 0.135], [0, -0.012, -0.004])
    this.limb('spine', 'top', 0.12, 0.07, 0.078, false, 0.72)
    this.blob('chest', 'top', [0.215, 0.19, 0.125], [0, 0.085, -0.008])
    const shoulders = CreateCapsule('shoulders', { height: 0.27, radius: 0.045, tessellation: 12, capSubdivisions: 3 }, this.scene)
    shoulders.rotation.z = Math.PI / 2
    shoulders.position.set(0, 0.128, -0.01)
    this.add('chest', 'top', shoulders)
    // Neck and head (faceless; a nose ridge shows which way it faces)
    this.limb('neck', 'skin', 0.06, 0.03, 0.028, false)
    this.blob('head', 'skin', [0.09, 0.125, 0.11], [0, 0.065, 0.01], 16)
    const nose = CreateBox('nose', { width: 0.016, height: 0.032, depth: 0.02 }, this.scene)
    nose.position.set(0, 0.052, 0.066)
    this.add('head', 'skin', nose)
    ;(['L', 'R'] as const).forEach(s => {
      this.limb(`shoulder${s}`, 'top', 0.186, 0.034, 0.027)
      this.limb(`elbow${s}`, 'skin', 0.146, 0.026, 0.021)
      this.blob(`wrist${s}`, 'skin', [0.03, 0.1, 0.05], [0, -0.048, 0.006], 10)
      this.limb(`hip${s}`, 'bottom', 0.245, 0.058, 0.043)
      this.limb(`knee${s}`, 'bottom', 0.246, 0.041, 0.03)
      this.blob(`ankle${s}`, 'shoes', [0.058, 0.05, 0.165], [0, -0.022, 0.042], 10)
    })
  }

  setColours(p: SubjectProps): void {
    const want: { [slot in Slot]: string } = { skin: p.skin, top: p.top, bottom: p.bottom, shoes: p.shoes }
    ;(Object.keys(want) as Slot[]).forEach(slot => {
      if (this.colours[slot] === want[slot]) return
      this.colours[slot] = want[slot]
      // One acquire per mesh, so releasing each mesh's material stays symmetric.
      this.parts.filter(part => part.slot === slot).forEach(part => {
        const material = this.materials.acquire(want[slot], slot)
        if (part.mesh.material) this.materials.release(part.mesh.material as PBRMaterial)
        part.mesh.material = material
      })
    })
  }

  pose(posed: Posed): void {
    this.node.scaling.setAll(posed.height)
    JOINTS.forEach(j => {
      const bone = this.bones.get(j.id) as TransformNode
      if (!j.parent) bone.position.set(posed.pos.hips[0] / posed.height, posed.pos.hips[1] / posed.height, posed.pos.hips[2] / posed.height)
      setRotation(bone.rotationQuaternion as Quaternion, posed.local[j.id])
    })
  }

  dispose(): void {
    this.parts.forEach(part => { if (part.mesh.material) this.materials.release(part.mesh.material as PBRMaterial) })
    this.node.dispose(false, false)
  }
}

// Kinematics uses column-vector matrices; Babylon uses row vectors, so the matrix is transposed.
const scratch = new Matrix()
function setRotation(q: Quaternion, r: M3): void {
  Matrix.FromValuesToRef(r[0], r[3], r[6], 0, r[1], r[4], r[7], 0, r[2], r[5], r[8], 0, 0, 0, 0, 1, scratch)
  Quaternion.FromRotationMatrixToRef(scratch, q)
}
