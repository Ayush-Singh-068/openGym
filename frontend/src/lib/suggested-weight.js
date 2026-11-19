// "Back to the suggested weight" (Phase 1b step 2, N3): the progression engine's weight for an exercise
// (entry.plan.weight) and the open work rows that are not at it. Pure: every number is in the unit the
// entry is read in (the card reads the exercise's own unit; Workout.jsx changes it through inEntryUnit,
// which stores the profile's unit, so nothing is converted here).
import { isWarmupRow, isSideSet, syncSideAggregate } from './workout-model.js'
import { isPyramid } from './pyramid.js'

const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || 0)
const same = (a, b, eps = 0.01) => Math.abs(num(a) - num(b)) < eps
const SIDES = ['L', 'R']

/**
 * The weight the plan suggested, or 0 for none: no plan, a first session, progression off, a session
 * target, a bodyweight plan (weight 0), a pyramid or back-off sets (no one weight), or a plan whose number
 * no longer is the exercise's own target weight (the target was edited, or the unit moved: showing it would
 * be wrong).
 */
export function suggestedWeight(entry) {
  const plan = entry?.plan
  const tg = entry?.target
  if (!plan || entry.sessionTarget || plan.kind === 'first' || plan.kind === 'off' || plan.policy === 'off') return 0
  const w = num(plan.weight)
  if (!(w > 0)) return 0
  if (isPyramid(tg) || num(tg?.backoffStep) > 0) return 0
  if (!same(tg?.weight, w, 0.05)) return 0
  return w
}

/**
 * `{ w, rows }` when open work rows (not done, not warm-ups; a per-side row counts when a side still to do
 * differs) are not at the suggested weight `w`; null when there is no suggestion or nothing differs.
 */
export function backToPlan(entry) {
  const w = suggestedWeight(entry)
  if (!(w > 0)) return null
  const rows = []
  ;(entry.sets || []).forEach((s, i) => {
    if (!s || isWarmupRow(s)) return
    if (isSideSet(s)) {
      if (SIDES.some(k => s.sides[k]?.done !== true && !same(s.sides[k]?.w, w))) rows.push(i)
      return
    }
    if (s.done !== true && !same(s.w, w)) rows.push(i)
  })
  return rows.length ? { w, rows } : null
}

/**
 * `sets` with the weight of the rows listed in `rows` (from backToPlan) set to `w`. A side already done
 * and a done row are never touched; the weight is the plan's again, so the "typed by hand" mark is dropped.
 */
export function withSuggestedWeight(sets, w, rows) {
  const at = new Set(rows)
  return sets.map((s, i) => {
    if (!at.has(i) || !s) return s
    if (isSideSet(s)) {
      const sides = {}
      for (const k of SIDES) {
        const side = s.sides[k]
        if (side.done === true) { sides[k] = side; continue }
        const { weightOrigin, ...rest } = side
        sides[k] = { ...rest, w }
      }
      return syncSideAggregate({ ...s, sides })
    }
    if (s.done === true) return s
    const { weightOrigin, ...rest } = s
    return { ...rest, w }
  })
}
