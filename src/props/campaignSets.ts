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

// ── Office by day (Day 4: "12 cinema primes" carousel and "Same shot. Four lenses." Reel) ──
// Reference ref-05, matched as closely as the app allows: Maya seated behind a wide mahogany desk, her
// body turned open to the camera, which sits off to the side, a dark wood pier behind her head between two tall windows with
// vertical blinds (slats built from thin panels), a brass desk lamp at frame right, manila folders on
// the desk. Daylight: a soft key from the left window, an edge from the same window behind her.
//   z 4.4 ├──window──┬pier┬──window──┬wood┤  blinds half open
//         │   edge        Maya           │  office chair
//         │ key        ═══ desk ═══ lamp │
//         │                              │
//     0   └── Camera A ──────────────────┘  seated eye height, 75mm, panned right to Maya
//        x 0                            5
const D04_MAYA: [number, number] = [2.95, 3.45]
// Okuhle's angle (9 Nov, from his "What I'm looking for" setup): off to the side, 75mm, panned back to Maya.
const D04_CAM: [number, number] = [1.1, 0.55]
// Behind the camera on the window side: the 1.2 m lantern stays out of frame even on the 18mm.
const D04_KEY: [number, number] = [0.5, 0.3]
// The edge stands in the left window's corner, out of frame from 35mm up (the wide lenses show the rig).
const D04_EDGE: [number, number] = [0.2, 3.95]
const WALL_Z = 4.4

// Vertical blinds: thin slats across a window, turned so daylight slips between them.
const blinds = (x0: number, x1: number, sill: number, top: number): HouseSpec['props'] => {
  const n = Math.round((x1 - x0) / 0.1)
  return Array.from({ length: n }, (_, i) => ({
    id: 'panel', name: 'Blind slat', x: +(x0 + 0.05 + i * ((x1 - x0 - 0.1) / (n - 1))).toFixed(3), z: WALL_Z - 0.12, r: 55,
    e: sill + 0.03, s: { w: 0.09, d: 0.004, h: top - sill - 0.08 }, f: { surface: { material: 'glow', colour: '#d9cdb2', roughness: 1 } }
  }))
}

const OFFICE_DAY: HouseSpec = {
  rooms: [
    { name: 'Office', r: [0, 0, 5, WALL_Z], floor: { material: 'wood', colour: '#3a2418', colour2: '#2e1c12', pattern: 'planks', scale: 0.9 }, walls: { material: 'painted', colour: '#8a7a64' } }
  ],
  openings: [
    ['window', 1.15, WALL_Z, 1.7, 0.7, 1.9],
    ['window', 3.45, WALL_Z, 1.1, 0.85, 1.75]
  ],
  props: [
    // Day outside: a glowing backing (a translight) behind each window, the blinds backlit in front of it.
    { id: 'panel', name: 'Translight', x: 1.15, z: WALL_Z + 0.9, s: { w: 2.4, d: 0.02, h: 2.7 }, f: { surface: { material: 'glow', colour: '#fff1dc' } } },
    { id: 'panel', name: 'Translight', x: 3.45, z: WALL_Z + 0.9, s: { w: 1.8, d: 0.02, h: 2.7 }, f: { surface: { material: 'glow', colour: '#fff1dc' } } },
    ...blinds(0.3, 2.0, 0.7, 2.6),
    ...blinds(2.9, 4.0, 0.85, 2.6),
    // The dark wood pier behind her head, with its gold patterned inset, and a second pier at frame right.
    { id: 'panel', name: 'Wood pier', x: 2.45, z: WALL_Z - 0.06, s: { w: 0.85, d: 0.1, h: 2.7 }, f: { surface: { material: 'wood', colour: '#2a1a12', colour2: '#1f130d' } } },
    { id: 'panel', name: 'Gold inset', x: 2.45, z: WALL_Z - 0.12, e: 1.0, s: { w: 0.45, d: 0.01, h: 0.8 }, f: { surface: { material: 'painted', pattern: 'floral', colour: '#6e5734', colour2: '#3e2e18', scale: 0.2 } } },
    { id: 'panel', name: 'Wood pier', x: 4.3, z: WALL_Z - 0.06, s: { w: 0.55, d: 0.1, h: 2.7 }, f: { surface: { material: 'wood', colour: '#2a1a12', colour2: '#1f130d' } } },
    // The low dark sill (radiator cover) under the right window.
    { id: 'sideboard', x: 3.45, z: WALL_Z - 0.25, r: 180, s: { w: 1.1, h: 0.8 }, f: { fronts: { material: 'wood', colour: '#2a1a12', colour2: '#1f130d' }, body: { material: 'wood', colour: '#2a1a12', colour2: '#1f130d' } } },
    // Desk across the frame, Maya behind it in the office chair.
    { id: 'desk', x: 3.25, z: 2.75, r: 180, s: { w: 2.0, d: 0.85 }, f: { top: { material: 'wood', colour: '#4a2216', colour2: '#381910' }, base: { material: 'wood', colour: '#3a1a10' } } },
    { id: 'office-chair', x: D04_MAYA[0], z: D04_MAYA[1] + 0.05, r: 180, f: { seat: { material: 'leather', colour: '#2a2220' } } },
    // Off, as in the reference: by day it is set dressing, not a source.
    { id: 'desk-lamp', x: 3.6, z: 2.95, r: 270, s: { h: 0.7 }, f: { body: { material: 'metal', colour: '#d9c9a4', roughness: 0.2 } } },
    // Dressing: a stack of manila folders, a keyboard, an open folder in front of her.
    { id: 'box', name: 'Folders', x: 3.4, z: 2.85, e: 0.75, r: 8, s: { w: 0.36, d: 0.27, h: 0.06 }, f: { surface: { material: 'paper', colour: '#c9a46a' } } },
    { id: 'box', name: 'Keyboard', x: 2.85, z: 2.85, e: 0.75, r: 6, s: { w: 0.44, d: 0.16, h: 0.03 }, f: { surface: { material: 'plastic', colour: '#18181a' } } },
    { id: 'box', name: 'Open folder', x: 2.5, z: 2.6, e: 0.75, r: -4, s: { w: 0.45, d: 0.3, h: 0.01 }, f: { surface: { material: 'paper', colour: '#e3d2a8' } } }
  ],
  cast: [{ name: 'Maya', x: D04_MAYA[0], z: D04_MAYA[1], r: 220, height: 1.85, props: { pose: 'sit', skin: '#7a5038', top: '#2f2c2a', bottom: '#2a2826', headYaw: 6 } }],
  cameras: [{ name: 'Camera A', x: D04_CAM[0], z: D04_CAM[1], r: 30, height: 1.3, tilt: 5, lens: 'aizu-75', subject: 0, settings: { tStop: 2.8, nd: { fitted: true, stops: 5 }, wb: 5600 } }],
  lights: [
    { name: 'Key', fixture: 'forza-500b-ii', modifier: 'lt-120', x: D04_KEY[0], z: D04_KEY[1], r: aim(D04_KEY, D04_MAYA), height: 2.2, tilt: 10, dimmer: 100, cct: 5000 },
    { name: 'Edge', fixture: 'forza-300b-ii', modifier: 'fl-20g', x: D04_EDGE[0], z: D04_EDGE[1], r: 102, height: 2.6, tilt: 30, dimmer: 100, cct: 5000 }
  ],
  world: { preset: 'day', percent: 20, kelvin: 4600, blackout: false, bounce: 60 }
}

export const CAMPAIGN_SETS: Record<string, CampaignSet> = {
  // Day 4: the office (ref-05), through every Aizu prime.
  d04: { title: 'Office by day', view: 'Camera A', spec: OFFICE_DAY },
  // Day 3: one key, five modifiers.
  d03: { title: 'Bedroom at night', view: 'Camera A', spec: BEDROOM_NIGHT },
  // Day 2: built from an empty floor in the Reel.
  d02: { title: 'Study at dusk', view: 'Camera A', spec: STUDY_DUSK },
  'lounge-night': { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT },
  // Day 1 of 30 Days of Previs used the lounge.
  d01: { title: 'Lounge at night', view: 'Camera A', spec: LOUNGE_NIGHT }
}
