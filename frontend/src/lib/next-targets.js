// What each exercise of a routine will open at next time. Read-only: it runs the same builder the
// session start uses (buildSessionEntries) on a copy of the state with no session running, so the
// numbers cannot differ from what Start will put on the screen.
import { buildSessionEntries } from './session-start.js'
import { isWarmupRow } from './workout-model.js'
import { modeOf, exLine } from './history.js'
import { speedUnitOf } from './speed.js'

// Marks a profile as moved to the trainer defaults and returns whether it changed anything.
// The local build starts planned sessions from the last session; a profile moved once keeps the
// person's own choice in Settings after that.
export function applyTrainerDefaults(S) {
  if (!S) return false
  let changed = false
  if (S.trainerDefaultsV1 !== true) {
    S.trainerDefaultsV1 = true
    S.startFrom = 'last'
    changed = true
  }
  // Layout, once per profile (layoutV2): a profile still on Cards, or with no layout saved, opens
  // the workout in List. Focus and Compact were a choice, so they stay; so does a later pick of
  // Cards, because the flag makes this a no-op after the first run.
  if (S.layoutV2 !== true) {
    S.layoutV2 = true
    if (S.workoutView === 'cards' || S.workoutView == null) S.workoutView = 'list'
    changed = true
  }
  // Gym mode, once per profile (gymModeV1): on, with spoken cues and the next exercise coming up by
  // itself, which is what it is built around. A later switch-off in Settings is kept, because the
  // flag makes this a no-op after the first run.
  if (S.gymModeV1 !== true) {
    S.gymModeV1 = true
    S.gymMode = true
    S.spokenCues = true
    S.autoNextExercise = true
    changed = true
  }
  return changed
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null }

// One row per built exercise. `slot` is the index in routine.ex it came from (or -1).
function rowOf(S, entry, slot) {
  const work = (Array.isArray(entry?.sets) ? entry.sets : []).filter(s => s && !isWarmupRow(s))
  const first = work[0] || null
  const mode = modeOf(entry.target || { id: entry.id })
  const top = work.reduce((m, s) => Math.max(m, num(s.w) || 0), 0)
  const cfg = { ...(entry.target || {}), id: entry.id }
  if (work.length) cfg.sets = work.length
  if (top > 0) cfg.weight = top
  if (num(first?.r) > 0) cfg.reps = Math.round(first.r)
  if (num(first?.sec) > 0) cfg.sec = Math.round(first.sec)
  if (num(first?.min) > 0) cfg.min = first.min
  if (num(first?.speed) > 0) cfg.speed = first.speed
  let line = ''
  try { line = exLine(cfg, S.unit || 'kg', speedUnitOf(S)) } catch { line = '' }
  // A rough time for the exercise (about 40 s a set of reps, or the hold itself, plus the rests between sets).
  const n = work.length || 0
  const restSec = num(entry.target?.restSec) ?? num(S.restSec) ?? 90
  const est = mode === 'cardio' ? Math.round((num(first?.min) || 0) * 60)
    : n * (mode === 'time' ? (num(first?.sec) || 40) : 40) + Math.max(0, n - 1) * restSec
  return {
    exId: entry.id, slot, mode, line, est,
    sets: work.length || null, weight: top > 0 ? top : null,
    reps: num(first?.r) > 0 ? Math.round(first.r) : null,
    sec: num(first?.sec) > 0 ? Math.round(first.sec) : null,
    min: num(first?.min) > 0 ? first.min : null,
    // 'up', 'hold', 'deload', ... straight from the prescription, so a card can mark a step up
    kind: entry.plan?.kind || null,
  }
}

/**
 * [{ routineId, name, rows }] for the routines in `routineIds`, in that order. A routine that is
 * missing or cannot be built gives rows []. Never throws, never changes `S`.
 * Limitation: for a future day the deload or programme week is worked out for today, the same
 * as the start flow does.
 */
export function nextTargetsFor(S, routineIds) {
  const st = { ...S, active: null }
  const out = []
  for (const id of [].concat(routineIds || [])) {
    const r = (S?.routines || []).find(x => x && x.id === id)
    if (!r || !Array.isArray(r.ex)) continue
    let entries = []
    try { entries = buildSessionEntries(st, r) } catch { entries = [] }
    const used = new Set()
    const rows = entries.filter(e => e && e.id != null).map(e => {
      const slot = r.ex.findIndex((c, i) => c && c.id === e.id && !used.has(i))
      if (slot >= 0) used.add(slot)
      return rowOf(S, e, slot)
    })
    out.push({ routineId: id, name: r.name, rows })
  }
  return out
}

/** The routine's rows by slot index in routine.ex: { [slot]: row } (for the routine editor). */
export function nextTargetBySlot(S, routineId) {
  const rows = nextTargetsFor(S, [routineId])[0]?.rows || []
  const out = {}
  for (const row of rows) if (row.slot >= 0 && row.line) out[row.slot] = row
  return out
}
