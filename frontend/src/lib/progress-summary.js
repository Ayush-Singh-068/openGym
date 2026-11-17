// The numbers behind the Progress card on Home: this month's training against the plan, the lifts
// that moved over the last four weeks, and the body weight week on week. Pure and read-only, and
// every part is guarded so one bad record cannot break Home.
import { monthStatuses, addDaysKey, dayKeyOf } from './day-status.js'
import { e1rmSeries } from './onerm.js'
import { modeOf, workoutDay } from './history.js'
import { isWarmupRow } from './workout-model.js'

const WINDOW_DAYS = 28
const LIFTS = 3
const round1 = n => Math.round(n * 10) / 10

// A workout's logged exercises, or none when the record is malformed.
const doneWork = w => (Array.isArray(w?.entries) ? w.entries : [])

function monthPart(S, today) {
  const d = new Date(today)
  const counts = { done: 0, skipped: 0, missed: 0, remaining: 0 }
  for (const st of Object.values(monthStatuses(S, d.getFullYear(), d.getMonth(), today))) {
    if (st.kind === 'done') counts.done++
    else if (st.kind === 'skipped') counts.skipped++
    else if (st.kind === 'missed') counts.missed++
    else if (st.kind === 'today' || st.kind === 'planned') counts.remaining++
  }
  // Skipped days are not counted against you, so they leave the planned total.
  return { ...counts, planned: counts.done + counts.missed + counts.remaining }
}

function liftsPart(S, todayKey) {
  const cutoff = addDaysKey(todayKey, -WINDOW_DAYS)
  // Per exercise: how many recent workouts trained it for reps, and the latest day it was done.
  const seen = new Map()
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    const day = workoutDay(w)
    if (!day || day <= cutoff || day > todayKey) continue
    for (const e of doneWork(w)) {
      if (e?.id == null) continue
      const worked = (Array.isArray(e.sets) ? e.sets : []).some(s => s && s.done && !isWarmupRow(s))
      if (!worked) continue
      let mode = null
      try { mode = modeOf(e.target || { id: e.id }) } catch { mode = null }
      if (mode !== 'reps') continue
      const row = seen.get(e.id) || { id: e.id, sessions: 0, latest: '' }
      row.sessions++
      if (day > row.latest) row.latest = day
      seen.set(e.id, row)
    }
  }
  const ranked = [...seen.values()].sort((a, b) => (b.sessions - a.sessions) || (a.latest < b.latest ? 1 : a.latest > b.latest ? -1 : 0))
  const out = []
  for (const row of ranked) {
    if (out.length >= LIFTS) break
    let pts = []
    try { pts = e1rmSeries(S, row.id) || [] } catch { pts = [] }
    const inWindow = pts.filter(p => p.d > cutoff && p.d <= todayKey)
    if (!inWindow.length) continue
    const est = Math.max(...inWindow.map(p => p.y))
    // The baseline is the last point before the window; failing that, the first in-window point,
    // but only when there are two of them to compare.
    const older = pts.filter(p => p.d <= cutoff)
    const before = older.length ? older[older.length - 1] : inWindow.length >= 2 ? inWindow[0] : null
    const delta = before ? est - before.y : null
    const pct = before && before.y > 0 ? delta / before.y * 100 : null
    out.push({
      id: row.id,
      sessions: row.sessions,
      est: round1(est),
      delta: delta == null ? null : round1(delta),
      pct: pct == null ? null : round1(pct),
      // the in-window estimates, oldest first, for a sparkline
      spark: inWindow.map(p => p.y),
    })
  }
  return out
}

function weightPart(S, todayKey) {
  const rows = (Array.isArray(S?.bodyweight) ? S.bodyweight : []).filter(e => e && typeof e.d === 'string' && Number.isFinite(Number(e.w)))
  const lastWeekFrom = addDaysKey(todayKey, -6)
  const prevFrom = addDaysKey(todayKey, -13)
  const prevTo = addDaysKey(todayKey, -7)
  const mean = list => (list.length ? list.reduce((n, e) => n + Number(e.w), 0) / list.length : null)
  const a = rows.filter(e => e.d >= lastWeekFrom && e.d <= todayKey)
  if (!a.length) return null
  const b = rows.filter(e => e.d >= prevFrom && e.d <= prevTo)
  const avg = mean(a)
  const prevAvg = mean(b)
  return { avg, prevAvg, delta: prevAvg == null ? null : avg - prevAvg, n: a.length }
}

/**
 * progressSummary(S, today) -> { month, lifts, weight, empty }. `today` is a Date (the clock
 * is read by the caller, so tests can fix it).
 */
export function progressSummary(S, today = new Date()) {
  const todayKey = dayKeyOf(today)
  let month = { done: 0, skipped: 0, missed: 0, remaining: 0, planned: 0 }
  let lifts = []
  let weight = null
  try { month = monthPart(S, today) } catch { /* keep the empty month */ }
  try { lifts = liftsPart(S, todayKey) } catch { lifts = [] }
  try { weight = weightPart(S, todayKey) } catch { weight = null }
  const empty = !(Array.isArray(S?.workouts) && S.workouts.length) && !weight
  return { month, lifts, weight, empty }
}
