import { Engine, Scene, FreeCamera, HemisphericLight, Vector3, MeshBuilder, StandardMaterial, Texture } from '@babylonjs/core'

export class StandardMaterials {
  private engine: Engine
  public scene: Scene
  private specularPower = 1

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

    const camera = new FreeCamera('camera1', new Vector3(0, 2, -5), scene)
    camera.attachControl(this.canvas, true)
    camera.speed = 0.25

    const light = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
    light.intensity = 1

    const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene)
    ground.material = this.createGroundMaterial()

    const ball = MeshBuilder.CreateSphere('ball', { diameter: 1 }, scene)
    ball.position = new Vector3(0, 1, 0)
    ball.material = this.createBallMaterial()

    return scene
  }

  createGroundMaterial(): StandardMaterial {
    const material = new StandardMaterial('groundMat', this.scene)
    const uvScale = 4

    const textures = [
      new Texture('./textures/stone/stone_diffuse.jpg', this.scene),
      new Texture('./textures/stone/stone_normal.jpg', this.scene),
      new Texture('./textures/stone/stone_ao.jpg', this.scene),
      new Texture('./textures/stone/stone_spec.jpg', this.scene)
    ]

    textures.forEach(texture => {
      texture.uScale = uvScale
      texture.vScale = uvScale
    })

    material.diffuseTexture = textures[0]
    material.bumpTexture = textures[1]
    material.invertNormalMapX = true
    material.invertNormalMapY = true
    material.ambientTexture = textures[2]
    material.specularTexture = textures[3]
    material.specularPower = this.specularPower
    return material
  }

  createBallMaterial(): StandardMaterial {
    const material = new StandardMaterial('ballMat', this.scene)
    const uvScale = 1

    const textures = [
      new Texture('./textures/metal/metal_diffuse.jpg', this.scene),
      new Texture('./textures/metal/metal_normal.jpg', this.scene),
      new Texture('./textures/metal/metal_ao.jpg', this.scene),
      new Texture('./textures/metal/metal_spec.jpg', this.scene)
    ]

    textures.forEach(texture => {
      texture.uScale = uvScale
      texture.vScale = uvScale
    })

    material.diffuseTexture = textures[0]
    material.bumpTexture = textures[1]
    material.ambientTexture = textures[2]
    material.specularTexture = textures[3]
    material.specularPower = this.specularPower
    return material
  }
}