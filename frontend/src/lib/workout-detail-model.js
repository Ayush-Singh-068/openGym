// The numbers and rows the saved workout sheet shows (components/WorkoutDetailView.jsx).
// Pure: no React, no store. Everything is worked out from the saved record and the profile.
import { setLabel, workoutVolume, sessionVolume, countsWarmups, setsDone, workoutDay, workoutDuration, sessionSections, effortOf, setUnits, modeOf } from './history.js'
import { setTrendOn, setTrendsFor, lastTimeBefore } from './set-trend.js'
import { savedEntryRecords, liveRecordsOn } from './set-records.js'
import { bestSetOf, formulaOf, FORMULA_NAMES } from './onerm.js'
import { rirOf, toScale, displayScale } from './effort.js'
import { isWarmupRow, hasCompletedWork, isSideSet, isFailureSet } from './workout-model.js'
import { viewEntry } from './ex-unit.js'
import { EXIDX, isAssisted } from './exercises.js'
import { exerciseNameFor, t } from './i18n.js'
import { entryTimes } from './exercise-time.js'
import { setNoteOf } from './set-notes.js'
import { setTagOf } from './set-tags.js'
import { glyphOf } from './glyphs.js'
import { entryDbLoad } from './dumbbells.js'
import { speedUnitOf } from './speed.js'
import { hrLabel } from './heart-rate.js'
import { isWarmupExercise } from './warmup-exercises.js'

const num = v => Number(v) || 0
// Rounds to two decimals, so a float sum does not print as 2.4000000000000004.
const round2 = n => Math.round(n * 100) / 100
// -1, 0 or 1 for a number (and never -0).
const sign = n => Math.sign(n) || 0

// The work rows of an entry that count as sets: done, and not a warm-up.
const workRowsOf = entry => (Array.isArray(entry?.sets) ? entry.sets : []).filter(s => hasCompletedWork(s) && !isWarmupRow(s))

// Sets of an entry in the units the sets header counts: a per-side row is two.
const workSetsOf = entry => (isWarmupExercise(entry?.id) ? 0 : workRowsOf(entry).reduce((n, s) => n + setUnits(s), 0))

// The row's own record without its effort, so the label does not print "(RIR 2)": the effort has
// a column of its own. The sides of a per-side row are cleared the same way.
const plainEffort = s => {
  const clear = side => (side ? { ...side, rir: null, rpe: null } : side)
  const out = { ...s, rir: null, rpe: null }
  if (s.sides) out.sides = { ...s.sides, L: clear(s.sides.L), R: clear(s.sides.R) }
  return out
}

// Header numbers of a saved workout.
export function headerOf(S, w) {
  const entries = Array.isArray(w.entries) ? w.entries : []
  return {
    name: w.name,
    routineId: w.routineId || w.routineIds?.[0] || null,
    dateISO: workoutDay(w) || w.d,
    startMs: w.start,
    endMs: w.end,
    durationMs: workoutDuration(w),
    volume: sessionVolume(w, S),
    sets: Array.isArray(w.entries) ? setsDone(w) : 0,
    workSets: entries.reduce((n, e) => n + workSetsOf(e), 0),
    // Done warm-up sets only (rows marked as warm-up). The sets of a warm-up exercise are neither work
    // nor warm-up sets, so they are not counted here either (lib/warmup-exercises.js).
    warmSets: entries.reduce((n, e) => n + (isWarmupExercise(e?.id) ? 0 : (Array.isArray(e?.sets) ? e.sets : [])
      .filter(s => isWarmupRow(s) && hasCompletedWork(s)).reduce((m, s) => m + setUnits(s), 0)), 0),
    prCount: (w.prs || []).length,
    bodyweight: w.bw || null,
    unit: S.unit,
  }
}

// Done/total rows of one entry for the set table. Warm-ups are kept and flagged; undone rows are
// dropped. Rows are numbered the way the sets are: warm-ups among warm-ups, work among work.
export function setRows(S, w, entry, { trends = true } = {}) {
  const ve = viewEntry(S, entry)
  const last = trends && setTrendOn(S) ? lastTimeBefore(S, w, entry) : null
  const trendsArr = last ? setTrendsFor(ve, viewEntry(S, { ...last, id: entry.id }), { formula: formulaOf(S) }) : []
  const recs = liveRecordsOn(S) ? savedEntryRecords(S, w, entry, { as: entryDbLoad(entry), formula: formulaOf(S) }) : []
  // A per-side hold is one row per side: it says which, as a per-side lift does ("L 15×8 · R 15×7").
  const sideOfHold = s => ((s.side === 'L' || s.side === 'R') && Number(s.sec) > 0 && !(Number(s.r) > 0) && !isSideSet(s) ? s.side : '')
  const counts = { warm: 0, work: 0 }
  const rows = []
  ;(ve.sets || []).forEach((s, j) => {
    const warm = isWarmupRow(s)
    const n = warm ? ++counts.warm : ++counts.work
    if (!hasCompletedWork(s)) return
    // The effort is read from the saved row, not the viewed one, so it is the same value either way.
    const src = entry.sets[j] || s
    const r = rirOf(src) ?? rirOf(src.sides?.L) ?? rirOf(src.sides?.R)
    const kind = effortOf(S) !== 'none' ? effortOf(S) : displayScale(S)
    const side = sideOfHold(src)
    rows.push({
      j,
      warm,
      n,
      label: (side ? t(side) + ' ' : '') + setLabel(entry.id, plainEffort(s), entry.target, speedUnitOf(S)) + hrLabel(src),
      effort: !warm && r != null ? { kind, value: toScale(kind, r) } : null,
      records: recs[j] || [],
      trend: trendsArr[j] || null,
      note: setNoteOf(s),
      tag: setTagOf(s),
      failure: isFailureSet(s),
    })
  })
  return rows
}

// The heaviest done work row, or for a hold or cardio the longest one. Ties go to more reps.
const topKeyOf = s => (Number(s.r) > 0 ? [num(s.w), num(s.r)] : [num(s.sec) || num(s.min) * 60, 0])
const beats = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] > b[1])
function topRowOf(rows) {
  let top = null
  let topKey = null
  rows.forEach(s => {
    const key = topKeyOf(s)
    if (!topKey || beats(key, topKey)) { top = s; topKey = key }
  })
  return top
}

// Numbers for the entry card: best set, e1RM, volume, time.
export function entryStats(S, entry) {
  const ve = viewEntry(S, entry)
  const work = workRowsOf(ve)
  const top = topRowOf(work)
  const formula = formulaOf(S)
  return {
    workSets: workSetsOf(entry),
    volume: workoutVolume({ entries: [ve] }, { warmups: countsWarmups(S) }),
    topLabel: top ? setLabel(entry.id, plainEffort(top), entry.target, speedUnitOf(S)) : '',
    e1rm: bestSetOf(ve, formula),
    formulaName: FORMULA_NAMES[formula] || formula,
  }
}

// "vs last time": null when there is no earlier session, or the exercise is not a reps or hold
// exercise. For reps: the change in top weight, in reps at that weight and in volume. For a hold:
// the change in its longest time.
export function compareToLast(S, w, entry) {
  const last = lastTimeBefore(S, w, entry)
  if (!last) return null
  const mode = modeOf({ ...(entry.target || {}), id: entry.id })
  if (mode === 'cardio' || mode === 'distance') return null
  const ve = viewEntry(S, entry)
  const lastView = viewEntry(S, { ...last, id: entry.id })
  const cur = workRowsOf(ve)
  const prev = workRowsOf(lastView)
  if (!cur.length || !prev.length) return null
  const timed = rows => rows.every(s => Number(s.sec) > 0 && !(Number(s.r) > 0))
  if (timed(cur)) {
    if (!timed(prev)) return null
    const secDelta = round2(Math.max(...cur.map(s => num(s.sec))) - Math.max(...prev.map(s => num(s.sec))))
    return { lastDay: last.d, secDelta, dir: sign(secDelta) }
  }
  const curTop = topRowOf(cur)
  const prevTop = topRowOf(prev)
  const bestDelta = round2(num(curTop.w) - num(prevTop.w))
  const repsDelta = Math.round(num(curTop.r) - num(prevTop.r))
  const volDelta = round2(workoutVolume({ entries: [{ id: entry.id, sets: cur }] }, { warmups: false })
    - workoutVolume({ entries: [{ id: entry.id, sets: prev }] }, { warmups: false }))
  const prevVol = workoutVolume({ entries: [{ id: entry.id, sets: prev }] }, { warmups: false })
  const volPct = prevVol ? Math.round(100 * volDelta / prevVol) : null
  // On an assistance machine a lighter load is the better set, so the direction is flipped.
  const assistedFlip = isAssisted(entry.id)
  const raw = sign(bestDelta) || sign(volDelta)
  return {
    lastDay: last.d,
    bestDelta,
    repsDelta,
    volDelta,
    volPct,
    dir: assistedFlip ? -raw : raw,
    assistedFlip,
  }
}

// The whole model the component renders.
export function buildDetailModel(S, w) {
  const entries = Array.isArray(w.entries) ? w.entries : []
  const groups = sessionSections(entries)
  const grouped = groups.length > 1 || !!(groups[0] && groups[0].rid && (w.routineIds || []).length > 1)
  const routines = S.routines || []
  const sections = groups.map(g => {
    const r = g.rid ? routines.find(x => x.id === g.rid) : null
    const items = g.items.map(i => entries[i])
    return {
      rid: g.rid,
      name: r ? r.name : null,
      iconName: r ? glyphOf(r.emoji) : null,
      sets: items.reduce((n, e) => n + workSetsOf(e), 0),
      volume: workoutVolume({ entries: items.map(e => viewEntry(S, e)) }, { warmups: countsWarmups(S) }),
      units: g.units,
    }
  })
  const times = entryTimes(w)
  const cards = {}
  entries.forEach((entry, i) => {
    cards[i] = {
      index: i,
      entry,
      id: entry.id,
      name: EXIDX[entry.id] ? exerciseNameFor(EXIDX[entry.id]) : (entry.n || entry.id),
      rows: setRows(S, w, entry),
      stats: entryStats(S, entry),
      compare: compareToLast(S, w, entry),
      timeMs: times[i] || 0,
      pr: !!(w.prs && w.prs.includes(entry.id)),
      note: entry.note,
      notePin: !!entry.notePin,
      setNotes: setNotesOf(entry),
    }
  })
  return {
    header: headerOf(S, w),
    grouped,
    sections,
    cards,
  }
}

// Every set's note of an entry, numbered the way the workout numbers its rows (warm-ups apart).
function setNotesOf(entry) {
  const sets = Array.isArray(entry.sets) ? entry.sets : []
  return sets.map((s, i) => ({ i, s })).filter(x => setNoteOf(x.s) && hasCompletedWork(x.s)).map(({ i, s }) => {
    const warm = isWarmupRow(s)
    const n = sets.slice(0, i + 1).filter(x => isWarmupRow(x) === warm).length
    return { i, label: warm ? t('Warm-up') + ' ' + n : t('Set {0}', s.side ? Math.ceil(n / 2) : n), note: setNoteOf(s) }
  })
}
