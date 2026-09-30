import { lightColour, RGB, toHex } from './colour'
import { getFixture } from './fixtures'
import { getModifier } from './modifiers'
import { Fixture, Modifier } from './types'
import { Exposure, LightItem, SubjectItem } from '../scene/types'

const DEG = Math.PI / 180

// The shape that actually emits light once the modifier is on — drives the 3D mesh, the plan icon
// and shadow softness.
export type EmitterShape = 'cob' | 'reflector' | 'rect' | 'octa' | 'dish' | 'sphere' | 'lens' | 'tube' | 'bulb'

export interface Emitter {
  shape: EmitterShape
  w: number
  h: number
  depth: number
}

export interface ResolvedLight {
  fixture: Fixture
  modifier: Modifier
  omni: boolean
  candela: number
  beam: number
  hardEdge: boolean
  // Spot cone (full angles, deg): full intensity inside innerAngle, fading (glTF smooth-step
  // squared) to zero at coneAngle.
  coneAngle: number
  innerAngle: number
  emitter: Emitter
  sourceSize: number
  colour: RGB
  colourHex: string
}

export function isZoomable(modifier: Modifier): modifier is Modifier & { beam: [number, number] } {
  return Array.isArray(modifier.beam)
}

function transmission(modifier: Modifier, beam: number): number {
  if (!isZoomable(modifier) || !modifier.transmissionAt) return modifier.transmission
  // Narrowing a fresnel/projection concentrates the same light into a smaller cone.
  const power = modifier.kind === 'projection' ? 1.5 : 0.9
  return modifier.transmission * Math.pow(modifier.transmissionAt / beam, power)
}

function emitterFor(fixture: Fixture, modifier: Modifier): Emitter {
  const shape = fixture.shape
  if (shape.type === 'tube') return { shape: 'tube', w: shape.length, h: 0.03, depth: 0.03 }
  if (shape.type === 'bulb') return { shape: 'bulb', w: 0.06, h: 0.06, depth: 0.06 }
  if (shape.type === 'rect') {
    if (modifier.kind === 'bare') return { shape: 'rect', w: shape.w, h: shape.h, depth: 0.03 }
    const grow = modifier.kind === 'panel-softbox' ? 0.12 : 0
    const w = modifier.sizeFromFixture && !modifier.w ? shape.w + grow : Math.max(modifier.w, shape.w)
    const h = modifier.sizeFromFixture && !modifier.h ? shape.h + grow : Math.max(modifier.h, shape.h)
    return { shape: 'rect', w, h, depth: modifier.depth }
  }
  const { w, h, depth } = modifier
  switch (modifier.kind) {
    case 'bare': return { shape: 'cob', w: 0.05, h: 0.05, depth: 0 }
    case 'reflector': return { shape: 'reflector', w, h, depth }
    case 'softbox':
    case 'strip': return { shape: 'rect', w, h, depth }
    case 'octa': return { shape: 'octa', w, h, depth }
    case 'parabolic':
    case 'dish': return { shape: 'dish', w, h, depth }
    case 'lantern': return { shape: 'sphere', w, h, depth }
    default: return { shape: 'lens', w, h, depth }
  }
}

// Cone shape per edge quality. Soft sources are solved so intensity is half at beam/2 — the
// published beam angle — with falloff f = t², t = (cosθ − cosOuter) / (1 − cosOuter).
function cone(beam: number, edge: 'hard' | 'medium' | 'soft'): { coneAngle: number; innerAngle: number } {
  if (edge === 'hard') return { coneAngle: beam, innerAngle: beam * 0.85 }
  if (edge === 'medium') return { coneAngle: Math.min(beam * 1.25, 170), innerAngle: beam * 0.6 }
  const half = Math.SQRT1_2
  const cosOuter = (Math.cos((beam / 2) * DEG) - half) / (1 - half)
  const outer = cosOuter > Math.cos(85 * DEG) ? (2 * Math.acos(cosOuter)) / DEG : 170
  return { coneAngle: outer, innerAngle: 0 }
}

// glTF spot falloff, matching what the Live View renders.
export function coneFalloff(cosTheta: number, light: Pick<ResolvedLight, 'coneAngle' | 'innerAngle'>): number {
  const cosOuter = Math.cos((light.coneAngle / 2) * DEG)
  const cosInner = Math.cos((light.innerAngle / 2) * DEG)
  const t = Math.min(Math.max((cosTheta - cosOuter) / Math.max(cosInner - cosOuter, 0.001), 0), 1)
  return t * t
}

export function resolveLight(item: LightItem): ResolvedLight {
  const p = item.props
  const fixture = getFixture(p.fixtureId)
  const modifier = getModifier(p.modifierId)
  const zoomable = isZoomable(modifier)
  const beam = zoomable
    ? Math.min(Math.max(p.zoom, modifier.beam[0]), modifier.beam[1])
    : modifier.kind === 'bare' && fixture.mount === 'none' ? fixture.beam : (modifier.beam as number) || fixture.beam
  const omni = Boolean(modifier.omni) || fixture.shape.type === 'bulb'
  const baseCandela = fixture.lumens ? fixture.lumens / (4 * Math.PI) : fixture.luxAt1m
  const candela = baseCandela * transmission(modifier, beam) * (p.dimmer / 100)
  const hardEdge = Boolean(modifier.hardEdge)

  const { coneAngle, innerAngle } = cone(beam, hardEdge ? 'hard' : modifier.kind === 'fresnel' ? 'medium' : 'soft')

  const emitter = emitterFor(fixture, modifier)
  const sourceSize = emitter.shape === 'cob' || emitter.shape === 'lens' || emitter.shape === 'bulb'
    ? 0.03
    : emitter.shape === 'reflector' ? 0.08 : Math.max(emitter.w, emitter.h)

  const effectiveCct = fixture.colour === 'daylight' ? 5600 : Math.min(Math.max(p.cct, fixture.cct[0]), fixture.cct[1])
  const mode = fixture.colour === 'rgb' ? p.mode : 'cct'
  const colour = lightColour(mode, effectiveCct, fixture.colour === 'rgb' ? p.gm : 0, p.hue, p.sat)

  return {
    fixture, modifier, omni, candela, beam, hardEdge, coneAngle, innerAngle,
    emitter, sourceSize, colour, colourHex: toHex(colour)
  }
}

// Unit vector for a plan heading (0 = +z, clockwise from above) tilted down by `tilt` degrees.
export function headingDirection(rotationY: number, tilt = 0): [number, number, number] {
  const h = rotationY * DEG
  const t = tilt * DEG
  return [Math.sin(h) * Math.cos(t), -Math.sin(t), Math.cos(h) * Math.cos(t)]
}

// Incident illuminance (lux) from one light at a point, ignoring occlusion.
export function illuminanceAt(item: LightItem, point: [number, number, number]): number {
  const light = resolveLight(item)
  const d = [point[0] - item.x, point[1] - item.height, point[2] - item.z]
  const dist2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2]
  if (dist2 < 1e-4) return 0
  if (light.omni) return light.candela / dist2
  const dist = Math.sqrt(dist2)
  const dir = headingDirection(item.rotationY, item.props.tilt)
  const cos = (dir[0] * d[0] + dir[1] * d[1] + dir[2] * d[2]) / dist
  return (light.candela * coneFalloff(cos, light)) / dist2
}

// The point a meter reads: the subject's face.
export function subjectMeterPoint(subject: SubjectItem): [number, number, number] {
  return [subject.x, subject.height - 0.12, subject.z]
}

const INCIDENT_C = 250

// T-stop that exposes `lux` as middle grey (incident meter equation N² / t = E·S / C).
export function tStopFor(lux: number, exposure: Exposure): number {
  return Math.sqrt((lux * exposure.iso * exposure.shutter) / INCIDENT_C)
}

// Illuminance that the camera settings expose as middle grey.
export function keyLuxFor(exposure: Exposure): number {
  return (exposure.tStop * exposure.tStop * INCIDENT_C) / (exposure.iso * exposure.shutter)
}

export const T_STOPS = [1, 1.1, 1.2, 1.4, 1.6, 1.8, 2, 2.2, 2.5, 2.8, 3.2, 3.5, 4, 4.5, 5, 5.6, 6.3, 7.1, 8, 9, 10, 11, 13, 14, 16, 18, 20, 22]
export const ISOS = [100, 200, 400, 640, 800, 1280, 1600, 2500, 3200, 5000, 6400, 12800]

export function nearestStop(n: number): number {
  return T_STOPS.reduce((best, s) => (Math.abs(Math.log2(s / n)) < Math.abs(Math.log2(best / n)) ? s : best), T_STOPS[0])
}

// Stops of over (+) / under (−) exposure for `lux` at the given camera settings.
export function stopsOver(lux: number, exposure: Exposure): number {
  return lux > 0 ? Math.log2(lux / keyLuxFor(exposure)) : -Infinity
}
