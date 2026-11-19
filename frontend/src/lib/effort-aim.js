// The Aim in plain words (Phase 1b step 2, N5): one line in the "About this weight" sheet that says how hard
// to push, from what the app already knows (no new data to enter, nothing adjusted from it):
//
//   a heavy big lift (5 reps or fewer)                 a couple of reps to spare
//   everything else                                    one or two reps to spare
//   a light set: 13 reps or more, or a small muscle    close to the limit, one rep to spare
//   the first time with an exercise, or a deload       keep it easy
//   a programme week that carries an RPE               its RPE turned into one of the four
import { t } from './i18n-core.js'
import { setClass } from './rest-adapt.js'

/** A programme week's RPE as one of the four kinds: 9 and up close to the limit, 8.5 one or two, 7 to 8 a couple, under 7 easy. */
export function aimFromRpe(rpe) {
  if (rpe == null || rpe === '') return null
  const n = Number(rpe)
  if (!Number.isFinite(n)) return null
  if (n >= 9) return 'limit'
  if (n >= 8.5) return 'oneOrTwo'
  if (n >= 7) return 'couple'
  return 'easy'
}

/**
 * 'couple', 'oneOrTwo', 'limit' or 'easy' for exercise `id` with `reps` reps in the set about to be done.
 * `plan` is the entry's progression plan (kind 'first', 'deload', 'deloadweek', or a programme's
 * `prog.rpe`); `deload` is the entry's own deload flag (a deload slot).
 */
export function aimKind({ id, reps = 0, plan = null, deload = false } = {}) {
  const kind = plan?.kind
  if (deload || kind === 'first' || kind === 'deload' || kind === 'deloadweek' || plan?.prog?.deload) return 'easy'
  const fromRpe = aimFromRpe(plan?.prog?.rpe)
  if (fromRpe) return fromRpe
  const cls = setClass(id, reps, { small: true })
  return cls === 'heavy' ? 'couple' : cls === 'light' ? 'limit' : 'oneOrTwo'
}

/** The Aim line, translated. */
export function aimLine(ctx) {
  const k = aimKind(ctx)
  if (k === 'couple') return t('Aim: a couple of reps to spare')
  if (k === 'limit') return t('Aim: close to the limit, one rep to spare')
  if (k === 'easy') return t('Aim: keep it easy')
  return t('Aim: one or two reps to spare')
}
