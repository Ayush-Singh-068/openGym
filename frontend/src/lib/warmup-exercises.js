// Warm-up exercises: an exercise the lifter marked as a warm-up, such as Band Pull-Apart. It is never
// counted as work: no records, no volume, no progression, no muscle counts, no work sets.
// S.exWarmup is { [exerciseId]: true }, one switch per exercise like S.bandEx (lib/bands.js).
// Pure functions deep in the app cannot reach the store, so the store hands the map over here each
// time the state is loaded or changed (store/useStore.js), the way lib/exercise-aliases.js gets its names.
let marked = {}

const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v)

/** Called by the store whenever the state is loaded or changed. */
export function registerWarmupExercises(map) {
  marked = isMap(map) ? map : {}
}

/** Is this exercise a warm-up exercise right now? (The store's last say.) */
export const isWarmupExercise = id => id != null && marked[id] === true

/** The same question read from a state object, for a screen that re-renders with the state. */
export const isWarmupExerciseIn = (S, id) => id != null && isMap(S?.exWarmup) && S.exWarmup[id] === true

/** S.exWarmup with `id` switched on (true) or off (the key is taken away). */
export function withWarmupExercise(map, id, on) {
  const next = { ...(isMap(map) ? map : {}) }
  if (on) next[id] = true
  else delete next[id]
  return next
}
