// Adaptive rest (Phase 1b step 2, N6): the rest after a plain work set follows the set, as well as the one
// Rest timer in Settings. ONE helper, read by the workout screen (views/Workout.jsx), the Lock Screen
// activity (lib/live-activity.js) and the auto holds (lib/auto-holds.js), so the three never disagree.
//
//   heavy set   a compound lift for 5 reps or fewer    twice your Rest timer, at most 5:00
//   light set   13 reps or more                        two thirds of your Rest timer
//   any other                                          your Rest timer, as it always was
//
// Both are rounded to 15 s and never go under 15 s. Never touched: the Rest timer off, a rest the
// exercise or one set carries itself ("No timer" included), a pyramid, a superset, a warm-up row, a
// timed hold, cardio. Settings > Workout > Rest > "Adjust rest to the set" (S.restAdapt, on unless it
// is false) turns all of it off.
import { isCompoundEx, isIsolationEx } from './warmup-ramp.js'
import { modeOf } from './history.js'
import { isWarmupRow } from './workout-model.js'
import { isPyramid } from './pyramid.js'
import { ownExerciseRest, restSecFor } from './supersetFlow.js'

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const STEP = 15
const r15 = sec => Math.round(sec / STEP) * STEP

/** The longest a heavy set's adapted rest goes (a Rest timer already longer than this is not shortened). */
export const REST_ADAPT_MAX = 300

/** Settings > Workout > Rest > "Adjust rest to the set": on for every profile that never chose. */
export const restAdaptOn = S => S?.restAdapt !== false

/**
 * 'heavy', 'light' or 'normal' for one set of exercise `id` with `reps` reps. A heavy set is a compound
 * lift (lib/warmup-ramp.js isCompoundEx) for 5 reps or fewer; a light one is 13 reps or more. With
 * `small` (the Aim line, lib/effort-aim.js) a single-joint lift (curls, raises, extensions) is light too.
 * No reps, or an exercise the catalogue does not know, is 'normal'.
 */
export function setClass(id, reps, { small = false } = {}) {
  const n = num(reps)
  if (!(n > 0)) return 'normal'
  if (n <= 5 && isCompoundEx(id)) return 'heavy'
  if (n >= 13 || (small && isIsolationEx(id))) return 'light'
  return 'normal'
}

/** `base` seconds (the Rest timer) for a set of class `cls`: heavy twice, light two thirds, rounded to 15 s. */
export function adaptedRest(base, cls) {
  const b = Math.round(num(base))
  if (!(b > 0)) return 0
  if (cls === 'heavy') return Math.max(b, Math.min(REST_ADAPT_MAX, r15(b * 2)))
  if (cls === 'light') return Math.min(b, Math.max(STEP, r15(b * 2 / 3)))
  return b
}

// The class a rest after set `i` of entry `idx` is adapted to, or null when it is left alone.
function adaptClass(S, entries, unit, idx, i, setRest) {
  if (!restAdaptOn(S)) return null
  if (Array.isArray(unit) && unit.length > 1) return null
  const e = entries?.[idx]
  if (!e) return null
  if (ownExerciseRest(e.target) !== null) return null
  if (setRest && setRest.sec > 0) return null
  if (isPyramid(e.target)) return null
  const row = e.sets?.[i]
  if (!row || isWarmupRow(row)) return null
  if (modeOf({ ...(e.target || {}), id: e.id }) !== 'reps') return null
  const cls = setClass(e.id, num(row.r) || num(e.target?.reps))
  return cls === 'normal' ? null : cls
}

/**
 * The rest after set `i` of entry `idx`: `{ sec, tag }`. `sec` is exactly what restSecFor(entries, unit,
 * S.restSec, setRest) answers when nothing is adapted; `tag` is 'heavy' or 'light' when the Rest timer
 * was adapted to this set (the rest bar says so), else null. `unit` is the superset group as entry
 * indices (a plain exercise is [idx]); `setRest` is a pyramid set's own rest ({ idx, sec }).
 */
export function restPlan(S, entries, unit, idx, i, setRest = null) {
  const base = num(S?.restSec) > 0 ? num(S.restSec) : 0
  const cls = base > 0 ? adaptClass(S, entries, unit, idx, i, setRest) : null
  const adapted = cls ? adaptedRest(base, cls) : base
  const sec = restSecFor(entries, unit, adapted, setRest)
  return { sec, tag: cls && adapted !== base ? cls : null }
}
