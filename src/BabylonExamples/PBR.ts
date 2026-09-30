import { Engine, Scene, FreeCamera, HemisphericLight, Vector3, MeshBuilder, CubeTexture, PBRMaterial, Texture, Color3, GlowLayer, Mesh } from '@babylonjs/core'

export class PBR {
  private engine: Engine
  public scene: Scene
  public models: Mesh[] = []
  public ball: Mesh | null = null

  constructor(private canvas: HTMLCanvasElement) {
    this.engine = new Engine(this.canvas, true)
    this.scene = this.createScene()
    this.engine.runRenderLoop(() => this.scene.render())

    window.addEventListener('resize', () => {
      this.engine.resize()
    })
  }

  createScene(): Scene {
    const scene = new Scene(this.engine)
    this.scene = scene

    const envTex = CubeTexture.CreateFromPrefilteredData('./environment/snowy_forest_2k.env', scene)
    scene.environmentTexture = envTex
    scene.createDefaultSkybox(envTex, true, 1000, 0)

    const glowLayer = new GlowLayer('glow', this.scene)
    glowLayer.intensity = 4

    const camera = new FreeCamera('camera1', new Vector3(0, 1, -5), scene)
    camera.attachControl(this.canvas, true)
    camera.speed = 0.25

    const light = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
    light.intensity = 0

    this.createEnvironment()

    return scene
  }

  createEnvironment(): void {
    const ground = MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, this.scene)
    ground.material = this.createAsphalt()

    const ball = MeshBuilder.CreateSphere('ball', { diameter: 1 }, this.scene)
    ball.position = new Vector3(0, 1, 0)
    ball.material = this.createMagic()

    const boxLeft = MeshBuilder.CreateBox('boxLeft', { size: 1 }, this.scene)
    boxLeft.position = new Vector3(-3, 0.5, 2)

    const boxRight = MeshBuilder.CreateBox('boxRight', { size: 1.25 }, this.scene)
    boxRight.position = new Vector3(3, 0.625, -2)

    this.ball = ball
    this.models = [ground, ball, boxLeft, boxRight]
  }

  createAsphalt(): PBRMaterial {
    const pbr = new PBRMaterial('PBR', this.scene)
    pbr.roughness = 1

    pbr.albedoTexture = new Texture('./textures/asphalt/forrest_diffuse.jpg', this.scene)
    pbr.bumpTexture = new Texture('./textures/asphalt/forrest_normal.jpg', this.scene)
    pbr.invertNormalMapX = true
    pbr.invertNormalMapY = true

    pbr.metallicTexture = new Texture('./textures/asphalt/forrest_ao.jpg', this.scene)
    pbr.useAmbientOcclusionFromMetallicTextureRed = true
    pbr.useRoughnessFromMetallicTextureGreen = true
    pbr.useMetallnessFromMetallicTextureBlue = true

    return pbr
  }

  createMagic(): PBRMaterial {
    const pbr = new PBRMaterial('PBR', this.scene)
    pbr.roughness = 1

    pbr.albedoTexture = new Texture('./textures/rocks/rocks_diffuse.jpg', this.scene)
    pbr.bumpTexture = new Texture('./textures/rocks/rocks_normal.jpg', this.scene)
    pbr.invertNormalMapX = true
    pbr.invertNormalMapY = true

    pbr.metallicTexture = new Texture('./textures/rocks/rocks_ao.jpg', this.scene)
    pbr.useAmbientOcclusionFromMetallicTextureRed = true
    pbr.useRoughnessFromMetallicTextureGreen = true
    pbr.useMetallnessFromMetallicTextureBlue = true

    pbr.emissiveColor = new Color3(0, 1, 0)
    pbr.emissiveTexture = new Texture('./textures/magic/<emissive>.png', this.scene)
    pbr.emissiveIntensity = 3

    return pbr
  }
}
