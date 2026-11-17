// What each day of the calendar was: trained, skipped on purpose, missed, rest, or still to come.
// Pure and read-only. "Scheduled" comes from effectiveRoutineIds, which already folds in the weekday
// plan, one-off day overrides, a coach queue and a running programme (programmes write into S.week).
import { effectiveRoutineIds, workoutDay } from './history.js'
import { isoOf } from './format.js'
import { dayNoteOf, withDayNote, readDayNote, SKIP_TAGS } from './day-notes.js'

export const SKIP_REASONS = ['travel', 'sick', 'busy', 'other']
export const dayKeyOf = date => isoOf(date)

// Noon keeps the date away from daylight-saving edges when a day is added to.
const noon = key => new Date(key + 'T12:00:00')
export const addDaysKey = (key, n) => { const d = noon(key); d.setDate(d.getDate() + n); return isoOf(d) }
export function daysBetween(fromKey, toKey) {
  const out = []
  // The cap stops a bad key pair from looping for ever.
  for (let k = fromKey, i = 0; k <= toKey && i < 400; k = addDaysKey(k, 1), i++) out.push(k)
  return out
}

const idsOfWorkout = w => (Array.isArray(w.routineIds) && w.routineIds.length ? w.routineIds : w.routineId ? [w.routineId] : [])

/** The skip reason a note stands for on a day, or null. `scheduled`: the day had a plan. */
export function skipReasonOf(note, scheduled) {
  if (!note) return null
  if (SKIP_REASONS.includes(note.tag)) return note.tag
  if (note.tag === 'injured') return 'sick'
  // A plain note (or a rest note) only counts as a skip on a day that was planned to train.
  return scheduled ? 'other' : null
}

// Workouts grouped by day once, so a month or a week is one pass over the history.
function indexOf(S) {
  const byDay = new Map()
  let first = null
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    if (!w) continue
    const day = workoutDay(w)
    if (!day) continue
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day).push(w)
    if (first === null || day < first) first = day
  }
  return { byDay, first }
}
const safe = S => ({ ...S, routines: S?.routines || [], week: S?.week || {}, dayPlan: S?.dayPlan || {}, workouts: S?.workouts || [] })

function statusOf(S, safeS, idx, dayKey, todayKey) {
  const done = idx.byDay.get(dayKey)
  if (done?.length) {
    return {
      kind: 'done',
      workoutIds: done.map(w => w.id).filter(id => id != null).map(String),
      routineIds: [...new Set(done.flatMap(idsOfWorkout))],
    }
  }
  let planned = []
  try { planned = effectiveRoutineIds(safeS, dayKey, todayKey) } catch { planned = [] }
  const scheduled = planned.length > 0
  const reason = skipReasonOf(dayNoteOf(S, dayKey), scheduled)
  if (reason) return { kind: 'skipped', reason, workoutIds: [], routineIds: planned }
  if (!scheduled) return { kind: 'rest', workoutIds: [], routineIds: [] }
  if (dayKey === todayKey) return { kind: 'today', workoutIds: [], routineIds: planned }
  if (dayKey > todayKey) return { kind: 'planned', workoutIds: [], routineIds: planned }
  // Before the first logged workout there is nothing to measure against, so it is not a miss.
  const tracked = idx.first !== null && dayKey >= idx.first
  return { kind: tracked ? 'missed' : 'rest', workoutIds: [], routineIds: planned }
}

const keyOfToday = today => (typeof today === 'string' ? today : dayKeyOf(today))

export function dayStatus(S, dayKey, today = new Date()) {
  return statusOf(S, safe(S), indexOf(S), dayKey, keyOfToday(today))
}
export function statusesBetween(S, fromKey, toKey, today = new Date()) {
  const todayKey = keyOfToday(today), safeS = safe(S), idx = indexOf(S), out = {}
  for (const k of daysBetween(fromKey, toKey)) out[k] = statusOf(S, safeS, idx, k, todayKey)
  return out
}
export function monthStatuses(S, year, monthIndex0, today = new Date()) {
  const last = new Date(year, monthIndex0 + 1, 0).getDate()
  const key = d => isoOf(new Date(year, monthIndex0, d, 12))
  return statusesBetween(S, key(1), key(last), today)
}

/** S.dayNotes with `keys` written as skips of `reason` (one tagged note per day), stamped `now`. */
export function withSkipDays(map, keys, reason, text = '', now = Date.now()) {
  let out = map
  for (const k of keys) out = withDayNote(out, k, { tag: reason, text }, now)
  return out
}
/** S.dayNotes with the skip on `keys` taken away (a stamped clear, so the removal syncs). */
export function withoutSkipDays(map, keys, now = Date.now()) {
  let out = map
  for (const k of keys) {
    // Only a skip is cleared. A note typed on its own (a rest note, a text) stays.
    const note = readDayNote(map?.[k])
    if (!note || !SKIP_TAGS.includes(note.tag)) continue
    out = withDayNote(out, k, null, now)
  }
  return out
}
