import { ColourType, Fixture, FixtureShape, Mount } from './types'

// Nanlite / Nanlux fixture catalog. Output figures are manufacturer specs at 5600K, 1 m
// (COBs with their included reflector) — see ./README.md for sources. Entries marked
// `approx` are estimated from sibling models and flagged in the UI.

const BI: [number, number] = [2700, 6500]
const DAY: [number, number] = [5600, 5600]

interface SpotSpec {
  model: string
  colour: ColourType
  cct: [number, number]
  watts: number
  lux: number
  mount: Mount
  approx?: boolean
  note?: string
}

function cob(family: string, spec: SpotSpec, brand: Fixture['brand'] = 'Nanlite'): Fixture {
  const size = spec.watts >= 1000 ? 0.45 : spec.watts >= 500 ? 0.38 : spec.watts >= 200 ? 0.3 : 0.2
  return {
    id: spec.model.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brand,
    family,
    model: spec.model,
    category: 'spot',
    colour: spec.colour,
    cct: spec.cct,
    watts: spec.watts,
    luxAt1m: spec.lux,
    beam: 45,
    shape: { type: 'cob', size },
    mount: spec.mount,
    approx: spec.approx,
    note: spec.note
  }
}

interface SoftSpec {
  model: string
  family: string
  category: 'panel' | 'tube' | 'practical'
  colour: ColourType
  cct: [number, number]
  watts: number
  lux: number
  beam: number
  shape: FixtureShape
  lumens?: number
  approx?: boolean
  note?: string
}

function soft(spec: SoftSpec): Fixture {
  return {
    id: spec.model.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    brand: 'Nanlite',
    family: spec.family,
    model: spec.model,
    category: spec.category,
    colour: spec.colour,
    cct: spec.cct,
    watts: spec.watts,
    luxAt1m: spec.lux,
    lumens: spec.lumens,
    beam: spec.beam,
    shape: spec.shape,
    mount: 'none',
    approx: spec.approx,
    note: spec.note
  }
}

const panel = (model: string, family: string, colour: ColourType, cct: [number, number], watts: number, lux: number, w: number, h: number, approx?: boolean, note?: string) =>
  soft({ model, family, category: 'panel', colour, cct, watts, lux, beam: 110, shape: { type: 'rect', w, h }, approx, note })

const tube = (model: string, colour: ColourType, cct: [number, number], watts: number, lux: number, length: number, approx?: boolean) =>
  soft({ model, family: 'PavoTube', category: 'tube', colour, cct, watts, lux, beam: 160, shape: { type: 'tube', length }, approx })

export const FIXTURES: Fixture[] = [
  // ── Forza (COB monolights) ────────────────────────────────────────────────
  cob('Forza', { model: 'Forza 60 II', colour: 'daylight', cct: DAY, watts: 60, lux: 17620, mount: 'fm' }),
  cob('Forza', { model: 'Forza 60B II', colour: 'bicolor', cct: BI, watts: 60, lux: 14350, mount: 'fm' }),
  cob('Forza', { model: 'Forza 60C', colour: 'rgb', cct: [1800, 20000], watts: 60, lux: 12000, mount: 'fm', approx: true }),
  cob('Forza', { model: 'Forza 150B', colour: 'bicolor', cct: BI, watts: 170, lux: 26300, mount: 'fm' }),
  cob('Forza', { model: 'Forza 300 II', colour: 'daylight', cct: DAY, watts: 330, lux: 69400, mount: 'bowens' }),
  cob('Forza', { model: 'Forza 300B II', colour: 'bicolor', cct: BI, watts: 350, lux: 43480, mount: 'bowens' }),
  cob('Forza', { model: 'Forza 500 II', colour: 'daylight', cct: DAY, watts: 500, lux: 85000, mount: 'bowens', approx: true }),
  cob('Forza', { model: 'Forza 500B II', colour: 'bicolor', cct: BI, watts: 500, lux: 67320, mount: 'bowens' }),
  cob('Forza', { model: 'Forza 720B', colour: 'bicolor', cct: BI, watts: 800, lux: 84460, mount: 'bowens' }),

  // ── FS (studio spotlights) ────────────────────────────────────────────────
  cob('FS', { model: 'FS-60B', colour: 'bicolor', cct: BI, watts: 60, lux: 13360, mount: 'fm' }),
  cob('FS', { model: 'FS-150B', colour: 'bicolor', cct: BI, watts: 150, lux: 26300, mount: 'bowens' }),
  cob('FS', { model: 'FS-200B', colour: 'bicolor', cct: BI, watts: 200, lux: 32000, mount: 'bowens', approx: true }),
  cob('FS', { model: 'FS-300B', colour: 'bicolor', cct: BI, watts: 350, lux: 38720, mount: 'bowens' }),
  cob('FS', { model: 'FS-300C', colour: 'rgb', cct: [2700, 7500], watts: 300, lux: 30000, mount: 'bowens', approx: true }),

  // ── FC (compact spotlights) ───────────────────────────────────────────────
  cob('FC', { model: 'FC-60B', colour: 'bicolor', cct: BI, watts: 78, lux: 12510, mount: 'fm' }),
  cob('FC', { model: 'FC-120B', colour: 'bicolor', cct: BI, watts: 120, lux: 17450, mount: 'fm' }),
  cob('FC', { model: 'FC-120C', colour: 'rgb', cct: [2700, 7500], watts: 120, lux: 15000, mount: 'fm', approx: true }),
  cob('FC', { model: 'FC-300B', colour: 'bicolor', cct: BI, watts: 350, lux: 37340, mount: 'bowens' }),
  cob('FC', { model: 'FC-500B', colour: 'bicolor', cct: BI, watts: 520, lux: 62000, mount: 'bowens', approx: true }),
  cob('FC', { model: 'FC-500C', colour: 'rgb', cct: [2700, 7500], watts: 500, lux: 57050, mount: 'bowens' }),
  cob('FC', { model: 'FC-720B', colour: 'bicolor', cct: BI, watts: 750, lux: 130000, mount: 'bowens', approx: true }),
  cob('FC', { model: 'FC-720C', colour: 'rgb', cct: [2400, 12000], watts: 750, lux: 119000, mount: 'bowens' }),
  cob('FC', { model: 'FC-1200B', colour: 'bicolor', cct: BI, watts: 1200, lux: 170000, mount: 'bowens', approx: true }),
  cob('FC', { model: 'FC-1200C', colour: 'rgb', cct: [2400, 12000], watts: 1200, lux: 127980, mount: 'bowens', note: 'Spec: 14,220 lux @ 3 m with 45° reflector' }),

  // ── Nanlux Evoke (high output) ────────────────────────────────────────────
  cob('Evoke', { model: 'Evoke 900C', colour: 'rgb', cct: [1800, 20000], watts: 940, lux: 136700, mount: 'bowens', approx: true, note: 'Bare head 39,069 lux @ 1 m; reflector figure estimated. NL mount (Bowens via adapter).' }, 'Nanlux'),
  cob('Evoke', { model: 'Evoke 1200B', colour: 'bicolor', cct: BI, watts: 1200, lux: 167130, mount: 'bowens', note: 'NL mount (Bowens via adapter)' }, 'Nanlux'),
  cob('Evoke', { model: 'Evoke 2400B', colour: 'bicolor', cct: BI, watts: 2400, lux: 377190, mount: 'bowens', note: 'NL mount (Bowens via adapter)' }, 'Nanlux'),

  // ── Panels ────────────────────────────────────────────────────────────────
  panel('PavoSlim 60B', 'PavoSlim', 'bicolor', BI, 60, 7000, 0.3, 0.3, true),
  panel('PavoSlim 60C', 'PavoSlim', 'rgb', BI, 60, 7074, 0.3, 0.3),
  panel('PavoSlim 120B', 'PavoSlim', 'bicolor', BI, 120, 12800, 0.6, 0.3, true),
  panel('PavoSlim 120C', 'PavoSlim', 'rgb', BI, 120, 12830, 0.6, 0.3),
  panel('PavoSlim 240B', 'PavoSlim', 'bicolor', BI, 240, 25000, 0.6, 0.6, true),
  panel('PavoSlim 240C', 'PavoSlim', 'rgb', BI, 240, 24970, 0.6, 0.6),
  panel('PavoSlim 360C', 'PavoSlim', 'rgb', BI, 370, 27060, 1.2, 0.6),
  panel('Alien 150C', 'Alien', 'rgb', [2700, 12000], 175, 13050, 0.246, 0.18, false, 'IP55 head'),
  panel('Alien 300C', 'Alien', 'rgb', [2700, 12000], 350, 28630, 0.36, 0.248, false, 'IP55 head'),
  panel('Compac 24B', 'Compac', 'bicolor', [3200, 5600], 24, 700, 0.2, 0.15, true),
  panel('Compac 40B', 'Compac', 'bicolor', [3200, 5600], 40, 1200, 0.25, 0.18, true),
  panel('Compac 68B', 'Compac', 'bicolor', [3200, 5600], 68, 2000, 0.3, 0.2, true),
  panel('Compac 100B', 'Compac', 'bicolor', [3200, 5600], 100, 2862, 0.33, 0.23, false),
  panel('Compac 200B', 'Compac', 'bicolor', [3200, 5600], 200, 4751, 0.44, 0.33, false),
  panel('MixPanel 60', 'MixPanel', 'rgb', [2700, 7500], 60, 4500, 0.3, 0.23, true),
  panel('MixPanel 150', 'MixPanel', 'rgb', [2700, 7500], 150, 11320, 0.48, 0.4),
  panel('LumiPad 25', 'LumiPad', 'bicolor', [3200, 5600], 25, 930, 0.26, 0.19),
  panel('MixPad II 27C', 'MixPad', 'rgb', BI, 27, 2898, 0.3, 0.2, false, 'Hard mode; soft mode 500 lux'),

  // ── PavoTube ──────────────────────────────────────────────────────────────
  tube('PavoTube II 6C', 'rgb', [2700, 7500], 7, 169, 0.25),
  tube('PavoTube II 15C', 'rgb', [2700, 7500], 18, 423, 0.6),
  tube('PavoTube II 30C', 'rgb', [2700, 7500], 36, 647, 1.2),
  tube('PavoTube II 15X', 'rgb', [2700, 12000], 18, 377, 0.6),
  tube('PavoTube II 30X', 'rgb', [2700, 12000], 36, 746, 1.2),
  tube('PavoTube II 60X', 'rgb', [2700, 12000], 72, 991, 2.4),
  tube('PavoTube II 6XR', 'rgb', [2700, 12000], 7, 169, 0.25, true),
  tube('PavoTube II 15XR', 'rgb', [2700, 12000], 18, 377, 0.6, true),
  tube('PavoTube II 30XR', 'rgb', [2700, 12000], 36, 746, 1.2, true),
  tube('PavoTube II 60XR', 'rgb', [2700, 12000], 72, 991, 2.4, true),
  tube('PavoTube T8-7X', 'rgb', [2700, 7500], 8, 117, 0.9),

  // ── Practicals & pocket ───────────────────────────────────────────────────
  soft({ model: 'PavoBulb 10C', family: 'PavoBulb', category: 'practical', colour: 'rgb', cct: [2700, 7500], watts: 10, lux: 46, lumens: 580, beam: 205, shape: { type: 'bulb' }, note: 'E27 bulb, 580 lm' }),
  soft({ model: 'LitoLite 5C', family: 'LitoLite', category: 'practical', colour: 'rgb', cct: [2700, 7500], watts: 5, lux: 581, beam: 60, shape: { type: 'rect', w: 0.08, h: 0.08 } }),
  soft({ model: 'pico', family: 'Creator', category: 'practical', colour: 'rgb', cct: [2700, 7500], watts: 3, lux: 150, beam: 90, shape: { type: 'rect', w: 0.06, h: 0.06 }, approx: true }),
  soft({ model: 'miro', family: 'Creator', category: 'practical', colour: 'rgb', cct: [2700, 7500], watts: 8, lux: 300, beam: 100, shape: { type: 'rect', w: 0.1, h: 0.1 }, approx: true }),
  soft({ model: 'wand', family: 'Creator', category: 'practical', colour: 'rgb', cct: [2700, 7500], watts: 6, lux: 250, beam: 160, shape: { type: 'tube', length: 0.3 }, approx: true })
]

const byId = new Map(FIXTURES.map(fixture => [fixture.id, fixture]))

export function getFixture(id: string): Fixture {
  return byId.get(id) ?? FIXTURES[0]
}
