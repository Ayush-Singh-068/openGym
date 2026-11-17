// Gym mode (Settings → Workout → Gym mode, on by default in the local build): built for training
// with the phone in a pocket, so fewer taps, bigger buttons and the next set always on screen.
// S.gymMode is the master switch and S.gymOpts = { big, asPlanned, next, awake } its four parts; a
// part missing from gymOpts counts as on. This file is the pure side: whether a part is on, which
// set comes next, the line that says so, and which sets "Complete as planned" ticks.
import { isWarmupRow, isSideSet } from './workout-model.js'
import { modeOf, setsRepsOf } from './history.js'
import { fmtNum } from './format.js'
import { t, tn, tnf, exerciseNameFor } from './i18n-core.js'
import { EXIDX } from './exercises.js'
import { viewEntry, exUnitOf } from './ex-unit.js'

export const GYM_OPTS = ['big', 'asPlanned', 'next', 'awake']

/** Whether Gym mode is on for this profile. */
export const gymOn = S => S?.gymMode === true

/** Whether one part of it is on: the master switch is on and the part was not switched off. */
export const gymOpt = (S, key) => gymOn(S) && S?.gymOpts?.[key] !== false

// The run of neighbouring entries that share entry `idx`'s superset id (`sg`), the same rule as
// lib/cue-sounds.js; a plain exercise is a unit of one.
function unitAt(entries, idx) {
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
function rowOpen(entries, idx, i, doneIdx, doneI) {
  const s = entries[idx]?.sets?.[i]
  if (!s || (idx === doneIdx && i === doneI)) return false
  return !(isSideSet(s) ? s.sides.L.done && s.sides.R.done : s.done)
}

/**
 * The set that comes after set `setIndex` of `entries[entryIndex]` (the one just ticked): `{ idx, i,
 * inSuperset }`, or null when nothing is left. The same walk as lib/cue-sounds.js nextKindOf: in a
 * superset the next member that still has a set (round and round), else the same exercise, else
 * the next exercise down the list that has one (wrapping once).
 */
export function nextSetPos(entries, entryIndex, setIndex) {
  if (!Array.isArray(entries) || !Number.isInteger(entryIndex) || entryIndex < 0 || entryIndex >= entries.length) return null
  const find = idx => {
    const n = entries[idx]?.sets?.length || 0
    for (let i = 0; i < n; i++) if (rowOpen(entries, idx, i, entryIndex, setIndex)) return { idx, i }
    return null
  }
  const unit = unitAt(entries, entryIndex)
  let next = null
  if (unit.length > 1) {
    const k = unit.indexOf(entryIndex)
    for (let j = 1; j <= unit.length && !next; j++) next = find(unit[(k + j) % unit.length])
  } else {
    next = find(entryIndex)
  }
  for (let j = 1; j < entries.length && !next; j++) next = find((entryIndex + j) % entries.length)
  if (!next) return null
  return { ...next, inSuperset: unit.length > 1 && unit.includes(next.idx) }
}

// The number a set row goes by: work sets and warm-ups are counted apart, a per-side timed pair is one.
function setNumber(sets, i) {
  const warm = isWarmupRow(sets[i])
  const n = sets.slice(0, i + 1).filter(x => isWarmupRow(x) === warm).length
  return sets[i]?.side ? Math.ceil(n / 2) : n
}

// What one set asks for, in a few words: "80 kg × 8", "12 reps", "45 seconds", "20 minutes".
function detailOf(entry, s, unit) {
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  const w = Number(s.w) || 0
  if (mode === 'cardio') {
    const min = Number(s.min) || 0
    return min > 0 ? tnf('{0} minute', '{0} minutes', min, fmtNum(min)) : ''
  }
  if (mode === 'time') {
    const sec = Number(s.sec ?? entry.target?.sec) || 0
    const hold = sec > 0 ? tn('{0} second', '{0} seconds', sec) : ''
    return w > 0 ? [hold, fmtNum(w) + ' ' + unit].filter(Boolean).join(' · ') : hold
  }
  if (mode !== 'reps') {
    try { return setsRepsOf({ ...(entry.target || {}), id: entry.id }) } catch { return '' }
  }
  const sided = isSideSet(s)
  const r = sided ? Number(s.sides.L.r) || 0 : Number(s.r) || 0
  if (!(r > 0)) return w > 0 ? fmtNum(w) + ' ' + unit : ''
  const reps = sided ? t('{0}/side', r) : r
  if (w > 0) return fmtNum(w) + ' ' + unit + ' × ' + reps
  return sided ? t('{0}/side', r) : tn('{0} rep', '{0} reps', r)
}

/**
 * The line the rest bar shows: what comes after set `setIndex` of `entries[entryIndex]` (the one
 * just ticked). "Next: set 3 · 80 kg × 8" for the same exercise (with " · Last set" added when it
 * is the last work set of its exercise), "Next: Squat · 80 kg × 8" for the other exercise of a
 * superset, "Next: Squat · 3 × 12–15" for a different exercise. '' when nothing is left.
 * `unit` is the profile's. Optional `view` (an entry as its exercise shows it), `unitFor` (an
 * exercise's unit) and `nameFor` (an entry's name) are for the app's own wiring, nextUpFor below.
 */
export function nextUpText(entries, entryIndex, setIndex, unit = 'kg', { view = e => e, unitFor = () => unit, nameFor = e => e?.n || '' } = {}) {
  const next = nextSetPos(entries, entryIndex, setIndex)
  if (!next) return ''
  const entry = entries[next.idx]
  const shown = view(entry) || entry
  const s = shown?.sets?.[next.i]
  if (!s) return ''
  const detail = detailOf(shown, s, unitFor(entry.id) || unit)
  const name = nameFor(entry)
  if (next.idx !== entryIndex && !next.inSuperset) {
    let plan = ''
    try { plan = setsRepsOf({ ...(entry.target || {}), id: entry.id }) } catch { plan = '' }
    return t('Next: {0} · {1}', name, plan || detail)
  }
  const sets = entry.sets
  const last = !isWarmupRow(sets[next.i]) && !sets.some((x, j) => j !== next.i && !isWarmupRow(x) && rowOpen(entries, next.idx, j, entryIndex, setIndex))
  const mark = last ? ' · ' + t('Last set') : ''
  if (next.idx !== entryIndex) return t('Next: {0} · {1}', name, detail) + mark
  if (isWarmupRow(sets[next.i])) return t('Next: {0} · {1}', t('Warm-up'), detail)
  return t('Next: set {0} · {1}', setNumber(sets, next.i), detail) + mark
}

/**
 * nextUpText for the running workout of profile `S`, in the units and names the screen shows:
 * '' unless Gym mode and its "Show what’s next" switch are on, and when nothing is left. Never throws.
 */
export function nextUpFor(S, entryIndex, setIndex) {
  if (!gymOpt(S, 'next') || !Array.isArray(S?.active?.entries)) return ''
  try {
    return nextUpText(S.active.entries, entryIndex, setIndex, S.unit === 'lb' ? 'lb' : 'kg', {
      view: e => viewEntry(S, e) || e,
      unitFor: id => exUnitOf(S, id),
      nameFor: e => { const ex = EXIDX[e?.id]; return (ex ? exerciseNameFor(ex) : e?.n) || '' },
    })
  } catch { return '' }
}

/**
 * The sets "Complete as planned" ticks: the rows of `entry` still open that are working sets, not
 * warm-ups, and not per-side rows (those are ticked one side at a time). Their indexes, in order.
 */
export function asPlannedRows(entry) {
  const out = []
  ;(entry?.sets || []).forEach((s, i) => { if (s && !s.done && !isWarmupRow(s) && !isSideSet(s) && !s.side) out.push(i) })
  return out
}
