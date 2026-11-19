// What a copy of the profile holds, in the few numbers a person checks before bringing it back:
// routines, workouts, the date of the newest workout. Pure, so the list of copies and the restore
// question (components/LocalSnapshots.jsx) say the same thing about the same data.
const list = v => (Array.isArray(v) ? v : [])

/** { routines, workouts, last, any } for a profile object: `last` is the day ('YYYY-MM-DD') of the
 *  newest workout or '', and `any` says whether it holds anything a person would miss. */
export function summarize(state) {
  const s = state && typeof state === 'object' ? state : {}
  const workouts = list(s.workouts)
  let last = ''
  for (const w of workouts) if (typeof w?.d === 'string' && w.d > last) last = w.d
  const any = !!(workouts.length || list(s.routines).length || list(s.bodyweight).length || list(s.customEx).length || list(s.measurements).length)
  return { routines: list(s.routines).length, workouts: workouts.length, last, any }
}

/** A copy with no routines and no workouts: what a browser keeps from before anything was logged. */
export const isEmptyCopy = sum => !!sum && sum.routines === 0 && sum.workouts === 0

/** Whether bringing `copy` back would leave fewer routines or fewer workouts than `now` has. */
export const holdsLess = (copy, now) => !!copy && !!now && (copy.routines < now.routines || copy.workouts < now.workouts)
