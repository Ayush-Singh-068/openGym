// What a workout's Start asks for the day: the check-in (sleep, energy, soreness, stress) and the body
// weight. One weight and one check-in per day; the first workout of the day asks, the later ones do not.
//
// The answers belong to the workout until it is saved. They ride on the running session as
// `active.staged = { form, lighter, bw: { w, at } }` (every part optional) and are written to the day
// only when the workout is saved (sheets.jsx doFinishWorkout, commitStaged below). A discarded workout,
// a closed weigh-in sheet and "Choose a different workout" write nothing, so the next Start asks again.
// A saved workout never carries `staged` (lib/finish-workout.js writes a fixed list of fields).
import { formOf, readForm, withForm } from './daily-form.js'
import { addWeighIn, readingsOf } from './weigh-ins.js'

const list = v => (Array.isArray(v) ? v : [])

/** The weight of `iso` as the charts read it, or null when the day has none. */
export function weightOn(S, iso) {
  const day = list(S?.bodyweight).find(b => b && b.d === iso)
  const w = Number(day?.w)
  return day && readingsOf(day).length && w > 0 ? w : null
}

/**
 * Writes what the saved workout `A` had staged onto its day (the draft `s` is mutated), stamped `now`.
 * A day that already has a weight or a check-in (typed meanwhile, or from another device) keeps it: the
 * staged one is dropped. Returns what was written: { form, bw } as booleans.
 */
export function commitStaged(s, A, now = Date.now()) {
  const out = { form: false, bw: false }
  const st = A?.staged
  if (!st || typeof st !== 'object' || !A.d) return out
  if (readForm(st.form) && !formOf(s, A.d)) {
    s.dayForm = withForm(s.dayForm, A.d, { ...st.form, lighter: st.lighter || null }, now)
    out.form = true
  }
  if (Number(st.bw?.w) > 0 && weightOn(s, A.d) == null && addWeighIn(s, { d: A.d, at: st.bw.at || null, w: st.bw.w, t: now })) out.bw = true
  return out
}
