import { loadScene } from '../plan/history'
import { openingDefaults } from '../plan/ops'
import { projectOnWall, uncoveredParts, wallLength } from '../plan/geometry'
import { cameraPropsFor, makeRoom, makeWall, newId, scene } from '../scene/store'
import { CameraItem, Finish, Opening, OpeningKind, PropItem, Pt, RoomArea, SceneItem, SubjectItem, Wall } from '../scene/types'
import { defaultWorld } from '../scene/world'
import { getDef } from './catalog'
import { defaultPropProps } from './create'
import { makeFinish } from './finish'
import { OptionValue } from './types'
import { settleProps } from './placement'
import { lightIt } from './practical'

// A fully dressed 3-bedroom house (~150 props): living room, kitchen-dining, hallway, master
// bedroom, bathroom and two more bedrooms. It's a place to play, and the performance stress scene.
//
//   z  5 ┌──────────┬──────┬──────┬──────┐
//        │  Master  │ Bath │ Bed 2│ Bed 3│
//   1.4  ├──────────┴──────┴──────┴──────┤
//        │            Hallway            │
//     0  ├───────────────┬───────────────┤
//        │  Living room  │ Kitchen-dining│
//    −5  └───────────────┴───────────────┘
//      x −7             0               7

type Rect = [number, number, number, number] // x0, z0, x1, z1

type FinishSpec = Partial<Finish> & { material: Finish['material'] }
interface RoomSpec { name: string; r: Rect; floor: FinishSpec; walls?: FinishSpec }
// [kind, x, z, width?, sill?] — openings are found on whichever wall runs through the point.
type OpeningSpec = [OpeningKind, number, number, number?, number?]
interface P { id: string; x: number; z: number; r?: number; o?: { [k: string]: OptionValue }; s?: { w?: number; d?: number; h?: number }; f?: { [slot: string]: Partial<Finish> }; name?: string; e?: number; light?: boolean }
interface CastSpec { name: string; x: number; z: number; r: number; height: number }
interface CamSpec { name: string; x: number; z: number; r: number; height: number; lens: string; subject: number }
export interface HouseSpec { rooms: RoomSpec[]; openings: OpeningSpec[]; props: P[]; cast: CastSpec[]; cameras: CamSpec[] }

const ROOMS: RoomSpec[] = [
  { name: 'Living room', r: [-7, -5, 0, 0], floor: { material: 'wood', colour: '#8a5a3a', colour2: '#6e4429', pattern: 'planks', scale: 1.1 }, walls: { material: 'painted', colour: '#e9e2d4' } },
  { name: 'Kitchen & dining', r: [0, -5, 7, 0], floor: { material: 'ceramic', colour: '#d9d6cf', colour2: '#9a958c', pattern: 'tiles', scale: 0.6, roughness: 0.3 }, walls: { material: 'painted', colour: '#efeae0' } },
  { name: 'Hallway', r: [-7, 0, 7, 1.4], floor: { material: 'wood', colour: '#8a5a3a', colour2: '#6e4429', pattern: 'herringbone', scale: 0.8 } },
  { name: 'Master bedroom', r: [-7, 1.4, -2, 5], floor: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43', pattern: 'planks', scale: 1.2 }, walls: { material: 'paper', colour: '#e6d8c8', pattern: 'floral', colour2: '#b9827f', scale: 0.5 } },
  { name: 'Bathroom', r: [-2, 1.4, 1, 5], floor: { material: 'ceramic', colour: '#e6e1d8', colour2: '#b0634a', pattern: 'terrazzo', scale: 0.8, roughness: 0.25 }, walls: { material: 'ceramic', colour: '#f2f1ec', colour2: '#c9c6bf', pattern: 'tiles', scale: 0.2, roughness: 0.2 } },
  { name: 'Bedroom 2', r: [1, 1.4, 4, 5], floor: { material: 'fabric', colour: '#8f8a80', pattern: 'weave', scale: 0.05 }, walls: { material: 'painted', colour: '#9aa88f' } },
  { name: 'Bedroom 3', r: [4, 1.4, 7, 5], floor: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72', pattern: 'planks', scale: 1.0 }, walls: { material: 'painted', colour: '#d9e1e8' } }
]

const OPENINGS: OpeningSpec[] = [
  ['door', -7, 0.7], // front door
  ['opening', -3.5, 0, 1.2], ['opening', 3.5, 0, 1.6], ['opening', 0, -2.6, 1.8],
  ['door', -3.0, 1.4], ['door', -0.5, 1.4], ['door', 2.0, 1.4], ['door', 5.0, 1.4],
  ['window', -3.5, -5, 2.2], ['window', 4.6, -5, 1.6], ['window', 1.6, -5, 1.4],
  ['window', -6.0, 5, 1.0], ['window', -0.5, 5, 0.7, 1.4], ['window', 2.5, 5, 1.2], ['window', 5.5, 5, 1.2], ['window', 7, -2.6, 1.4]
]

const PROPS: P[] = [
  // ── Living room ─────────────────────────────────────────────────────────
  { id: 'rug', x: -4.6, z: -2.5, r: 90, s: { w: 2.8, d: 2.0 }, f: { rug: { colour: '#33456b', colour2: '#d8cdb8', pattern: 'geometric', scale: 0.7 } } },
  { id: 'sofa', x: -3.1, z: -2.5, r: 270, o: { seats: 3, pillows: 2 }, f: { upholstery: { colour: '#a9a294' }, cushions: { colour: '#a9a294' }, pillows: { material: 'velvet', colour: '#b0802c' } } },
  { id: 'armchair', x: -5.4, z: -4.2, r: 30, f: { upholstery: { material: 'velvet', colour: '#1f5a46' }, cushion: { material: 'velvet', colour: '#1f5a46' } } },
  { id: 'armchair', x: -5.4, z: -0.9, r: 150, f: { upholstery: { material: 'velvet', colour: '#1f5a46' }, cushion: { material: 'velvet', colour: '#1f5a46' } } },
  { id: 'coffee-table', x: -4.6, z: -2.5, r: 90, o: { shape: 'oval', base: 'pedestal' }, f: { top: { material: 'stone', colour: '#ecebe8', colour2: '#9fa3a8' }, base: { material: 'stone', colour: '#ecebe8', colour2: '#9fa3a8' } } },
  { id: 'media-unit', x: -6.7, z: -2.5, r: 90 },
  { id: 'tv', x: -6.75, z: -2.5, r: 90, o: { inches: '65' } },
  { id: 'bookshelf', x: -6.1, z: -0.25, r: 180, s: { w: 1.2 } },
  { id: 'bookshelf', x: -1.4, z: -0.25, r: 180, s: { w: 1.2 }, o: { books: 'some' } },
  { id: 'side-table', x: -3.0, z: -4.0 },
  { id: 'table-lamp', x: -3.0, z: -4.0, light: true },
  { id: 'floor-lamp', x: -2.9, z: -1.0, o: { style: 'arc' }, r: 90 },
  { id: 'pouf', x: -4.7, z: -1.0 },
  { id: 'floor-plant', x: -2.2, z: -4.5, o: { species: 'fiddle' } },
  { id: 'floor-plant', x: -6.5, z: -4.5, o: { species: 'monstera' }, s: { h: 1.2 } },
  { id: 'painting', x: -5.8, z: -4.9, s: { w: 1.2, h: 0.85 }, f: { canvas: { pattern: 'marble', colour: '#e6d8bf', colour2: '#33456b', scale: 0.8 } } },
  { id: 'painting', x: -1.6, z: -4.9, s: { w: 0.7, h: 0.9 }, f: { canvas: { pattern: 'floral', colour: '#2f3b55', colour2: '#d9b2a8', scale: 0.4 } } },
  { id: 'curtains', x: -3.5, z: -4.9, s: { w: 2.6 }, f: { fabric: { colour: '#d8cdb8' } } },
  { id: 'books', x: -4.5, z: -2.8 },
  { id: 'flowers', x: -4.7, z: -2.2, o: { kind: 'tulips' }, f: { blooms: { colour: '#e67e22' } } },
  { id: 'candles', x: -6.75, z: -3.2, r: 90 },
  { id: 'vase', x: -6.75, z: -1.75, o: { shape: 'amphora' } },
  { id: 'wall-mirror', x: -0.1, z: -1.2, s: { w: 0.8, h: 0.8 } },
  // ── Kitchen & dining ────────────────────────────────────────────────────
  { id: 'sink-unit', x: 2.9, z: -4.6, s: { w: 1.0 } },
  { id: 'base-cabinets', x: 4.0, z: -4.6, s: { w: 1.2 } },
  { id: 'cooker', x: 4.9, z: -4.6 },
  { id: 'base-cabinets', x: 6.07, z: -4.6, s: { w: 1.74 } },
  { id: 'cooker-hood', x: 4.9, z: -4.9 },
  { id: 'wall-cabinets', x: 3.4, z: -4.9, s: { w: 2.4 } },
  { id: 'wall-cabinets', x: 6.07, z: -4.9, s: { w: 1.74 }, o: { glass: true } },
  { id: 'fridge', x: 6.6, z: -1.0, r: 270 },
  { id: 'island', x: 4.6, z: -2.6, s: { w: 2.0 } },
  { id: 'bar-stool', x: 4.0, z: -1.85 }, { id: 'bar-stool', x: 4.6, z: -1.85 }, { id: 'bar-stool', x: 5.2, z: -1.85 },
  { id: 'fruit-bowl', x: 4.3, z: -2.7 },
  { id: 'flowers', x: 5.1, z: -2.75, o: { kind: 'sunflowers' }, f: { blooms: { colour: '#e8b923' }, blooms2: { colour: '#5d4030' } } },
  { id: 'kettle', x: 3.7, z: -4.75 }, { id: 'toaster', x: 4.3, z: -4.75 }, { id: 'microwave', x: 6.4, z: -4.75 },
  { id: 'pots', x: 4.9, z: -4.65 },
  { id: 'dining-table', x: 1.6, z: -2.4, r: 90, o: { seats: 6, chairStyle: 'spindle' } },
  { id: 'pendant', x: 1.6, z: -2.4, o: { shade: 'dome' }, light: true },
  { id: 'place-setting', x: 1.15, z: -2.0, r: 90 }, { id: 'place-setting', x: 2.05, z: -2.0, r: 270 },
  { id: 'place-setting', x: 1.15, z: -2.8, r: 90 }, { id: 'place-setting', x: 2.05, z: -2.8, r: 270 },
  { id: 'candles', x: 1.6, z: -2.4, r: 90 },
  { id: 'sideboard', x: 0.35, z: -4.0, r: 90, s: { w: 1.4 } },
  { id: 'vase', x: 0.35, z: -4.4, o: { shape: 'bottle' } },
  { id: 'photo-frame', x: 0.35, z: -3.8, r: 90 },
  { id: 'potted-plant', x: 0.35, z: -3.5, o: { kind: 'pothos' } },
  { id: 'wall-clock', x: 6.9, z: -3.8 },
  { id: 'floor-plant', x: 6.5, z: -0.3, o: { species: 'olive' }, s: { h: 1.8 } },
  { id: 'poster', x: 2.9, z: -0.1, s: { w: 0.6, h: 0.8 } },
  // ── Hallway ─────────────────────────────────────────────────────────────
  { id: 'rug', x: 0, z: 0.7, s: { w: 6.0, d: 0.8 }, f: { rug: { colour: '#7a2e2a', colour2: '#d8cdb8', pattern: 'chevron', scale: 0.5 } } },
  { id: 'console-table', x: -5.5, z: 1.15, r: 180 },
  { id: 'wall-mirror', x: -5.5, z: 1.3, o: { shape: 'rect' }, s: { w: 0.9, h: 0.6 } },
  { id: 'vase', x: -5.9, z: 1.15, o: { shape: 'bud' } },
  { id: 'books', x: -5.2, z: 1.15, r: 180 },
  { id: 'coat-rack', x: -6.6, z: 1.0 },
  { id: 'shoe-rack', x: -6.4, z: 0.2 },
  { id: 'painting', x: 1.0, z: 0.1, s: { w: 0.8, h: 0.6 }, f: { canvas: { pattern: 'stripes', colour: '#c99b3b', colour2: '#2b2b2d', scale: 0.3, rotation: 45 } } },
  { id: 'painting', x: 5.2, z: 0.1, s: { w: 0.6, h: 0.8 }, f: { canvas: { pattern: 'geometric', colour: '#b5654a', colour2: '#efeae0', scale: 0.4 } } },
  { id: 'painting', x: 0.5, z: 1.3, s: { w: 0.5, h: 0.5 } },
  { id: 'potted-plant', x: 6.7, z: 1.0, o: { kind: 'fern' }, s: { w: 0.4, h: 0.7 } },
  { id: 'sconce', x: -2.0, z: 1.3 }, { id: 'sconce', x: 3.5, z: 1.3 },
  // ── Master bedroom ──────────────────────────────────────────────────────
  { id: 'rug', x: -4.5, z: 3.3, s: { w: 2.6, d: 2.0 }, f: { rug: { colour: '#d8cdb8', colour2: '#b9827f', pattern: 'check', scale: 0.5 } } },
  { id: 'bed', x: -4.5, z: 3.86, r: 180, o: { size: 'king', headboard: 'wingback' }, f: { headboard: { material: 'velvet', colour: '#b9827f' }, throw: { colour: '#3c5641', pattern: 'weave' } } },
  { id: 'nightstand', x: -5.75, z: 4.7, r: 180 }, { id: 'nightstand', x: -3.25, z: 4.7, r: 180 },
  { id: 'table-lamp', x: -5.75, z: 4.7, light: true }, { id: 'table-lamp', x: -3.25, z: 4.7 },
  { id: 'books', x: -3.15, z: 4.6, o: { count: 3 } },
  { id: 'wardrobe', x: -6.65, z: 2.6, r: 90, s: { w: 1.8 }, o: { doors: 3 } },
  { id: 'dresser', x: -5.4, z: 1.7 },
  { id: 'photo-frame', x: -5.6, z: 1.7 }, { id: 'vase', x: -5.0, z: 1.7, o: { shape: 'cylinder' } },
  { id: 'bench', x: -4.5, z: 2.55 },
  { id: 'armchair', x: -2.6, z: 2.1, r: 300, o: { arms: 'rolled' }, f: { upholstery: { material: 'fabric', colour: '#d8cdb8' }, cushion: { material: 'fabric', colour: '#d8cdb8' } } },
  { id: 'floor-lamp', x: -2.4, z: 2.8 },
  { id: 'floor-plant', x: -6.6, z: 4.6, o: { species: 'palm' }, s: { h: 1.4 } },
  { id: 'painting', x: -4.5, z: 4.95, e: 1.4, s: { w: 1.4, h: 0.7 }, f: { canvas: { pattern: 'marble', colour: '#ecebe8', colour2: '#b9827f', scale: 1 } } },
  { id: 'curtains', x: -6.0, z: 4.9, s: { w: 1.5 }, f: { fabric: { material: 'velvet', colour: '#5e1f24' } } },
  { id: 'floor-mirror', x: -2.3, z: 4.6, r: 225 },
  // ── Bathroom ────────────────────────────────────────────────────────────
  { id: 'bathtub', x: -0.5, z: 4.56, r: 180, o: { style: 'freestanding' } },
  { id: 'toilet', x: 0.6, z: 2.4, r: 270 },
  { id: 'vanity', x: -1.7, z: 2.6, r: 90 },
  { id: 'mirror-cabinet', x: -1.9, z: 2.6 },
  { id: 'towel-rail', x: 0.9, z: 3.8 },
  { id: 'bath-mat', x: -0.5, z: 3.8 },
  { id: 'potted-plant', x: -1.7, z: 2.35, o: { kind: 'succulent' }, s: { w: 0.18, h: 0.2 } },
  { id: 'candles', x: -1.2, z: 4.75 },
  // ── Bedroom 2 ───────────────────────────────────────────────────────────
  { id: 'bed', x: 2.6, z: 3.95, r: 180, o: { size: 'double', headboard: 'slatted', pillows: 2 }, f: { bedding: { colour: '#33456b', pattern: 'stripes', colour2: '#f1eee8', scale: 0.3 } } },
  { id: 'nightstand', x: 1.55, z: 4.7, r: 180, o: { drawers: 1 } },
  { id: 'desk', x: 3.6, z: 2.3, r: 270 },
  { id: 'office-chair', x: 3.05, z: 2.3, r: 90 },
  { id: 'desk-lamp', x: 3.75, z: 2.6, r: 270, light: true },
  { id: 'laptop', x: 3.6, z: 2.2, r: 270 },
  { id: 'bookshelf', x: 1.22, z: 2.3, r: 90, s: { w: 0.8, h: 1.6 }, o: { shelves: 4 } },
  { id: 'rug', x: 2.6, z: 2.7, s: { w: 1.6, d: 1.2 }, o: { shape: 'round' }, f: { rug: { colour: '#c99b3b', colour2: '#efeae0', pattern: 'polka', scale: 0.3 } } },
  { id: 'poster', x: 3.9, z: 3.8, s: { w: 0.5, h: 0.7 } },
  { id: 'potted-plant', x: 1.55, z: 4.6, o: { kind: 'cactus' }, s: { w: 0.16, h: 0.3 } },
  { id: 'curtains', x: 2.5, z: 4.9, s: { w: 1.6 }, f: { fabric: { colour: '#efeae0' } } },
  // ── Bedroom 3 ───────────────────────────────────────────────────────────
  { id: 'bed', x: 5.5, z: 3.92, r: 180, o: { size: 'single', headboard: 'panel', pillows: 1 }, f: { bedding: { colour: '#efeae0', pattern: 'check', colour2: '#9aa88f', scale: 0.3 } } },
  { id: 'nightstand', x: 6.45, z: 4.7, r: 180 },
  { id: 'table-lamp', x: 6.45, z: 4.7, o: { base: 'stick', shade: 'dome' } },
  { id: 'wardrobe', x: 4.36, z: 3.2, r: 90, s: { w: 1.0 } },
  { id: 'dressing-table', x: 6.6, z: 2.3, r: 270 },
  { id: 'armchair', x: 4.6, z: 1.95, r: 45, o: { arms: 'none' } },
  { id: 'rug', x: 5.5, z: 2.7, s: { w: 1.8, d: 1.2 }, f: { rug: { colour: '#9aa88f', colour2: '#efeae0', pattern: 'herringbone', scale: 0.4 } } },
  { id: 'painting', x: 5.5, z: 4.95, e: 1.35, s: { w: 0.9, h: 0.6 } },
  { id: 'curtains', x: 5.5, z: 4.9, s: { w: 1.6 } },
  { id: 'string-lights', x: 5.5, z: 1.5, s: { w: 2.6 } },
  { id: 'floor-plant', x: 4.4, z: 4.6, o: { species: 'snake' }, s: { h: 0.9, w: 0.4, d: 0.4 } },
  // ── Extra dressing throughout ───────────────────────────────────────────
  { id: 'cushion', x: -4.9, z: 4.1, r: 180, f: { cover: { colour: '#b9827f' } } },
  { id: 'cushion', x: -4.1, z: 4.1, r: 180, f: { cover: { material: 'fabric', colour: '#d8cdb8', pattern: 'check', colour2: '#b9827f', scale: 0.15 } } },
  { id: 'cushion', x: -5.35, z: -4.1, r: 30, s: { w: 0.4, h: 0.35 }, f: { cover: { material: 'fabric', colour: '#d8cdb8', pattern: 'stripes', colour2: '#1f5a46', scale: 0.12 } } },
  { id: 'cushion', x: 2.6, z: 4.3, r: 180, f: { cover: { material: 'fabric', colour: '#c99b3b' } } },
  { id: 'books', x: -5.85, z: 4.62, o: { count: 2 } },
  { id: 'books', x: 1.45, z: 4.62, o: { count: 3 } },
  { id: 'books', x: -4.7, z: -1.0, o: { count: 2 } },
  { id: 'books', x: 0.35, z: -4.2, o: { layout: 'row', count: 6 }, r: 90 },
  { id: 'photo-frame', x: 6.6, z: 4.62 },
  { id: 'photo-frame', x: -6.75, z: -3.5, r: 90 },
  { id: 'photo-frame', x: -3.35, z: 4.62, r: 180 },
  { id: 'candles', x: -0.2, z: 4.8, r: 180 },
  { id: 'candles', x: 6.6, z: 2.3, r: 270 },
  { id: 'sculpture', x: 0.35, z: -3.65, o: { form: 'stacked' } },
  { id: 'sculpture', x: -5.6, z: 1.15, o: { form: 'bust' }, s: { w: 0.18, d: 0.18, h: 0.32 } },
  { id: 'vase', x: 6.45, z: 2.15, o: { shape: 'bud' }, s: { w: 0.1, d: 0.1, h: 0.22 } },
  { id: 'flowers', x: -1.75, z: 2.85, o: { kind: 'wild' }, s: { w: 0.22, d: 0.22, h: 0.35 } },
  { id: 'flowers', x: -5.0, z: 1.7, o: { kind: 'roses' }, s: { w: 0.25, d: 0.25, h: 0.4 } },
  { id: 'potted-plant', x: 3.75, z: 2.0, o: { kind: 'succulent' }, s: { w: 0.16, h: 0.16 } },
  { id: 'potted-plant', x: 6.4, z: -4.75, o: { kind: 'fern' }, s: { w: 0.24, h: 0.3 } },
  { id: 'potted-plant', x: -6.7, z: -2.0, o: { kind: 'pothos' }, s: { w: 0.2, h: 0.25 }, r: 90 },
  { id: 'hanging-plant', x: 6.4, z: -4.2 },
  { id: 'hanging-plant', x: -0.4, z: 3.0 },
  { id: 'painting', x: -6.9, z: 3.9, s: { w: 0.5, h: 0.7 }, f: { canvas: { pattern: 'geometric', colour: '#5e1f24', colour2: '#e6d8bf', scale: 0.35 } } },
  { id: 'painting', x: 1.1, z: 3.6, s: { w: 0.4, h: 0.5 }, f: { canvas: { pattern: 'polka', colour: '#33456b', colour2: '#c99b3b', scale: 0.15 } } },
  { id: 'painting', x: 4.1, z: 4.3, s: { w: 0.5, h: 0.4 }, f: { canvas: { pattern: 'chevron', colour: '#9aa88f', colour2: '#efeae0', scale: 0.2 } } },
  { id: 'poster', x: -1.9, z: 4.2, s: { w: 0.4, h: 0.55 }, o: { frame: 'thin' } },
  { id: 'wall-clock', x: -2.0, z: -4.9 },
  { id: 'place-setting', x: 1.6, z: -1.65, r: 180 }, { id: 'place-setting', x: 1.6, z: -3.15 },
  { id: 'rug', x: 1.6, z: -2.4, s: { w: 3.0, d: 2.2 }, r: 90, f: { rug: { colour: '#b5654a', colour2: '#e6d8bf', pattern: 'floral', scale: 0.6 } } },
  { id: 'bath-mat', x: -1.4, z: 2.6, r: 90, s: { w: 0.6, d: 0.4 } },
  { id: 'sideboard', x: -0.3, z: -4.3, r: 270, s: { w: 1.1, h: 0.7 }, o: { doors: 3 } },
  { id: 'vase', x: -0.3, z: -4.0, o: { shape: 'amphora' }, s: { w: 0.22, d: 0.22, h: 0.42 } },
  { id: 'candles', x: -0.3, z: -4.55, r: 270 }
]

export const THREE_BED: HouseSpec = {
  rooms: ROOMS,
  openings: OPENINGS,
  props: PROPS,
  cast: [{ name: 'Maya', x: -2.2, z: -2.5, r: 270, height: 1.68 }, { name: 'Sam', x: 3.4, z: -2.0, r: 120, height: 1.82 }],
  cameras: [
    { name: 'Camera A', x: -5.8, z: -1.6, r: 115, height: 1.45, lens: 'aizu-35', subject: 0 },
    { name: 'Camera B', x: 6.2, z: -0.6, r: 235, height: 1.6, lens: 'aizu-50', subject: 1 }
  ]
}

// A spruced-up 1-bedroom apartment (~45 props): open-plan lounge and kitchen at the front,
// bedroom and bathroom at the back. Smaller and quicker to find your way around.
//
//   z 3.5 ┌─────────────┬────────┐
//         │   Bedroom   │  Bath  │
//     0   ├─────────────┼────────┤
//         │   Lounge    │Kitchen │
//   −3.5  └─────────────┴────────┘
//       x −4           1.2       4
export const ONE_BED: HouseSpec = {
  rooms: [
    { name: 'Lounge', r: [-4, -3.5, 1.2, 0], floor: { material: 'wood', colour: '#b98a5a', colour2: '#9c6f43', pattern: 'herringbone', scale: 0.8 }, walls: { material: 'painted', colour: '#e9e2d4' } },
    { name: 'Kitchen', r: [1.2, -3.5, 4, 0], floor: { material: 'ceramic', colour: '#1f1f21', colour2: '#e0dcd2', pattern: 'tiles', scale: 0.4, roughness: 0.3 }, walls: { material: 'painted', colour: '#9aa88f' } },
    { name: 'Bedroom', r: [-4, 0, 1.2, 3.5], floor: { material: 'wood', colour: '#d2b48c', colour2: '#b89a72', pattern: 'planks', scale: 1.0 }, walls: { material: 'paper', colour: '#2f3b55', pattern: 'floral', colour2: '#c99b3b', scale: 0.45 } },
    { name: 'Bathroom', r: [1.2, 0, 4, 3.5], floor: { material: 'stone', colour: '#ecebe8', colour2: '#9fa3a8', pattern: 'marble', scale: 0.8 }, walls: { material: 'ceramic', colour: '#a9c2ad', colour2: '#e6e1d8', pattern: 'tiles', scale: 0.15, roughness: 0.2 } }
  ],
  openings: [
    ['door', 0.55, -3.5], // front door
    ['window', -2.4, -3.5, 2.0], ['window', 4, -2.0, 1.2], ['window', -3.2, 3.5, 1.0], ['window', 3.5, 3.5, 0.6, 1.4],
    ['opening', 1.2, -1.75, 2.2], ['door', -0.4, 0], ['door', 2.4, 0]
  ],
  props: [
    // ── Lounge ──────────────────────────────────────────────────────────────
    { id: 'rug', x: -2.4, z: -1.8, r: 90, s: { w: 2.4, d: 1.7 }, f: { rug: { colour: '#b5654a', colour2: '#e6d8bf', pattern: 'geometric', scale: 0.6 } } },
    { id: 'media-unit', x: -3.7, z: -1.8, r: 90, s: { w: 1.6 } },
    { id: 'tv', x: -3.75, z: -1.8, r: 90, o: { inches: '55' } },
    { id: 'sofa', x: -1.1, z: -1.8, r: 270, o: { seats: 3, pillows: 2 }, f: { upholstery: { material: 'velvet', colour: '#1f5a46' }, cushions: { material: 'velvet', colour: '#1f5a46' }, pillows: { material: 'fabric', colour: '#d8cdb8', pattern: 'stripes', colour2: '#b0802c', scale: 0.12 } } },
    { id: 'coffee-table', x: -2.3, z: -1.8, r: 90, o: { shape: 'round', base: 'pedestal' }, s: { w: 0.8, d: 0.8 }, f: { top: { material: 'wood', colour: '#5d4030', colour2: '#45301f' }, base: { material: 'wood', colour: '#5d4030', colour2: '#45301f' } } },
    { id: 'armchair', x: -2.9, z: -3.0, r: 20, f: { upholstery: { material: 'leather', colour: '#8a4a26' }, cushion: { material: 'leather', colour: '#8a4a26' } } },
    { id: 'side-table', x: -1.1, z: -3.1 },
    { id: 'table-lamp', x: -1.1, z: -3.1, light: true },
    { id: 'floor-lamp', x: -1.0, z: -0.4, o: { style: 'arc' }, r: 270 },
    { id: 'bookshelf', x: -3.0, z: -0.25, r: 180, s: { w: 1.2 }, o: { books: 'some' } },
    { id: 'floor-plant', x: -3.6, z: -3.1, o: { species: 'monstera' }, s: { h: 1.3 } },
    { id: 'floor-plant', x: 0.8, z: -0.4, o: { species: 'fiddle' } },
    { id: 'painting', x: -1.8, z: -0.05, e: 1.5, s: { w: 0.9, h: 0.7 }, f: { canvas: { pattern: 'marble', colour: '#e6d8bf', colour2: '#33456b', scale: 0.6 } } },
    { id: 'curtains', x: -2.4, z: -3.4, s: { w: 2.4 }, f: { fabric: { colour: '#d8cdb8' } } },
    { id: 'books', x: -2.4, z: -1.9 },
    { id: 'flowers', x: -2.2, z: -1.65, o: { kind: 'tulips' }, f: { blooms: { colour: '#d2a3a0' } } },
    { id: 'candles', x: -3.7, z: -2.5, r: 90 },
    { id: 'vase', x: -3.7, z: -1.1, o: { shape: 'amphora' } },
    { id: 'cushion', x: -2.9, z: -2.85, r: 20, s: { w: 0.4, h: 0.35 }, f: { cover: { colour: '#c99b3b' } } },
    { id: 'pouf', x: -1.8, z: -0.8 },
    // ── Kitchen ─────────────────────────────────────────────────────────────
    { id: 'sink-unit', x: 1.8, z: -3.2, s: { w: 1.0 } },
    { id: 'cooker', x: 2.6, z: -3.2 },
    { id: 'base-cabinets', x: 3.5, z: -3.2, s: { w: 1.0 } },
    { id: 'cooker-hood', x: 2.6, z: -3.45 },
    { id: 'wall-cabinets', x: 1.65, z: -3.45, s: { w: 0.9 } },
    { id: 'wall-cabinets', x: 3.5, z: -3.45, s: { w: 1.0 }, o: { glass: true } },
    { id: 'fridge', x: 3.65, z: -0.45, r: 270 },
    { id: 'dining-table', x: 2.5, z: -1.4, o: { shape: 'round', seats: 3, base: 'pedestal', chairStyle: 'spindle' }, s: { w: 0.9, d: 0.9 } },
    { id: 'pendant', x: 2.5, z: -1.4, o: { shade: 'dome' }, light: true },
    { id: 'fruit-bowl', x: 2.5, z: -1.4 },
    { id: 'kettle', x: 3.3, z: -3.3 }, { id: 'toaster', x: 3.75, z: -3.3 },
    { id: 'pots', x: 2.6, z: -3.25 },
    { id: 'potted-plant', x: 1.5, z: -3.3, o: { kind: 'fern' }, s: { w: 0.22, h: 0.28 } },
    { id: 'wall-clock', x: 3.95, z: -1.0 },
    // ── Bedroom ─────────────────────────────────────────────────────────────
    { id: 'rug', x: -1.5, z: 2.0, s: { w: 2.4, d: 2.2 }, f: { rug: { colour: '#d8cdb8', colour2: '#b9827f', pattern: 'check', scale: 0.5 } } },
    { id: 'bed', x: -1.5, z: 2.45, r: 180, o: { size: 'queen', headboard: 'upholstered' }, f: { headboard: { material: 'velvet', colour: '#b0802c' }, throw: { colour: '#5e1f24', pattern: 'weave' } } },
    { id: 'nightstand', x: -2.75, z: 3.2, r: 180 }, { id: 'nightstand', x: -0.25, z: 3.2, r: 180 },
    { id: 'table-lamp', x: -2.75, z: 3.2, light: true }, { id: 'table-lamp', x: -0.25, z: 3.2 },
    { id: 'books', x: -0.15, z: 3.1, o: { count: 3 } },
    { id: 'wardrobe', x: -3.7, z: 1.3, r: 90, s: { w: 1.6 }, o: { doors: 2 } },
    { id: 'bench', x: -1.5, z: 0.9 },
    { id: 'armchair', x: 0.6, z: 2.1, r: 250, o: { arms: 'rolled' }, f: { upholstery: { material: 'fabric', colour: '#d8cdb8' }, cushion: { material: 'fabric', colour: '#d8cdb8' } } },
    { id: 'floor-plant', x: 0.8, z: 3.1, o: { species: 'palm' }, s: { h: 1.3 } },
    { id: 'painting', x: -1.5, z: 3.45, e: 1.45, s: { w: 1.2, h: 0.6 }, f: { canvas: { pattern: 'geometric', colour: '#efeae0', colour2: '#b5654a', scale: 0.4 } } },
    { id: 'curtains', x: -3.2, z: 3.4, s: { w: 1.3 }, f: { fabric: { material: 'velvet', colour: '#5e1f24' } } },
    { id: 'cushion', x: -1.9, z: 2.75, r: 180, f: { cover: { colour: '#b0802c' } } },
    { id: 'cushion', x: -1.1, z: 2.75, r: 180, f: { cover: { material: 'fabric', colour: '#d8cdb8', pattern: 'check', colour2: '#5e1f24', scale: 0.15 } } },
    { id: 'floor-mirror', x: 0.95, z: 0.9, r: 270 },
    // ── Bathroom ────────────────────────────────────────────────────────────
    { id: 'bathtub', x: 2.45, z: 3.1, r: 180, o: { style: 'freestanding' } },
    { id: 'toilet', x: 3.65, z: 1.0, r: 270 },
    { id: 'vanity', x: 1.5, z: 1.7, r: 90 },
    { id: 'mirror-cabinet', x: 1.3, z: 1.7 },
    { id: 'towel-rail', x: 3.9, z: 2.2 },
    { id: 'bath-mat', x: 2.45, z: 2.3 },
    { id: 'potted-plant', x: 1.5, z: 1.4, o: { kind: 'succulent' }, s: { w: 0.18, h: 0.2 } },
    { id: 'candles', x: 3.4, z: 3.25 },
    { id: 'hanging-plant', x: 3.5, z: 3.0 }
  ],
  cast: [{ name: 'Lena', x: -2.0, z: -1.2, r: 250, height: 1.7 }],
  cameras: [
    { name: 'Camera A', x: 3.3, z: -0.6, r: 256, height: 1.5, lens: 'aizu-35', subject: 0 },
    { name: 'Camera B', x: 0.7, z: 0.4, r: 310, height: 1.55, lens: 'aizu-25', subject: 0 }
  ]
}

function findWall(walls: Wall[], p: Pt): { wall: Wall; along: number } | null {
  for (const w of walls) {
    const pr = projectOnWall(w, p)
    if (Math.abs(pr.offset) < 0.05 && pr.along > 0.2 && pr.along < wallLength(w) - 0.2) return { wall: w, along: pr.along }
  }
  return null
}

function prop(spec: P): PropItem | null {
  const def = getDef(spec.id)
  if (!def) return null
  const props = defaultPropProps(def)
  if (spec.o) {
    props.options = { ...props.options, ...spec.o }
    const size = def.sizeFor?.(props.options, { w: props.w, d: props.d, h: props.h })
    if (size) Object.assign(props, size)
    Object.keys(spec.o).forEach(k => {
      const s = def.sizeFor?.(props.options, { w: props.w, d: props.d, h: props.h }, k)
      if (s) Object.assign(props, s)
    })
  }
  if (spec.s) Object.assign(props, spec.s)
  if (spec.e !== undefined) props.elevation = spec.e
  if (spec.f) {
    Object.entries(spec.f).forEach(([slot, partial]) => {
      const base = def.slots.find(s => s.id === slot)?.default ?? { material: 'painted' as const }
      props.finishes[slot] = makeFinish({ ...base, ...partial, material: partial.material ?? base.material })
    })
  }
  return { id: newId('prop'), kind: 'prop', name: spec.name ?? def.name, x: spec.x, z: spec.z, rotationY: spec.r ?? 0, height: 0, props }
}

// The house as a scene document (walls, rooms, openings, items) — not yet settled or lit.
function houseDoc(spec: HouseSpec): { doc: object; built: Array<PropItem | null> } {
  const walls: Wall[] = []
  const rooms: RoomArea[] = []
  spec.rooms.forEach(({ name, r, floor, walls: wallFinish }) => {
    const [x0, z0, x1, z1] = r
    const corners: Pt[] = [{ x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 }]
    corners.forEach((p, i) => uncoveredParts(p, corners[(i + 1) % 4], walls).forEach(([a, b]) => walls.push(makeWall(a, b))))
    const room = makeRoom(name, corners)
    room.floorFinish = makeFinish(floor)
    rooms.push(room)
    if (wallFinish) {
      const fin = makeFinish(wallFinish)
      walls.forEach(w => {
        const inside = (q: Pt) => q.x >= x0 - 0.01 && q.x <= x1 + 0.01 && q.z >= z0 - 0.01 && q.z <= z1 + 0.01
        const onEdge = (q: Pt) => Math.abs(q.x - x0) < 0.01 || Math.abs(q.x - x1) < 0.01 || Math.abs(q.z - z0) < 0.01 || Math.abs(q.z - z1) < 0.01
        if (inside(w.a) && inside(w.b) && onEdge(w.a) && onEdge(w.b) && !w.finish) w.finish = fin
      })
    }
  })
  const openings: Opening[] = []
  spec.openings.forEach(([kind, x, z, width, sill]) => {
    const hit = findWall(walls, { x, z })
    if (!hit) return
    const d = openingDefaults(kind)
    openings.push({
      id: newId(kind === 'window' ? 'window' : 'door'), wallId: hit.wall.id, kind, offset: Math.round(hit.along * 1000) / 1000,
      width: width ?? d.width, height: kind === 'window' && sill ? 0.8 : d.height, sill: sill ?? d.sill,
      hinge: 'left', swing: 'in', openAngle: kind === 'door' ? 70 : 0, openTo: 90
    })
  })
  const built = spec.props.map(prop)
  const props = built.filter((p): p is PropItem => !!p)
  const cast: SubjectItem[] = spec.cast.map(c => ({ id: newId('subject'), kind: 'subject', name: c.name, x: c.x, z: c.z, rotationY: c.r, height: c.height }))
  const cams: CameraItem[] = spec.cameras.map(c => {
    const cam: CameraItem = { id: newId('camera'), kind: 'camera', name: c.name, x: c.x, z: c.z, rotationY: c.r, height: c.height, props: cameraPropsFor(cast[c.subject]?.id ?? null) }
    cam.props.lensId = c.lens
    return cam
  })
  const items: SceneItem[] = [...props, ...cast, ...cams]
  const doc = {
    walls, openings, rooms, items, marks: [], lineOfAction: null,
    world: { ...defaultWorld(), preset: 'evening', percent: 100, kelvin: 3000 }, activeCameraId: cams[0]?.id ?? null
  }
  return { doc, built }
}

// Load a house into the editor as one undoable step.
export function buildHouse(spec: HouseSpec): void {
  const { doc, built } = houseDoc(spec)
  loadScene(JSON.stringify(doc), () => {
    // Settle on walls and surfaces now the house exists, then light the practicals — all part of
    // the same undo step, so one Undo brings the previous scene back.
    settleProps(scene.items.filter(i => i.kind === 'prop').map(i => i.id), true)
    spec.props.forEach((p, i) => {
      const item = built[i]
      if (p.light && item) {
        const live = scene.items.find(x => x.id === item.id)
        if (live?.kind === 'prop') lightIt(live, false)
      }
    })
  })
}

export const buildDemoHouse = (): void => buildHouse(THREE_BED)
