import { Engine, Scene, FreeCamera, HemisphericLight, Vector3, MeshBuilder } from '@babylonjs/core'

export class BasicScene {
  private engine: Engine
  public scene: Scene

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

    const camera = new FreeCamera('camera1', new Vector3(0, 1, -5), scene)
    camera.attachControl(this.canvas, true)

    const light = new HemisphericLight('hemiLight', new Vector3(0, 1, 0), scene)
    light.intensity = 0.5

    MeshBuilder.CreateGround('ground', { width: 10, height: 10 }, scene)

    const ball = MeshBuilder.CreateSphere('ball', { diameter: 1 }, scene)
    ball.position = new Vector3(0, 1, 0)

    return scene
  }
}
