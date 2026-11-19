// How an exercise's weight is counted, and the one plain sentence the workout card says about it.
//
// The weight box of a set is always the TOTAL load (history, progression and records keep meaning
// what they always did). S.loadSetup[exerciseId] = { kind, base, u, _ts } says how that total is made
// up: 'bar' (a bar and plates on each side), 'sled' (a plate-loaded machine: its own weight and
// plates on each side), 'stack' (a machine stack or cable), 'dumbbell', 'bodyweight' (your body
// plus an added load) or 'total' (nothing to explain). `base` is the sled's own weight (a bar's weight
// lives in Settings) in the unit `u` (a weight in kg means nothing on a lb profile, so it is only read
// in its own unit). It stays on the entry when another kind is picked, so the sled is weighed once, and
// it is null while unknown. A stamped map (lib/sync-merge.js STAMPED_MAPS): every entry carries its
// own `_ts`, so the phone and the laptop each keep the choice made last.
//
// An exercise with no entry here keeps the loading it was given before (S.loadKind: none, single or
// pairs, which Cards and Focus still read), else it is counted by its catalogue equipment
// (defaultLoadKind). The plates
// come from the same inventory the rest of the app uses (lib/plates.js), so a weight that your
// plates cannot make says so in words instead of showing a wrong stack.

import { exerciseOf as exOf } from './exercises.js'
import { usesBar, barWeightFor, barTypeWeight } from './bar.js'
import { isBw } from './history.js'
import { inventoryFor, rowLoad, loadKindOf } from './plates.js'
import { fmtPlate } from './format.js'
import { t } from './i18n-core.js'

export const LOAD_KINDS = ['bar', 'sled', 'stack', 'dumbbell', 'bodyweight', 'total']

// Plate-loaded machines in the catalogue are filed as "leverage machine": told apart by their name.
const SLED_NAME = /leg press|hack squat|belt squat|pendulum squat|plate loaded/i

const unitOf = S => (S?.unit === 'lb' ? 'lb' : 'kg')
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const r2 = v => Math.round(v * 100) / 100

/** How the catalogue's equipment counts an exercise (no choice made anywhere): one of LOAD_KINDS. */
function equipmentLoadKind(cfg) {
  const ex = exOf(cfg?.id)
  const eq = ex?.eq
  if (eq === 'band' || eq === 'resistance band') return 'total'
  if (usesBar(ex)) return 'bar'
  if (eq === 'dumbbell' || eq === 'kettlebell') return 'dumbbell'
  if (isBw(cfg)) return 'bodyweight'
  if (eq === 'sled machine' || (eq === 'leverage machine' && SLED_NAME.test(ex?.n || ''))) return 'sled'
  if (eq === 'cable' || eq === 'leverage machine') return 'stack'
  if (eq === 'weighted') return 'bodyweight'
  return 'total'
}

/**
 * How an exercise is counted when it has no S.loadSetup entry: the loading it was given before
 * loadSetup existed (S.loadKind, which Cards and Focus still read) when there is one, else the
 * equipment's. 'none' is the total (a dumbbell or a stack keeps its own wording); 'single' (one
 * stack of plates) is a sled, or bodyweight for a body-weight exercise; 'pairs' is the bar on bar
 * equipment and a sled elsewhere. `S` is optional: without it only the equipment counts.
 */
export function defaultLoadKind(cfg, S) {
  const eq = equipmentLoadKind(cfg)
  const own = loadKindOf(S?.loadKind?.[cfg?.id])
  if (own === 'none') return eq === 'dumbbell' || eq === 'stack' ? eq : 'total'
  if (own === 'single') return eq === 'bodyweight' ? 'bodyweight' : 'sled'
  if (own === 'pairs') return eq === 'bar' ? 'bar' : 'sled'
  return eq
}

/**
 * The counting in force for an exercise: { kind, base, custom }. `base` is the bar (your own, else
 * the built-in) or the sled's weight, null when it is not known yet (a sled nobody has weighed) or
 * for the kinds that have none. `custom` is true when the choice was made, not derived.
 */
export function loadSetupFor(S, cfg) {
  const id = cfg?.id
  const own = S?.loadSetup?.[id]
  const custom = LOAD_KINDS.includes(own?.kind)
  const kind = custom ? own.kind : defaultLoadKind(cfg, S)
  let base = null
  // A bar's weight is never kept here: it comes from Settings (bar weights and bar defaults).
  if (kind === 'bar') base = barWeightFor(S, id) ?? barTypeWeight(S, 'barbell')
  // The sled's own weight is the one answer sledBaseFor gives (the sheet reads the same): the one asked
  // for here, which stays on the entry whatever kind is picked next, or the one kept in Settings for a
  // plate-loaded machine, so nobody is asked twice. Never a bar's weight kept in Settings.
  else if (kind === 'sled') base = sledBaseFor(S, cfg) || null
  return { kind, base, custom }
}

/**
 * The sled weight already known for an exercise, in the profile's unit: the one asked for here (kept
 * whatever kind is picked next) or one kept in Settings for a plate-loaded machine. 0 when unknown.
 */
export function sledBaseFor(S, cfg) {
  const own = S?.loadSetup?.[cfg?.id]
  if (num(own?.base) > 0 && own.u === unitOf(S)) return num(own.base)
  const kept = num(S?.barWeights?.[cfg?.id])
  return kept > 0 && equipmentLoadKind(cfg) === 'sled' ? kept : 0
}

/**
 * S.loadSetup with `kind` set for `id`, and the sled's own weight `base` (in `unit`). With no `base`
 * given, the entry's earlier one is kept when it is in the same unit, so changing how an exercise is
 * counted and changing it back does not lose it.
 */
export const withLoadSetup = (map, id, kind, { base = null, unit = 'kg', now = Date.now() } = {}) => {
  const all = map && typeof map === 'object' && !Array.isArray(map) ? map : {}
  const u = unit === 'lb' ? 'lb' : 'kg'
  const prev = all[id]
  const kept = prev && prev.u === u && num(prev.base) > 0 ? r2(num(prev.base)) : null
  return { ...all, [id]: { kind, base: num(base) > 0 ? r2(num(base)) : kept, u, _ts: now } }
}

/**
 * What to say about `weight` (the total in the weight box) for an exercise:
 *   { kind, base, unit, total, text, plates, perSide, closest, needsBase }
 * `text` is the one sentence ('' when there is nothing useful to say: no weight, a plain body
 * weight). `plates` is the plates for each side, heaviest first (null when the kind has none),
 * `closest` the nearest load the plates can make when `weight` is not possible, `needsBase` is true
 * when the sled's own weight is still to be set. `bells` is what a dumbbell weight means for the
 * exercise ('each', 'total' or 'as', Workout.jsx).
 */
export function loadModel(S, cfg, weight, { bells = 'as' } = {}) {
  const w = r2(num(weight))
  const unit = unitOf(S)
  const { kind, base } = loadSetupFor(S, cfg)
  const out = { kind, base, unit, total: w, text: '', plates: null, perSide: 0, closest: null, needsBase: false }
  if (!(w > 0)) return out
  const wt = v => fmtPlate(v) + ' ' + unit
  if (kind === 'bar' || kind === 'sled') {
    const bar = kind === 'bar'
    if (base == null) {
      out.needsBase = true
      out.text = t('{0} total · tap to set the sled weight', wt(w))
      return out
    }
    if (w < base) {
      out.text = bar ? t('{0} is lighter than the bar ({1})', wt(w), wt(base)) : t('{0} is lighter than the sled ({1})', wt(w), wt(base))
      return out
    }
    if (w === base) {
      out.plates = []
      out.text = bar ? t('{0} total = just the bar', wt(w)) : t('{0} total = just the sled', wt(w))
      return out
    }
    const L = rowLoad('pairs', w, base, inventoryFor(S))
    out.plates = L.plates
    out.perSide = L.perSide
    if (L.missing > 0) {
      out.closest = r2(w - 2 * L.missing)
      out.text = t('Not possible with your plates: closest {0}', wt(out.closest))
      return out
    }
    if (!(base > 0)) out.text = t('{0} total = {1} on each side', wt(w), fmtPlate(L.perSide))
    else out.text = bar ? t('{0} total = bar {1} + {2} on each side', wt(w), fmtPlate(base), fmtPlate(L.perSide))
      : t('{0} total = sled {1} + {2} on each side', wt(w), fmtPlate(base), fmtPlate(L.perSide))
    return out
  }
  if (kind === 'stack') out.text = t('{0} total (machine stack)', wt(w))
  else if (kind === 'dumbbell') out.text = bells === 'total' ? t('{0} total = {1} per dumbbell', wt(w), wt(w / 2)) : t('{0} per dumbbell', wt(w))
  else if (kind === 'bodyweight') out.text = t('bodyweight + {0}', wt(w))
  else out.text = t('{0} total', wt(w))
  return out
}
