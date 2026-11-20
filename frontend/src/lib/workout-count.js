// A saved workout with nothing logged: not one done work set. Warm-ups do not count, and neither do
// the sets of a warm-up exercise (lib/warmup-exercises.js). Pure: no store, no formatting.
import { workSetsDone } from './history.js'

// A record without an entries list (an old one that only has its cached numbers) is left alone.
export const isNothingLogged = w => Array.isArray(w?.entries) && workSetsDone(w) === 0

// The state without such workouts, for the counts Home shows. The same object when there are none.
export function withoutEmptyWorkouts(S) {
  const list = Array.isArray(S?.workouts) ? S.workouts : []
  const kept = list.filter(w => !isNothingLogged(w))
  return kept.length === list.length ? S : { ...S, workouts: kept }
}
