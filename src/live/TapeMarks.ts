import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import { Scene } from '@babylonjs/core/scene'
import { Mark } from '../scene/types'

// Blocking marks on the floor as coloured tape T marks with their number, like on set.
// One small textured decal per mark; rebuilt only when the marks change.

const SIZE = 0.6 // decal size on the floor (m)
const TEX = 128
const DEG = Math.PI / 180

export class TapeMarks {
  private root: TransformNode
  private meshes: Mesh[] = []
  private materials: PBRMaterial[] = []
  private key = ''
  private brightness = 1

  constructor(private scene: Scene, private layerMask: number) {
    this.root = new TransformNode('tape-marks', scene)
  }

  // `colour` gives each owner's tape colour (hex).
  sync(marks: Mark[], colour: (ownerId: string) => string): boolean {
    const key = JSON.stringify(marks.map(m => [m.ownerId, m.order, m.x, m.z, m.rotationY, colour(m.ownerId)]))
    if (key === this.key) return false
    this.key = key
    this.clear()
    marks.forEach(m => {
      const hex = colour(m.ownerId)
      const u = TEX / SIZE // texture px per metre
      // T: crossbar at the toes (towards the top of the texture = the way they face), stem behind.
      this.decal(`tape-${m.id}`, SIZE, g => {
        g.fillStyle = hex
        g.fillRect(TEX / 2 - 0.16 * u, TEX / 2 - 0.125 * u, 0.32 * u, 0.05 * u)
        g.fillRect(TEX / 2 - 0.025 * u, TEX / 2 - 0.1 * u, 0.05 * u, 0.24 * u)
      }, m.x, m.z, m.rotationY)
      // The number stays upright (like the plan), beside the T.
      this.decal(`tape-${m.id}-n`, 0.24, g => {
        g.fillStyle = hex
        g.font = `bold ${Math.round(TEX * 0.7)}px sans-serif`
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        g.fillText(String(m.order), TEX / 2, TEX / 2 + TEX * 0.04)
      }, m.x + 0.22, m.z + 0.22, 0)
    })
    return true
  }

  // A flat textured square on the floor, `size` metres across, turned to `heading`.
  private decal(name: string, size: number, draw: (g: CanvasRenderingContext2D) => void, x: number, z: number, heading: number): void {
    const texture = new DynamicTexture(name, { width: TEX, height: TEX }, this.scene, true)
    texture.hasAlpha = true
    const g = texture.getContext() as unknown as CanvasRenderingContext2D
    g.clearRect(0, 0, TEX, TEX)
    draw(g)
    texture.update()
    const material = new PBRMaterial(name, this.scene)
    material.albedoColor = Color3.Black()
    material.metallic = 0
    material.roughness = 1
    material.emissiveTexture = texture
    material.opacityTexture = texture
    material.emissiveColor = new Color3(1, 1, 1).scale(this.brightness)
    const plane = MeshBuilder.CreatePlane(name, { size }, this.scene)
    plane.material = material
    plane.parent = this.root
    // Lay it flat (texture "up" → +z), then face the heading.
    plane.rotation.set(Math.PI / 2, heading * DEG, 0)
    plane.position.set(x, 0.004, z)
    plane.isPickable = false
    plane.layerMask = this.layerMask
    this.meshes.push(plane)
    this.materials.push(material)
  }

  // Keep the tape readable at any exposure, like the other set markers.
  setBrightness(value: number): void {
    if (Math.abs(value - this.brightness) < 1e-6) return
    this.brightness = value
    this.materials.forEach(m => { m.emissiveColor = new Color3(1, 1, 1).scale(value) })
  }

  private clear(): void {
    this.meshes.forEach(m => m.dispose(false, true))
    this.meshes = []
    this.materials = []
  }

  dispose(): void {
    this.clear()
    this.root.dispose()
  }
}
