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

// ── Study at dusk, hallway behind (Day 2: "Empty floor → lit set") ─────────
// The lounge mirrored: Maya on the left third, key and edge on her far side (frame left, out of
// frame), motivated by the study window. A PavoTube hidden in the hallway paints its back wall.
//   z 6 ┌─────────────────────┐
//       │      Hallway   lamp │  console + lit lamp + painting, seen through the doorway
//  4.2  ├───────────┐    ┌────┤  doorway at x 2.5–3.7: right of Maya in frame
//  win  │edge sofa         flag│
//       │key   Maya          │
//     0 └─────────────────────┘  Camera A front-right on a 50mm
//      x 0                   5
const D02_MAYA: [number, number] = [2.6, 3.0]
const D02_CAM: [number, number] = [4.0, 0.5]
const D02_KEY: [number, number] = [0.6, 2.2]
const D02_EDGE: [number, number] = [0.4, 3.9]
const D02_TUBE: [number, number] = [4.6, 4.6]

const STUDY_DUSK: HouseSpec = {
  rooms: [
    { name: 'Study', r: [0, 0, 5, 4.2], floor: { material: 'wood', colour: '#4a3324', colour2: '#3a281c', pattern: 'herringbone', scale: 0.8 }, walls: { material: 'painted', colour: '#5f6a63' } },
    { name: 'Hallway', r: [0, 4.2, 5, 6], floor: { material: 'wood', colour: '#6e4a32', colour2: '#573a27', pattern: 'planks', scale: 1.0 }, walls: { material: 'painted', colour: '#a39a8a' } }
  ],
  openings: [
    ['opening', 3.1, 4.2, 1.2],
    ['window', 0, 2.2, 1.4],
    ['door', 5, 5.1]
  ],
  props: [
    { id: 'rug', x: 2.2, z: 2.8, r: 90, s: { w: 2.2, d: 1.5 }, f: { rug: { colour: '#5e1f24', colour2: '#b0802c', pattern: 'geometric', scale: 0.7 } } },
    { id: 'sofa', x: 1.3, z: 3.75, r: 180, o: { seats: 2, pillows: 1 }, f: { upholstery: { material: 'leather', colour: '#6b3a22' }, cushions: { material: 'leather', colour: '#6b3a22' } } },
    // Hallway, seen through the doorway: the practical and the hidden tube paint its back wall.
    { id: 'console-table', x: 3.2, z: 5.8 },
    { id: 'table-lamp', x: 2.8, z: 5.8, light: true },
    { id: 'painting', x: 3.3, z: 5.95, e: 1.5, s: { w: 0.6, h: 0.75 }, f: { canvas: { pattern: 'marble', colour: '#e6d8bf', colour2: '#33456b', scale: 0.6 } } },
    // Negative fill: a black flag on Maya's camera side, just out of frame right.
    { id: 'panel', name: 'Negative fill (black flag)', x: 4.1, z: 2.7, r: aim([4.1, 2.7], D02_MAYA), s: { w: 1.0, h: 1.8 }, f: { surface: { material: 'fabric', colour: '#111111' } } }
  ],
  cast: [{ name: 'Maya', x: D02_MAYA[0], z: D02_MAYA[1], r: 205, height: 1.7, props: { pose: 'relaxed' } }],
  cameras: [{ name: 'Camera A', x: D02_CAM[0], z: D02_CAM[1], r: aim(D02_CAM, [2.9, 3.0]), height: 1.5, lens: 'aizu-50', subject: 0, settings: { tStop: 2, nd: { fitted: true, stops: 4 } } }],
  lights: [
    { name: 'Key', fixture: 'forza-300b-ii', modifier: 'sb-oc-120', x: D02_KEY[0], z: D02_KEY[1], r: aim(D02_KEY, D02_MAYA), height: 2.2, tilt: 12, dimmer: 7, cct: 4300 },
    { name: 'Edge', fixture: 'forza-60b-ii', modifier: 'fl-11', x: D02_EDGE[0], z: D02_EDGE[1], r: aim(D02_EDGE, D02_MAYA), height: 2.2, tilt: 14, dimmer: 50, cct: 3600 },
    { name: 'Hall wash', fixture: 'pavotube-ii-30c', x: D02_TUBE[0], z: D02_TUBE[1], r: aim(D02_TUBE, [3.2, 6]), height: 1.0, dimmer: 15, cct: 3200 }
  ],
  world: { preset: 'evening', percent: 15, kelvin: 5600, blackout: false, bounce: 30 }
}

export const CAMPAIGN_SETS: Record<string, CampaignSet> = {
  // Day 2: built from an empty floor in the Reel.
  d02: { title: 'Study at dusk', view: 'Camera A', spec: STUDY_DUSK },
  'lounge-night': { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT },
  // Day 1 of 30 Days of Previs used the lounge.
  d01: { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT }
}
