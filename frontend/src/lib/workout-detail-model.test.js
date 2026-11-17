// The saved workout sheet's numbers: set rows, card stats, "vs last time" and the whole model.
import { describe, expect, it } from 'vitest'
import { headerOf, setRows, entryStats, compareToLast, buildDetailModel } from './workout-detail-model.js'

// A profile with nothing in it but what the functions read; workouts are added per test.
const S = (workouts = [], extra = {}) => ({ workouts, unit: 'kg', routines: [], ...extra })
const at = iso => new Date(iso + 'T18:00:00').getTime()
// A saved workout on `iso`, one hour long, with the given entries.
const workout = (id, iso, entries, extra = {}) => ({
  id, d: iso, name: 'Push', start: at(iso), end: at(iso) + 3600000, entries, ...extra,
})
const bench = (sets, extra = {}) => ({ id: '0025', sets, ...extra })

describe('setRows', () => {
  it('dims warm-ups and numbers them apart from the work sets', () => {
    const w = workout('a', '2026-10-01', [bench([
      { w: 20, r: 10, done: true, phase: 'warmup' },
      { w: 60, r: 8, done: true },
      { w: 60, r: 8, done: true },
    ])])
    const rows = setRows(S([w]), w, w.entries[0], { trends: false })
    expect(rows.map(r => [r.warm, r.n])).toEqual([[true, 1], [false, 1], [false, 2]])
  })

  it('drops rows that were not done', () => {
    const w = workout('a', '2026-10-01', [bench([
      { w: 60, r: 8, done: true },
      { w: 60, r: 8, done: false },
    ])])
    const rows = setRows(S([w]), w, w.entries[0], { trends: false })
    expect(rows.length).toBe(1)
    expect(rows[0].j).toBe(0)
  })

  it('reads the effort from rir and from rpe, and keeps it out of the label', () => {
    const w = workout('a', '2026-10-01', [bench([
      { w: 60, r: 8, done: true, rir: 2 },
      { w: 60, r: 8, done: true, rpe: 8 },
    ])])
    const rows = setRows(S([w], { effort: 'rir' }), w, w.entries[0], { trends: false })
    expect(rows[0].effort).toEqual({ kind: 'rir', value: 2 })
    expect(rows[1].effort).toEqual({ kind: 'rir', value: 2 })
    expect(rows.every(r => !r.label.includes('(RIR'))).toBe(true)
    expect(rows.every(r => !r.label.includes('(RPE'))).toBe(true)
  })
})

describe('entryStats', () => {
  it('counts volume without the warm-ups', () => {
    const entry = bench([
      { w: 20, r: 10, done: true, phase: 'warmup' },
      { w: 100, r: 5, done: true },
    ])
    const stats = entryStats(S(), entry)
    expect(stats.volume).toBe(500)
    expect(stats.workSets).toBe(1)
  })

  it('estimates the 1RM of 100 x 5 with Epley', () => {
    const stats = entryStats(S(), bench([{ w: 100, r: 5, done: true }]))
    expect(stats.e1rm.est).toBeCloseTo(116.7, 1)
    expect(stats.formulaName).toBe('Epley')
  })

  it('has no 1RM for a hold or an assisted machine', () => {
    const hold = { id: '0025', target: { mode: 'time' }, sets: [{ sec: 60, done: true }] }
    const assisted = { id: '0025', target: { assisted: true }, sets: [{ w: 30, r: 8, done: true }] }
    expect(entryStats(S(), hold).e1rm).toBeNull()
    expect(entryStats(S(), assisted).e1rm).toBeNull()
  })
})

describe('compareToLast', () => {
  it('is null with no earlier workout', () => {
    const w = workout('a', '2026-10-01', [bench([{ w: 100, r: 5, done: true }])])
    expect(compareToLast(S([w]), w, w.entries[0])).toBeNull()
  })

  it('reads +5 kg on the top set with more volume as an improvement', () => {
    const before = workout('a', '2026-10-01', [bench([{ w: 100, r: 5, done: true }])])
    const now = workout('b', '2026-10-08', [bench([{ w: 105, r: 5, done: true }])])
    const cmp = compareToLast(S([before, now]), now, now.entries[0])
    expect(cmp.lastDay).toBe('2026-10-01')
    expect(cmp.bestDelta).toBe(5)
    expect(cmp.repsDelta).toBe(0)
    expect(cmp.volDelta).toBe(25)
    expect(cmp.volPct).toBe(5)
    expect(cmp.dir).toBe(1)
  })

  it('ignores a workout dated after this one', () => {
    const before = workout('a', '2026-10-01', [bench([{ w: 100, r: 5, done: true }])])
    const now = workout('b', '2026-10-08', [bench([{ w: 100, r: 5, done: true }])])
    const later = workout('c', '2026-10-15', [bench([{ w: 200, r: 1, done: true }])])
    const cmp = compareToLast(S([before, now, later]), now, now.entries[0])
    expect(cmp.bestDelta).toBe(0)
    expect(cmp.dir).toBe(0)
  })

  it('reads a hold by its time', () => {
    const plank = (sec) => ({ id: '0025', target: { mode: 'time' }, sets: [{ sec, done: true }] })
    const before = workout('a', '2026-10-01', [plank(60)])
    const now = workout('b', '2026-10-08', [plank(90)])
    const cmp = compareToLast(S([before, now]), now, now.entries[0])
    expect(cmp).toEqual({ lastDay: '2026-10-01', secDelta: 30, dir: 1 })
  })

  it('is null for cardio', () => {
    const run = (min) => ({ id: '0025', target: { mode: 'cardio' }, sets: [{ min, speed: 8, done: true }] })
    const before = workout('a', '2026-10-01', [run(20)])
    const now = workout('b', '2026-10-08', [run(25)])
    expect(compareToLast(S([before, now]), now, now.entries[0])).toBeNull()
  })
})

describe('buildDetailModel', () => {
  it('groups a combined session by routine and counts the PRs', () => {
    const w = workout('a', '2026-10-01', [
      { ...bench([{ w: 100, r: 5, done: true }]), rid: 'r1' },
      { id: '0043', sets: [{ w: 40, r: 10, done: true }], rid: 'r2' },
    ], { routineIds: ['r1', 'r2'], prs: ['0025'] })
    const routines = [{ id: 'r1', name: 'Push', emoji: '' }, { id: 'r2', name: 'Pull', emoji: '' }]
    const model = buildDetailModel(S([w], { routines }), w)
    expect(model.grouped).toBe(true)
    expect(model.sections.map(s => s.name)).toEqual(['Push', 'Pull'])
    expect(model.header.prCount).toBe(1)
    expect(Object.keys(model.cards)).toEqual(['0', '1'])
    expect(model.cards[0].pr).toBe(true)
    expect(model.cards[1].pr).toBe(false)
  })

  it('does not group a single-routine workout', () => {
    const w = workout('a', '2026-10-01', [bench([{ w: 100, r: 5, done: true }])], { routineIds: ['r1'] })
    const model = buildDetailModel(S([w]), w)
    expect(model.grouped).toBe(false)
    expect(model.sections.length).toBe(1)
  })
})

describe('headerOf', () => {
  it('reads the routine, the day and the duration', () => {
    const w = workout('a', '2026-10-01', [bench([{ w: 100, r: 5, done: true }])], { routineIds: ['r1'] })
    const h = headerOf(S([w]), w)
    expect(h.routineId).toBe('r1')
    expect(h.dateISO).toBe('2026-10-01')
    expect(h.durationMs).toBe(3600000)
    expect(h.volume).toBe(500)
    expect(h.workSets).toBe(1)
  })
})
