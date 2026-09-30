import { Fixture, Modifier } from './types'

// Nanlite modifiers. `transmission` is an approximate on-axis output multiplier relative to the
// fixture's luxAt1m spec (which, for COBs, is measured with the standard 45° reflector).
// Real figures vary by fixture; these are previs-grade estimates.

export const BARE: Modifier = {
  id: 'bare', name: 'Bare (no modifier)', kind: 'bare', w: 0, h: 0, depth: 0, beam: 0, transmission: 1
}

export const MODIFIERS: Modifier[] = [
  // ── Bowens & FM: reflectors / bare COB ────────────────────────────────────
  { id: 'bare-cob-bowens', name: 'Bare COB', kind: 'bare', mount: 'bowens', w: 0, h: 0, depth: 0, beam: 120, transmission: 0.2 },
  { id: 'bare-cob-fm', name: 'Bare COB', kind: 'bare', mount: 'fm', w: 0, h: 0, depth: 0, beam: 120, transmission: 0.2 },
  { id: 'rf-bm-45', name: 'Standard reflector 45°', code: 'RF-BM-45', kind: 'reflector', mount: 'bowens', w: 0.21, h: 0.21, depth: 0.12, beam: 45, transmission: 1 },
  { id: 'rf-bm-55', name: 'Standard reflector 55°', code: 'RF-BM-55', kind: 'reflector', mount: 'bowens', w: 0.18, h: 0.18, depth: 0.1, beam: 55, transmission: 0.75 },
  { id: 'rf-fmm-45', name: 'FM reflector 45°', code: 'RF-FMM-45', kind: 'reflector', mount: 'fm', w: 0.14, h: 0.14, depth: 0.08, beam: 45, transmission: 1 },

  // ── Bowens softboxes ──────────────────────────────────────────────────────
  { id: 'sb-rt-60x90', name: 'Rectangular softbox 60×90', code: 'SB-RT-60X90', kind: 'softbox', mount: 'bowens', w: 0.9, h: 0.6, depth: 0.45, beam: 100, transmission: 0.22 },
  { id: 'sb-rt-90x120', name: 'Rectangular softbox 90×120', code: 'SB-RT-90X120', kind: 'softbox', mount: 'bowens', w: 1.2, h: 0.9, depth: 0.55, beam: 110, transmission: 0.17, approx: true },
  { id: 'sb-st-30x120', name: 'Stripbox 30×120', code: 'SB-ST-30X120', kind: 'strip', mount: 'bowens', w: 0.3, h: 1.2, depth: 0.35, beam: 100, transmission: 0.14, approx: true },
  { id: 'sb-oc-90', name: 'Octa softbox 90', code: 'SB-OC-90', kind: 'octa', mount: 'bowens', w: 0.9, h: 0.9, depth: 0.5, beam: 100, transmission: 0.2, approx: true },
  { id: 'sb-oc-120', name: 'Octa softbox 120', code: 'SB-OC-120', kind: 'octa', mount: 'bowens', w: 1.2, h: 1.2, depth: 0.6, beam: 105, transmission: 0.16, approx: true },
  { id: 'para-60', name: 'Rapid Parabolic 60', code: 'SB-PR-60', kind: 'parabolic', mount: 'bowens', w: 0.6, h: 0.6, depth: 0.45, beam: 70, transmission: 0.38 },
  { id: 'para-90', name: 'Rapid Parabolic 90', code: 'SB-PR-90', kind: 'parabolic', mount: 'bowens', w: 0.9, h: 0.9, depth: 0.6, beam: 75, transmission: 0.32 },
  { id: 'para-120', name: 'Rapid Parabolic 120', code: 'SB-PR-120', kind: 'parabolic', mount: 'bowens', w: 1.2, h: 1.2, depth: 0.75, beam: 78, transmission: 0.28 },
  { id: 'para-150', name: 'Rapid Parabolic 150', code: 'SB-PR-150', kind: 'parabolic', mount: 'bowens', w: 1.5, h: 1.5, depth: 0.9, beam: 80, transmission: 0.24 },
  { id: 'lt-80', name: 'Lantern 80 Easy-Up', code: 'LT-80', kind: 'lantern', mount: 'bowens', w: 0.8, h: 0.8, depth: 0.8, beam: 270, transmission: 0.1, omni: true },
  { id: 'lt-120', name: 'Lantern 120 Easy-Up', code: 'LT-120', kind: 'lantern', mount: 'bowens', w: 1.2, h: 1.2, depth: 1.2, beam: 270, transmission: 0.08, omni: true },
  { id: 'bd-bm-55', name: 'Beauty dish 55', code: 'BD-BM-55', kind: 'dish', mount: 'bowens', w: 0.55, h: 0.55, depth: 0.2, beam: 60, transmission: 0.5, approx: true },

  // ── Bowens fresnel & projection ───────────────────────────────────────────
  { id: 'fl-20g', name: 'Fresnel FL-20G (10–45°)', code: 'FL-20G', kind: 'fresnel', mount: 'bowens', w: 0.2, h: 0.2, depth: 0.2, beam: [10, 45], transmission: 0.8, transmissionAt: 45 },
  { id: 'pj-bm-19', name: 'Projection PJ-BM, 19° lens', code: 'PJ-BM-19', kind: 'projection', mount: 'bowens', w: 0.12, h: 0.12, depth: 0.4, beam: 19, transmission: 2.0, hardEdge: true },
  { id: 'pj-bm-36', name: 'Projection PJ-BM, 36° lens', code: 'PJ-BM-36', kind: 'projection', mount: 'bowens', w: 0.12, h: 0.12, depth: 0.4, beam: 36, transmission: 0.77, hardEdge: true },
  { id: 'pj-bm-25-45', name: 'Projection PJ-BM zoom 25–45°', code: 'PJ-BM-25-45', kind: 'projection', mount: 'bowens', w: 0.12, h: 0.12, depth: 0.45, beam: [25, 45], transmission: 1.3, transmissionAt: 25, hardEdge: true },

  // ── FM mount softboxes ────────────────────────────────────────────────────
  { id: 'sb-fmm-o-40', name: 'Octa softbox 40 (FM)', code: 'SB-FMM-O-40', kind: 'octa', mount: 'fm', w: 0.4, h: 0.4, depth: 0.3, beam: 95, transmission: 0.3 },
  { id: 'sb-fmm-o-60', name: 'Octa softbox 60 (FM)', code: 'SB-FMM-O-60', kind: 'octa', mount: 'fm', w: 0.6, h: 0.6, depth: 0.4, beam: 100, transmission: 0.25 },
  { id: 'lt-fmm-60', name: 'Lantern 60 (FM)', code: 'LT-FMM-60', kind: 'lantern', mount: 'fm', w: 0.6, h: 0.6, depth: 0.6, beam: 270, transmission: 0.12, omni: true },

  // ── FM fresnel & projection ───────────────────────────────────────────────
  { id: 'fl-11', name: 'Fresnel FL-11 (10–45°)', code: 'FL-11', kind: 'fresnel', mount: 'fm', w: 0.15, h: 0.15, depth: 0.15, beam: [10, 45], transmission: 0.8, transmissionAt: 45 },
  { id: 'pj-fmm-10', name: 'Projection PJ-FMM, 10° lens', code: 'PJ-FMM-10', kind: 'projection', mount: 'fm', w: 0.1, h: 0.1, depth: 0.35, beam: 10, transmission: 4.5, hardEdge: true, approx: true },
  { id: 'pj-fmm-19', name: 'Projection PJ-FMM, 19° lens', code: 'PJ-FMM-19', kind: 'projection', mount: 'fm', w: 0.1, h: 0.1, depth: 0.3, beam: 19, transmission: 2.0, hardEdge: true },
  { id: 'pj-fmm-36', name: 'Projection PJ-FMM, 36° lens', code: 'PJ-FMM-36', kind: 'projection', mount: 'fm', w: 0.1, h: 0.1, depth: 0.3, beam: 36, transmission: 0.77, hardEdge: true },
  { id: 'pj-fmm-50', name: 'Projection PJ-FMM, 50° lens', code: 'PJ-FMM-50', kind: 'projection', mount: 'fm', w: 0.1, h: 0.1, depth: 0.3, beam: 50, transmission: 0.47, hardEdge: true, approx: true },
  { id: 'pj-fmm-18-36', name: 'Projection PJ-FMM zoom 18–36°', code: 'PJ-FMM-18-36', kind: 'projection', mount: 'fm', w: 0.1, h: 0.1, depth: 0.4, beam: [18, 36], transmission: 1.8, transmissionAt: 18, hardEdge: true },

  // ── Panel accessories ─────────────────────────────────────────────────────
  { id: 'sb-mp150', name: 'MixPanel 150 softbox', code: 'SB-MP150', kind: 'panel-softbox', family: 'MixPanel', w: 0.6, h: 0.5, depth: 0.3, beam: 100, transmission: 0.55, sizeFromFixture: true },
  { id: 'pavoslim-softbox', name: 'PavoSlim softbox', kind: 'panel-softbox', family: 'PavoSlim', w: 0, h: 0, depth: 0.25, beam: 100, transmission: 0.6, sizeFromFixture: true, approx: true },
  { id: 'pavoslim-grid', name: 'PavoSlim eggcrate grid', kind: 'grid', family: 'PavoSlim', w: 0, h: 0, depth: 0.08, beam: 50, transmission: 0.85, sizeFromFixture: true, approx: true },
  { id: 'alien-grid', name: 'Alien eggcrate grid', kind: 'grid', family: 'Alien', w: 0, h: 0, depth: 0.08, beam: 50, transmission: 0.85, sizeFromFixture: true, approx: true }
]

const byId = new Map(MODIFIERS.map(modifier => [modifier.id, modifier]))

export function getModifier(id: string | null): Modifier {
  return (id && byId.get(id)) || BARE
}

// Modifiers that physically fit a fixture. The first entry is the sensible default.
export function modifiersFor(fixture: Fixture): Modifier[] {
  if (fixture.mount !== 'none') {
    const fits = MODIFIERS.filter(m => m.mount === fixture.mount)
    const reflector = fits.find(m => m.kind === 'reflector')
    return reflector ? [reflector, ...fits.filter(m => m !== reflector)] : fits
  }
  return [BARE, ...MODIFIERS.filter(m => m.family === fixture.family)]
}

export function defaultModifier(fixture: Fixture): Modifier {
  return modifiersFor(fixture)[0]
}
