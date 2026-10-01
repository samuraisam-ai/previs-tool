import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Scene } from '@babylonjs/core/scene'
import { srgbToLinear } from '../library/colour'
import { drawPattern } from '../props/patterns'
import { Finish } from '../scene/types'

// One shared PBR material per distinct finish (8 identical chairs → 1 material), with pattern
// textures generated once and cached. Unused materials are released after each sync.

const hexToLinear = (hex: string): Color3 => {
  const n = parseInt(hex.replace('#', ''), 16)
  const [r, g, b] = srgbToLinear([((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255])
  return new Color3(r, g, b)
}

export class PropMaterials {
  private materials = new Map<string, { material: PBRMaterial; users: number }>()
  private textures = new Map<string, DynamicTexture>()
  private glow = new Set<PBRMaterial>()
  private disposed = new WeakSet<PBRMaterial>()
  private brightness = 1

  constructor(
    private scene: Scene,
    private surface: (name: string) => PBRMaterial,
    private textureSize: () => number,
    private imageUrl: (id: string) => Promise<string | null>,
    private onChange: () => void
  ) {}

  // `fit`: the mesh has its own 0–1 UVs (artwork, screens) — images fill it rather than tile.
  acquire(f: Finish, fit: boolean): PBRMaterial {
    const key = JSON.stringify([f, fit])
    const hit = this.materials.get(key)
    if (hit) { hit.users++; return hit.material }
    const m = this.surface(`prop-${this.materials.size}`)
    // There is no environment map to reflect (it would change the calibrated exposure), and fully
    // metallic PBR without one renders almost black. Cap metalness so metals keep their colour and
    // highlights.
    m.metallic = Math.min(f.metalness, 0.55)
    m.roughness = f.roughness
    const showsImage = f.pattern === 'image' && !!f.imageId
    if (f.pattern !== 'none' && f.pattern !== 'image') {
      const tex = this.pattern(f)
      m.albedoTexture = tex
      m.albedoColor = Color3.White()
      // One texture tile = `scale` metres (UVs are in metres); fitted parts show one tile.
      tex.uScale = tex.vScale = fit ? 1 : 1 / Math.max(0.01, f.scale)
      tex.wAng = (f.rotation * Math.PI) / 180
    } else m.albedoColor = hexToLinear(f.colour)
    if (showsImage && f.imageId) this.loadImage(m, f, fit)
    if (f.material === 'velvet' || f.material === 'fabric') {
      m.sheen.isEnabled = true
      m.sheen.intensity = f.material === 'velvet' ? 0.6 : 0.25
      m.sheen.color = hexToLinear(f.colour).scale(1.4)
    }
    if (f.material === 'glass' || f.opacity < 0.999) {
      m.alpha = Math.max(0.05, f.opacity)
      m.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
      m.backFaceCulling = false
    }
    if (f.material === 'glow') {
      m.emissiveColor = hexToLinear(f.colour).scale(this.brightness)
      this.glow.add(m)
    }
    // A mirror reads as a bright, glossy silver panel (true reflections would re-render the scene).
    if (f.material === 'mirror') {
      m.metallic = 0
      m.roughness = Math.min(f.roughness, 0.08)
      m.albedoColor = hexToLinear(f.colour).scale(0.85)
    }
    this.materials.set(key, { material: m, users: 1 })
    return m
  }

  release(m: PBRMaterial): void {
    this.materials.forEach((entry, key) => {
      if (entry.material !== m) return
      entry.users--
      if (entry.users <= 0) {
        this.glow.delete(m)
        this.disposed.add(m)
        m.dispose(false, true)
        this.materials.delete(key)
      }
    })
  }

  // Glowing parts (screens, shades) stay readable at any exposure, like the set markers.
  setBrightness(value: number): void {
    if (Math.abs(value - this.brightness) < 1e-6) return
    this.brightness = value
    this.materials.forEach(({ material }, key) => {
      const f = JSON.parse(key)[0] as Finish
      if (f.material === 'glow') material.emissiveColor = hexToLinear(f.colour).scale(value)
    })
  }

  // A texture for this finish's pattern. The canvas/GPU texture is shared by every finish with the
  // same pattern and colours; each material gets a light wrapper with its own scale and rotation.
  private pattern(f: Finish): Texture {
    const size = this.textureSize()
    const key = `${f.pattern}|${f.colour}|${f.colour2}|${size}`
    let base = this.textures.get(key)
    if (!base) {
      base = new DynamicTexture(`pattern-${key}`, { width: size, height: size }, this.scene, true)
      drawPattern(base.getContext() as unknown as CanvasRenderingContext2D, size, f.pattern, f.colour, f.colour2)
      base.update()
      this.textures.set(key, base)
    }
    const internal = base.getInternalTexture()
    const tex = new Texture(null, this.scene)
    if (internal) {
      internal.incrementReferences()
      ;(tex as unknown as { _texture: unknown })._texture = internal
    }
    tex.wrapU = tex.wrapV = Texture.WRAP_ADDRESSMODE
    tex.anisotropicFilteringLevel = 4
    return tex
  }

  private loadImage(m: PBRMaterial, f: Finish, fit: boolean): void {
    if (!f.imageId) return
    this.imageUrl(f.imageId).then(url => {
      if (!url || this.disposed.has(m)) return
      const tex = new Texture(url, this.scene, false, true, Texture.TRILINEAR_SAMPLINGMODE, () => this.onChange())
      if (!fit) tex.uScale = tex.vScale = 1 / Math.max(0.01, f.scale)
      tex.wAng = (f.rotation * Math.PI) / 180
      m.albedoTexture = tex
      m.albedoColor = Color3.White()
      this.onChange()
    })
  }

  dispose(): void {
    this.materials.forEach(({ material }) => material.dispose(false, false))
    this.textures.forEach(t => t.dispose())
    this.materials.clear()
    this.textures.clear()
  }
}
