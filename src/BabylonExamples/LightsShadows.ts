import '@babylonjs/loaders/glTF'
import {
  AbstractMesh,
  Color3,
  Engine,
  FreeCamera,
  GlowLayer,
  HemisphericLight,
  Light,
  LightGizmo,
  Mesh,
  MeshBuilder,
  PointLight,
  Scene,
  SceneLoader,
  ShadowGenerator,
  SpotLight,
  UtilityLayerRenderer,
  Vector3
} from '@babylonjs/core'

export class LightsShadows {
  private engine: Engine
  public scene: Scene
  lightTubes!: AbstractMesh[]
  models!: AbstractMesh[]
  ball!: AbstractMesh

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

    const camera = new FreeCamera('camera1', new Vector3(0, 1.5, -7), scene)
    camera.attachControl(this.canvas, true)
    camera.speed = 0.25

    const fillLight = new HemisphericLight('hemiFill', new Vector3(0, 1, 0), scene)
    fillLight.intensity = 0

    this.createEnvironment().catch(() => {
      // Fallback keeps the lesson runnable when the .glb is not available yet.
      const lightTubeLeft = MeshBuilder.CreateCylinder('lightTubeLeft', { height: 1.8, diameter: 0.2 }, this.scene)
      lightTubeLeft.position = new Vector3(-1.5, 0.9, -1)

      const lightTubeRight = MeshBuilder.CreateCylinder('lightTubeRight', { height: 1.8, diameter: 0.2 }, this.scene)
      lightTubeRight.position = new Vector3(1.5, 0.9, -1)

      const ground = MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, this.scene)
      this.models = [ground, lightTubeLeft, lightTubeRight]
      this.lightTubes = [lightTubeLeft, lightTubeRight]

      this.ball = MeshBuilder.CreateSphere('ball', { diameter: 0.5 }, this.scene)
      this.ball.position = new Vector3(0, 0.5, 0)

      const glowLayer = new GlowLayer('glow', this.scene)
      glowLayer.intensity = 1.25
      glowLayer.addIncludedOnlyMesh(lightTubeLeft as Mesh)
      glowLayer.addIncludedOnlyMesh(lightTubeRight as Mesh)

      this.createLights()
    })

    return scene
  }

  async createEnvironment(): Promise<void> {
    const { meshes: importedMeshes } = await SceneLoader.ImportMeshAsync('', './models/', 'lights-shadows.glb', this.scene)
    this.models = importedMeshes

    this.lightTubes = this.models.filter(mesh => mesh.name === 'lightTubeLeft' || mesh.name === 'lightTubeRight')

    this.ball = MeshBuilder.CreateSphere('ball', { diameter: 0.5 }, this.scene)
    this.ball.position = new Vector3(0, 0.5, 0)

    const glowLayer = new GlowLayer('glow', this.scene)
    glowLayer.intensity = 1.25
    this.lightTubes.forEach(mesh => glowLayer.addIncludedOnlyMesh(mesh as Mesh))

    this.createLights()
  }

  createLights(): void {
    // PHASE 6 - HemisphericLight (commented out)
    // const hemiLight = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), this.scene)
    // hemiLight.diffuse = new Color3(1, 0, 0)
    // hemiLight.groundColor = new Color3(0, 0, 1)
    // hemiLight.specular = new Color3(0, 1, 0)
    // this.createGizmos(hemiLight)

    // PHASE 8 - DirectionalLight (commented out)
    // const directionalLight = new DirectionalLight('dirLight', new Vector3(0, -1, 0), this.scene)
    // this.createGizmos(directionalLight)

    // PHASE 9/10/11 - PointLight + parent + clone (commented out)
    // const pointLight = new PointLight('tubePoint', new Vector3(0, 1, 0), this.scene)
    // pointLight.diffuse = new Color3(255 / 255, 180 / 255, 120 / 255)
    // pointLight.intensity = 0.25
    // pointLight.parent = this.lightTubes[0]
    // const pointClone = pointLight.clone('tubePointClone') as PointLight
    // pointClone.parent = this.lightTubes[1]

    // PHASE 12-16 - Spotlight + shadows (active)
    const spotLight = new SpotLight(
      'spotLight',
      new Vector3(0, 0.5, -3),
      new Vector3(0, 1, 3),
      Math.PI / 2,
      10,
      this.scene
    )
    spotLight.intensity = 25
    if (spotLight) {
      this.createGizmos(spotLight)
    }

    spotLight.shadowEnabled = true
    spotLight.shadowMinZ = 1
    spotLight.shadowMaxZ = 10

    const shadowGen = new ShadowGenerator(2048, spotLight)
    shadowGen.useBlurCloseExponentialShadowMap = true

    this.ball.receiveShadows = true
    shadowGen.addShadowCaster(this.ball)

    this.models.forEach(mesh => {
      mesh.receiveShadows = true
      shadowGen.addShadowCaster(mesh)
    })
  }

  createGizmos(light: Light | null | undefined): void {
    if (!light) {
      return
    }

    const gizmo = new LightGizmo()
    gizmo.light = light
    gizmo.scaleRatio = 0.5

    if (light.parent) {
      gizmo.attachedMesh = light.parent as AbstractMesh
    }

    UtilityLayerRenderer.DefaultKeepDepthUtilityLayer.utilityLayerScene.addLight(light)
  }
}