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
// Key about 70° off the lens axis on her far side (was ~97°): wraps onto the face, still shadow side.
const D02_KEY: [number, number] = [1.23, 1.41]
const D02_EDGE: [number, number] = [0.25, 3.8]
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
  cast: [{ name: 'Maya', x: D02_MAYA[0], z: D02_MAYA[1], r: 188, height: 1.7, props: { pose: 'relaxed' } }],
  cameras: [{ name: 'Camera A', x: D02_CAM[0], z: D02_CAM[1], r: aim(D02_CAM, [2.75, 3.0]), height: 1.5, lens: 'aizu-50', subject: 0, settings: { tStop: 2, nd: { fitted: true, stops: 4 } } }],
  lights: [
    { name: 'Key', fixture: 'forza-300b-ii', modifier: 'sb-oc-120', x: D02_KEY[0], z: D02_KEY[1], r: aim(D02_KEY, D02_MAYA), height: 2.2, tilt: 12, dimmer: 7, cct: 4300 },
    { name: 'Edge', fixture: 'forza-60b-ii', modifier: 'fl-11', x: D02_EDGE[0], z: D02_EDGE[1], r: aim(D02_EDGE, D02_MAYA), height: 2.2, tilt: 14, dimmer: 50, cct: 3600 },
    { name: 'Hall wash', fixture: 'pavotube-ii-30c', x: D02_TUBE[0], z: D02_TUBE[1], r: aim(D02_TUBE, [3.2, 6]), height: 1.0, dimmer: 15, cct: 3200 }
  ],
  world: { preset: 'evening', percent: 15, kelvin: 5600, blackout: false, bounce: 30 }
}

// ── Bedroom at night, landing behind (Day 3: "One light. Five modifiers.") ──
// One Forza 300B II key plus a fixed edge (Forza 60B II); the Reel swaps the key's modifier (bare, reflector, octa, lantern, fresnel).
// The landing shows through the doorway behind Maya: a desk with a lit table lamp and a laptop, and a
// sconce on its back wall. The key sits high, about 60° off the lens axis, so the light wraps (Rembrandt).
//   z 6 ┌─────────────────────┐
//       │      Landing  desk  │  desk + lamp + painting, seen through the doorway
//  4.4  ├─────────┐    ┌──────┤  doorway at x 2.3–3.5: beside Maya in frame
//       │bed           edge   │
//       │bed        Maya      │
//       │flag            key  │
//     0 └─────────────────────┘  Camera A in the front corner on a 75mm, a little high, tilted down
//      x 0                   5
const D03_MAYA: [number, number] = [2.8, 2.8]
const D03_CAM: [number, number] = [1.2, 0.2]
const D03_LAMP: [number, number] = [3.35, 5.9]
// Edge on her far side, behind her: it stays the same while the key's modifier changes.
const D03_EDGE: [number, number] = [4.4, 3.6]
// Key about 60° off the lens axis and higher (was ~70°, level): towards Rembrandt, the light wraps across the face.
const D03_KEY: [number, number] = [3.44, 1.33]

const BEDROOM_NIGHT: HouseSpec = {
  rooms: [
    { name: 'Bedroom', r: [0, 0, 5, 4.4], floor: { material: 'wood', colour: '#3e2c22', colour2: '#33241b', pattern: 'planks', scale: 1.0 }, walls: { material: 'painted', colour: '#6a7480' } },
    { name: 'Landing', r: [0, 4.4, 5, 6.2], floor: { material: 'wood', colour: '#5a4030', colour2: '#4a3427', pattern: 'planks', scale: 1.0 }, walls: { material: 'painted', colour: '#9a8c78' } }
  ],
  openings: [
    ['opening', 2.9, 4.4, 1.2],
    ['window', 5, 2.9, 1.2],
    ['door', 0, 5.3]
  ],
  props: [
    { id: 'bed', x: 1.1, z: 3.25, r: 90, f: { bedding: { material: 'fabric', colour: '#b9b1a3' }, throw: { material: 'fabric', colour: '#3a3f4a', pattern: 'none' } } },
    { id: 'nightstand', x: 0.25, z: 2.1, r: 90 },
    { id: 'rug', x: 2.9, z: 2.6, r: 90, s: { w: 2.0, d: 1.4 }, f: { rug: { colour: '#2a2a30', colour2: '#7d6a55', pattern: 'geometric', scale: 0.7 } } },
    { id: 'curtains', x: 4.95, z: 2.9, s: { w: 1.6 }, o: { state: 'half' }, f: { fabric: { material: 'velvet', colour: '#2b2f3a' } } },
    // Landing, seen through the doorway: the sconce paints its back wall.
    { id: 'sconce', x: 2.4, z: 6.15, light: true },
    // A desk on the landing: the lamp and the laptop screen leak light into the bedroom behind Maya.
    { id: 'desk', x: 3.0, z: 5.8, r: 180 },
    { id: 'table-lamp', x: D03_LAMP[0], z: D03_LAMP[1], light: true },
    { id: 'laptop', x: 3.0, z: 5.75, r: 180 },
    { id: 'painting', x: 3.1, z: 6.15, e: 1.5, s: { w: 0.55, h: 0.7 }, f: { canvas: { pattern: 'geometric', colour: '#d8c7a6', colour2: '#3b2f2a', scale: 0.5 } } },
    { id: 'floor-plant', x: 1.6, z: 5.8, o: { species: 'snake' }, s: { h: 0.9 } },
    // Negative fill: a black flag on Maya's camera side, just out of frame left.
    { id: 'panel', name: 'Negative fill (black flag)', x: 0.7, z: 1.6, r: aim([0.7, 1.6], D03_MAYA), s: { w: 1.0, h: 1.8 }, f: { surface: { material: 'fabric', colour: '#111111' } } }
  ],
  cast: [{ name: 'Maya', x: D03_MAYA[0], z: D03_MAYA[1], r: 205, height: 1.7, props: { pose: 'relaxed' } }],
  cameras: [{ name: 'Camera A', x: D03_CAM[0], z: D03_CAM[1], r: 26, height: 1.75, tilt: 4, lens: 'aizu-75', subject: 0, settings: { tStop: 2, nd: { fitted: true, stops: 4 } } }],
  lights: [
    { name: 'Key', fixture: 'forza-300b-ii', modifier: 'sb-oc-120', x: D03_KEY[0], z: D03_KEY[1], r: aim(D03_KEY, D03_MAYA), height: 2.8, tilt: 37, dimmer: 8, cct: 4300 },
    { name: 'Edge', fixture: 'forza-60b-ii', modifier: 'fl-11', x: D03_EDGE[0], z: D03_EDGE[1], r: aim(D03_EDGE, D03_MAYA), height: 2.2, tilt: 18, dimmer: 100, cct: 3600 }
  ],
  world: { preset: 'night', percent: 15, kelvin: 7500, blackout: false, bounce: 45 }
}

// ── Workshop at night (Day 4: "12 cinema primes" carousel and "Same shot. Four lenses." Reel) ──
// Reference ref-01: someone hunched over a workbench at night, a table lamp on the bench behind them the only
// visible source, nearly a silhouette with the shadow side to camera, a cool window edge, a dirty foreground.
// Maya works side-on at the bench; the key comes from beyond her, motivated by the lamp, and a cool edge
// from the window behind. A hall glows through the doorway for depth.
//   z 6 ┌─────────────────────┐
//       │   sconce   Hall     │
//  4.4  ├──┐   ┌──window──────┤  doorway at x 1.4–2.4, window behind the bench
//       │         edge   lamp │
//       │            Maya bench│  bench against the right wall, Maya facing it
//       │ plant          key  │
//     0 └─────────────────────┘  Camera A front-left, the plant soft in the foreground
//      x 0                   5
const D04_MAYA: [number, number] = [3.95, 2.5]
const D04_CAM: [number, number] = [3.6, 0.4]
const D04_LAMP: [number, number] = [4.7, 3.15]
const D04_KEY: [number, number] = [4.8, 3.0]
const D04_EDGE: [number, number] = [3.3, 5.4]

const WORKSHOP_NIGHT: HouseSpec = {
  rooms: [
    { name: 'Workshop', r: [0, 0, 5, 4.4], floor: { material: 'concrete', colour: '#4a4744', colour2: '#3c3936', scale: 1.0 }, walls: { material: 'painted', colour: '#5d6168' } },
    { name: 'Hall', r: [0, 4.4, 5, 6.0], floor: { material: 'wood', colour: '#5a4030', colour2: '#4a3427', pattern: 'planks', scale: 1.0 }, walls: { material: 'painted', colour: '#9a8c78' } }
  ],
  openings: [
    ['opening', 1.9, 4.4, 1.0],
    ['window', 3.6, 4.4, 1.4],
    ['door', 0, 2.2]
  ],
  props: [
    // The workbench against the right wall, Maya side-on at it; the lamp on its far end is in frame behind her.
    { id: 'desk', x: 4.62, z: 2.6, r: 270, s: { w: 1.8 } },
    { id: 'table-lamp', x: D04_LAMP[0], z: D04_LAMP[1], light: true },
    { id: 'box', x: 4.65, z: 2.3, s: { w: 0.3, d: 0.25, h: 0.18 } },
    { id: 'wall-cabinets', x: 4.8, z: 2.6, r: 270, e: 1.6, s: { w: 1.6 } },
    { id: 'bookshelf', x: 0.3, z: 3.2, r: 90, s: { w: 1.2 }, o: { books: 'some' } },
    { id: 'filing-cabinet', x: 0.35, z: 4.05 },
    // The hall behind, seen through the doorway.
    { id: 'sconce', x: 1.9, z: 5.95, light: true },
    { id: 'console-table', x: 1.9, z: 5.75, r: 180 },
    // Dirty frame: a plant close to the lens, soft at the left edge of the wider lenses.
    { id: 'floor-plant', x: 3.3, z: 1.15, o: { species: 'fiddle' }, s: { h: 1.3 } }
  ],
  cast: [{ name: 'Maya', x: D04_MAYA[0], z: D04_MAYA[1], r: 90, height: 1.7, props: { pose: 'lean-counter' } }],
  cameras: [{ name: 'Camera A', x: D04_CAM[0], z: D04_CAM[1], r: aim(D04_CAM, [4.3, 2.6]), height: 1.45, tilt: 4, lens: 'aizu-35', subject: 0, settings: { tStop: 2, nd: { fitted: true, stops: 5 } } }],
  lights: [
    { name: 'Key', fixture: 'forza-60b-ii', x: D04_KEY[0], z: D04_KEY[1], r: aim(D04_KEY, D04_MAYA), height: 1.95, tilt: 25, dimmer: 30, cct: 3200 },
    { name: 'Edge', fixture: 'forza-300b-ii', modifier: 'fl-20g', x: D04_EDGE[0], z: D04_EDGE[1], r: aim(D04_EDGE, D04_MAYA), height: 2.55, tilt: 18, dimmer: 45, cct: 6500 }
  ],
  world: { preset: 'night', percent: 4, kelvin: 7500, blackout: false, bounce: 25 }
}

export const CAMPAIGN_SETS: Record<string, CampaignSet> = {
  // Day 4: the workshop, through every Aizu prime.
  d04: { title: 'Workshop at night', view: 'Camera A', spec: WORKSHOP_NIGHT },
  // Day 3: one key, five modifiers.
  d03: { title: 'Bedroom at night', view: 'Camera A', spec: BEDROOM_NIGHT },
  // Day 2: built from an empty floor in the Reel.
  d02: { title: 'Study at dusk', view: 'Camera A', spec: STUDY_DUSK },
  'lounge-night': { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT },
  // Day 1 of 30 Days of Previs used the lounge.
  d01: { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT }
}
