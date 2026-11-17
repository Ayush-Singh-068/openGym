// Sound cues (Settings → Timer alerts → Sound cues): short tunes that say what comes next without
// a look at the phone. When a rest ends, the tune depends on the set that follows:
//   next set of the same exercise      two quick rising notes
//   a different exercise next          three rising notes
//   the last set of its exercise       low, high, low (the chime is high, low, high, so they differ)
//   the other exercise of a superset   one bright tick
// Two more: a soft tick with 10 seconds of rest left, and a short fanfare when the workout is done.
//
// The tunes are data: each note is { freq (Hz), at (start, ms from the cue's start), dur (ms),
// peak (gain 0 to 1, before the master volume of lib/sound.js), wave }. 'bright' is the timbre
// that carries over music and through a phone speaker, 'sine' a plain soft one. Every cue is
// under 1.2 seconds and its notes never overlap, so the peaks never add up past 1.
// useUI.js plays one at the end of a rest (cueForRestEnd) and at 10 seconds left; the workout
// screen tells it what is next (nextKindOf); Settings previews each one (playCue).
import { isWarmupRow, isSideSet } from './workout-model.js'
import { playTones } from './sound.js'

const note = (freq, at, dur, peak, wave = 'bright') => ({ freq, at, dur, peak, wave })

export const CUES = [
  {
    id: 'nextSet',
    label: 'Next set',
    description: 'Two quick rising notes: the same exercise again. Off plays your rest sound.',
    notes: [note(784, 0, 120, 0.9), note(1047, 150, 220, 0.9)],
  },
  {
    id: 'nextExercise',
    label: 'Next exercise',
    description: 'Three rising notes: a different exercise is next. Off plays your rest sound.',
    notes: [note(1047, 0, 140, 0.9), note(1319, 170, 140, 0.9), note(1568, 340, 380, 0.9)],
  },
  {
    id: 'lastSet',
    label: 'Last set',
    description: 'Low, high, low: the next set is the last of its exercise. Off plays your rest sound.',
    notes: [note(784, 0, 170, 0.95), note(1568, 210, 170, 0.95), note(784, 420, 420, 0.95)],
  },
  {
    id: 'supersetSwitch',
    label: 'Superset switch',
    description: 'One bright tick: on to the other exercise of the superset. Off plays your rest sound.',
    notes: [note(1760, 0, 90, 0.8)],
  },
  {
    id: 'tenLeft',
    label: '10 seconds left',
    description: 'A soft tick when 10 seconds of rest are left. Off keeps it silent.',
    notes: [note(880, 0, 200, 0.4, 'sine')],
  },
  {
    id: 'workoutDone',
    label: 'Workout finished',
    description: 'A short fanfare when every set is done. Off keeps it silent.',
    notes: [note(784, 0, 110, 0.9), note(1047, 120, 110, 0.9), note(1319, 240, 110, 0.9), note(1568, 360, 110, 0.9), note(2093, 480, 600, 0.9)],
  },
]
export const CUE_IDS = CUES.map(c => c.id)
export const cueOf = id => CUES.find(c => c.id === id) || null

/** What follows a rest, as nextKindOf says it. */
export const NEXT_KINDS = ['set', 'exercise', 'last', 'superset']
const REST_END_CUE = { set: 'nextSet', exercise: 'nextExercise', last: 'lastSet', superset: 'supersetSwitch' }

/** The cue id for the end of a rest, or null when the next set is not known (the rest's own sound plays then). */
export function cueForRestEnd({ nextKind } = {}) {
  return typeof nextKind === 'string' && Object.hasOwn(REST_END_CUE, nextKind) ? REST_END_CUE[nextKind] : null
}

/** A cue plays unless its own switch was turned off (S.soundCues is { id: false } for those only). */
export function cueEnabled(S, id) {
  return S?.soundCues?.[id] !== false
}

/** The master volume of a profile, 0 to 1 (S.soundVolume), full when it is missing or not a number. */
export function volumeOf(S) {
  const v = S?.soundVolume
  return typeof v === 'number' && Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1
}

/** Plays a cue now through lib/sound.js. `volume` (0 to 1, default 1) scales it on top of the master volume. False for an unknown id. */
export function playCue(id, { volume = 1 } = {}) {
  const cue = cueOf(id)
  if (!cue) return false
  playTones(cue.notes, { volume })
  return true
}

/** playCue for the app's own moments: only with Sounds on and that cue's switch on. Never throws. True when it played. */
export function playCueIf(S, id, opts) {
  if (!S?.sound || !cueEnabled(S, id)) return false
  try { return playCue(id, opts) } catch (e) { return false }
}

// The run of neighbouring entries that share entry `idx`'s superset id (`sg`), the same rule as
// supersetUnits in lib/history.js; a plain exercise is a unit of one.
function unitOf(entries, idx) {
  const sg = entries[idx]?.sg
  if (!sg) return [idx]
  let lo = idx
  let hi = idx
  while (lo > 0 && entries[lo - 1]?.sg === sg) lo--
  while (hi < entries.length - 1 && entries[hi + 1]?.sg === sg) hi++
  return Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
}

// A set still to do. The set just ticked, (doneIdx, doneI), counts as done even when the entries
// still show it open. A per-side set is open until both sides are done.
function isOpen(entries, idx, i, doneIdx, doneI) {
  const s = entries[idx]?.sets?.[i]
  if (!s || (idx === doneIdx && i === doneI)) return false
  return !(isSideSet(s) ? s.sides.L.done && s.sides.R.done : s.done)
}

/**
 * What comes after the set just ticked (set `setIndex` of `entries[entryIndex]`), for the cue at
 * the end of its rest: 'exercise' (a different exercise, outside a superset), 'last' (the next
 * set is the last work set of its exercise), 'superset' (the other member of the same superset,
 * not its last set) or 'set' (the same exercise again). undefined when nothing is left, or the
 * input is not usable. The next set is found the way lib/spoken-cues.js nextSetAfter finds it: in
 * a superset the next member that still has a set (round and round), else the same exercise,
 * else the next exercise down the list that has one (wrapping once).
 */
export function nextKindOf(entries, entryIndex, setIndex) {
  if (!Array.isArray(entries) || !Number.isInteger(entryIndex) || entryIndex < 0 || entryIndex >= entries.length) return undefined
  const find = idx => {
    const n = entries[idx]?.sets?.length || 0
    for (let i = 0; i < n; i++) if (isOpen(entries, idx, i, entryIndex, setIndex)) return { idx, i }
    return null
  }
  const unit = unitOf(entries, entryIndex)
  let next = null
  if (unit.length > 1) {
    const k = unit.indexOf(entryIndex)
    for (let j = 1; j <= unit.length && !next; j++) next = find(unit[(k + j) % unit.length])
  } else {
    next = find(entryIndex)
  }
  for (let j = 1; j < entries.length && !next; j++) next = find((entryIndex + j) % entries.length)
  if (!next) return undefined
  const inSuperset = unit.length > 1 && unit.includes(next.idx)
  if (next.idx !== entryIndex && !inSuperset) return 'exercise'
  const sets = entries[next.idx].sets
  const lastOfExercise = !isWarmupRow(sets[next.i]) && !sets.some((x, j) => j !== next.i && !isWarmupRow(x) && isOpen(entries, next.idx, j, entryIndex, setIndex))
  if (lastOfExercise) return 'last'
  return next.idx !== entryIndex ? 'superset' : 'set'
}
