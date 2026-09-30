import { Color3, DirectionalLight, MeshBuilder, PBRMaterial, Scene, TransformNode, Vector3 } from '@babylonjs/core'
import { srgbToLinear } from '../library/colour'

// Dev-only colour-pipeline test: a 24-patch chart (ColorChecker-style sRGB values) lit by a
// directional light of exactly `lux` illuminance, so the image pipeline can be measured on its own.

export const CHART_SRGB: Array<[string, number, number, number]> = [
  ['dark skin', 115, 82, 68], ['light skin', 194, 150, 130], ['blue sky', 98, 122, 157], ['foliage', 87, 108, 67],
  ['blue flower', 133, 128, 177], ['bluish green', 103, 189, 170], ['orange', 214, 126, 44], ['purplish blue', 80, 91, 166],
  ['moderate red', 193, 90, 99], ['purple', 94, 60, 108], ['yellow green', 157, 188, 64], ['orange yellow', 224, 163, 46],
  ['blue', 56, 61, 150], ['green', 70, 148, 73], ['red', 175, 54, 60], ['yellow', 231, 199, 31],
  ['magenta', 187, 86, 149], ['cyan', 8, 133, 161], ['white', 243, 243, 242], ['neutral 8', 200, 200, 200],
  ['neutral 6.5', 160, 160, 160], ['neutral 5', 122, 122, 121], ['neutral 3.5', 85, 85, 85], ['black', 52, 52, 52]
]

export const PATCH = 0.1
const COLS = 6

export interface Chart {
  root: TransformNode
  light: DirectionalLight
  // World-space centre of each patch, in chart order.
  centres: Vector3[]
  dispose(): void
}

// Chart centred at `centre`, facing -z (towards a camera looking +z), lit head-on with `lux`.
export function buildChart(scene: Scene, centre: Vector3, lux: number): Chart {
  const root = new TransformNode('calibration', scene)
  const centres: Vector3[] = []
  CHART_SRGB.forEach(([name, r, g, b], i) => {
    const col = i % COLS
    const row = Math.floor(i / COLS)
    const plane = MeshBuilder.CreatePlane(`patch-${name}`, { size: PATCH * 0.9 }, scene)
    plane.position = new Vector3(centre.x + (col - (COLS - 1) / 2) * PATCH, centre.y - (row - 1.5) * PATCH, centre.z)
    const material = new PBRMaterial(`patch-${name}`, scene)
    const [lr, lg, lb] = srgbToLinear([r / 255, g / 255, b / 255])
    material.albedoColor = new Color3(lr, lg, lb)
    material.metallic = 0
    material.roughness = 1
    material.specularIntensity = 0
    material.maxSimultaneousLights = 16
    plane.material = material
    plane.parent = root
    centres.push(plane.position.clone())
  })
  const light = new DirectionalLight('calibration-light', new Vector3(0, 0, 1), scene)
  light.intensity = lux
  light.diffuse = Color3.White()
  light.specular = Color3.Black()
  return {
    root, light, centres,
    dispose() { root.dispose(false, true); light.dispose() }
  }
}
