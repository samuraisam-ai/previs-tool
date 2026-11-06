import { HouseSpec } from './demoHouse'

// Sets for the "30 Days of Previs" posts, built in code and opened by set link (?set=<slug>).
// House style (Craig's brief): a simple room with a back room, light dressing, and depth behind the
// subject through the camera. Nanlite key on the far side of the subject so the camera sees the
// shadow side of the face, an edge light on the same line as the key behind them, negative fill on
// the camera side, and a background that is barely lit (a practical paints in the detail).

export interface CampaignSet { title: string; view: string; spec: HouseSpec }

// Heading (degrees, 0 = +z, clockwise) from one point to another, for aiming lights and cameras.
const aim = (from: [number, number], to: [number, number]): number =>
  Math.round((((Math.atan2(to[0] - from[0], to[1] - from[1]) * 180) / Math.PI) + 360) % 360)

// ── Lounge, kitchen behind ───────────────────────────────────────────────────
//   z 8 ┌─────────────────────┐
//       │   lamp   Kitchen    │  sideboard + lit lamp on the far wall, seen through the doorway
//  4.2  ├────┐    ┌───────────┤  doorway at x 1.3–2.5: left of Maya in frame
//       │flag        Maya edge│  Maya on the right third, key and edge on her far side
//       │                 key │  (frame right), both out of frame
//     0 └─────────────────────┘  Camera A front-left on a 50mm
//      x 0                   5
const MAYA: [number, number] = [2.6, 3.0]
const CAM: [number, number] = [1.0, 0.5]
const KEY: [number, number] = [4.4, 2.2]
const EDGE: [number, number] = [4.4, 3.8]

const LOUNGE_NIGHT: HouseSpec = {
  rooms: [
    { name: 'Lounge', r: [0, 0, 5, 4.2], floor: { material: 'wood', colour: '#5a3c2a', colour2: '#46301f', pattern: 'planks', scale: 1.1 }, walls: { material: 'painted', colour: '#857d72' } },
    { name: 'Kitchen', r: [0, 4.2, 5, 8], floor: { material: 'ceramic', colour: '#8a857c', colour2: '#625d56', pattern: 'tiles', scale: 0.6, roughness: 0.35 }, walls: { material: 'painted', colour: '#5b564e' } }
  ],
  openings: [
    ['opening', 1.9, 4.2, 1.2],
    ['window', 4.0, 8, 1.4],
    ['door', 0, 1.2]
  ],
  props: [
    { id: 'rug', x: 2.6, z: 2.7, r: 90, s: { w: 2.4, d: 1.6 }, f: { rug: { colour: '#2c3440', colour2: '#8c7b63', pattern: 'geometric', scale: 0.8 } } },
    { id: 'painting', x: 3.8, z: 4.1, s: { w: 0.6, h: 0.8 }, f: { canvas: { pattern: 'geometric', colour: '#2f3b55', colour2: '#a8957a', scale: 0.5 } } },
    { id: 'floor-plant', x: 4.6, z: 3.8, o: { species: 'fiddle' } },
    // Kitchen, seen through the doorway: the practical paints its back wall.
    { id: 'sideboard', x: 2.8, z: 7.75 },
    { id: 'table-lamp', x: 2.4, z: 7.75, light: true },
    { id: 'painting', x: 3.0, z: 7.9, s: { w: 0.7, h: 0.55 }, f: { canvas: { pattern: 'floral', colour: '#3a2f2a', colour2: '#b0802c', scale: 0.4 } } },
    { id: 'floor-plant', x: 0.6, z: 7.5, o: { species: 'monstera' }, s: { h: 1.1 } },
    // Negative fill: a black flag on Maya's camera side, just out of frame left.
    { id: 'panel', name: 'Negative fill (black flag)', x: 0.9, z: 2.7, r: aim([0.9, 2.7], MAYA), s: { w: 1.0, h: 1.8 }, f: { surface: { material: 'fabric', colour: '#111111' } } }
  ],
  cast: [{ name: 'Maya', x: MAYA[0], z: MAYA[1], r: 150, height: 1.7, props: { pose: 'relaxed' } }],
  cameras: [{ name: 'Camera A', x: CAM[0], z: CAM[1], r: aim(CAM, [2.1, 3.0]), height: 1.5, lens: 'aizu-50', subject: 0, settings: { tStop: 2, nd: { fitted: true, stops: 4 } } }],
  lights: [
    { name: 'Key', fixture: 'forza-300b-ii', modifier: 'sb-oc-120', x: KEY[0], z: KEY[1], r: aim(KEY, MAYA), height: 2.2, tilt: 12, dimmer: 10, cct: 4300 },
    { name: 'Edge', fixture: 'forza-60b-ii', modifier: 'fl-11', x: EDGE[0], z: EDGE[1], r: aim(EDGE, MAYA), height: 2.2, tilt: 14, dimmer: 50, cct: 3600 }
  ],
  world: { preset: 'night', percent: 15, kelvin: 7500, blackout: false, bounce: 30 }
}

export const CAMPAIGN_SETS: Record<string, CampaignSet> = {
  'lounge-night': { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT },
  // Day 1 of 30 Days of Previs used the lounge.
  d01: { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT }
}
