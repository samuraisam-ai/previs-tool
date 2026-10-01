import { PropItem, PropProps } from '../scene/types'
import { getDef } from './catalog'
import { makeFinish } from './finish'
import { OptionValue, PropDef, PropParams } from './types'

// Default data for a new prop of a catalogue type.
export function defaultPropProps(def: PropDef): PropProps {
  const options: { [id: string]: OptionValue } = {}
  def.options?.forEach(o => { options[o.id] = o.default })
  const finishes: PropProps['finishes'] = {}
  def.slots.forEach(s => { finishes[s.id] = makeFinish(s.default) })
  const size = def.sizeFor?.(options, def.size) ?? def.size
  return { catalogId: def.id, ...size, elevation: def.elevation ?? 0, options, finishes }
}

export function paramsOf(props: PropProps): PropParams {
  const def = getDef(props.catalogId)
  // Options added to a def later still get their defaults.
  const o: { [id: string]: OptionValue } = {}
  def?.options?.forEach(opt => { o[opt.id] = props.options[opt.id] ?? opt.default })
  return { w: props.w, d: props.d, h: props.h, o }
}

// The finish for a slot, falling back to the def's default (slots added later, older scenes).
export function finishOf(item: PropItem, slot: string) {
  const def = getDef(item.props.catalogId)
  const s = def?.slots.find(x => x.id === slot)
  return item.props.finishes[slot] ?? makeFinish(s?.default ?? { material: 'painted' })
}
