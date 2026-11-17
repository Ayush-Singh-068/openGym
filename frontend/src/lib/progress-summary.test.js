// The Progress card's numbers: the month against the plan, the lifts over four weeks, and body
// weight week on week. The clock is fixed at Wednesday 16 September 2026.
import { describe, expect, it } from 'vitest'
import { progressSummary } from './progress-summary.js'
import { addDaysKey, daysBetween } from './day-status.js'

const TODAY = new Date(2026, 8, 16, 12)
const BENCH = '0025'
const SQUAT = '0081'
const clone = v => JSON.parse(JSON.stringify(v))
const workout = (id, d, w, r = 8, ex = BENCH) => ({
  id, d, routineIds: ['A'],
  entries: [{ id: ex, target: { id: ex, sets: 3, reps: r }, sets: [1, 2, 3].map(() => ({ w, r, done: true })) }],
})
const base = (over = {}) => ({
  unit: 'kg', routines: [{ id: 'A', name: 'Push', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 50, prog: 'off' }] }],
  week: { 1: ['A'], 3: ['A'], 5: ['A'] }, dayPlan: {}, dayNotes: {}, workouts: [], bodyweight: [],
  ...over,
})

describe('progressSummary: this month', () => {
  it('counts done, skipped, missed, and what is still to come, against the plan', () => {
    const S = base({
      workouts: [workout('w1', '2026-09-02', 50), workout('w2', '2026-09-04', 50)],
      dayNotes: { '2026-09-07': { tag: 'travel', _ts: 1 } },
    })
    // First workout is 2 Sep, so 9, 11 and 14 are missed; 7 Sep is a skip.
    const p = progressSummary(S, TODAY)
    expect(p.month.done).toBe(2)
    expect(p.month.skipped).toBe(1)
    expect(p.month.missed).toBe(3)
    // Today (Wed 16) plus the Fridays and Mondays and Wednesdays still ahead in September.
    const ahead = daysBetween('2026-09-16', '2026-09-30').filter(k => [1, 3, 5].includes(new Date(k + 'T12:00:00').getDay()))
    expect(p.month.remaining).toBe(ahead.length)
    expect(p.month.planned).toBe(p.month.done + p.month.missed + p.month.remaining)
  })
})

describe('progressSummary: lifts', () => {
  it('an exercise that rose over the window has a positive delta, and ranks ahead of one trained once', () => {
    const S = base({
      workouts: [
        workout('old', '2026-08-05', 45),
        workout('a', '2026-09-01', 50),
        workout('b', '2026-09-07', 52.5),
        workout('c', '2026-09-14', 55),
        workout('once', '2026-09-10', 30, 8, SQUAT),
      ],
    })
    const p = progressSummary(S, TODAY)
    expect(p.lifts[0].id).toBe(BENCH)
    expect(p.lifts[0].delta).toBeGreaterThan(0)
    expect(p.lifts[0].pct).toBeGreaterThan(0)
    expect(p.lifts.length).toBeLessThanOrEqual(3)
  })

  it('at most three lifts, and an exercise with no history is absent', () => {
    const ids = ['0025', '0081', '0097', '0117']
    const S = base({ workouts: ids.map((id, i) => workout('w' + i, addDaysKey('2026-09-01', i), 40, 8, id)) })
    const p = progressSummary(S, TODAY)
    expect(p.lifts).toHaveLength(3)
    expect(p.lifts.map(l => l.id)).not.toContain('9999')
  })

  it('with a single session in the window there is no baseline, so delta is null', () => {
    const S = base({ workouts: [workout('a', '2026-09-10', 50)] })
    const p = progressSummary(S, TODAY)
    expect(p.lifts[0].delta).toBeNull()
    expect(p.lifts[0].pct).toBeNull()
  })
})

describe('progressSummary: body weight', () => {
  it('averages the last seven days and compares with the week before', () => {
    const S = base({
      bodyweight: [
        { d: '2026-09-16', w: 80 }, { d: '2026-09-12', w: 82 },
        { d: '2026-09-08', w: 84 }, { d: '2026-09-02', w: 90 },
      ],
    })
    const p = progressSummary(S, TODAY)
    expect(p.weight.n).toBe(2)
    expect(p.weight.avg).toBe(81)
    expect(p.weight.prevAvg).toBe(84)
    expect(p.weight.delta).toBe(-3)
  })

  it('no entries in the last seven days gives weight null', () => {
    const S = base({ bodyweight: [{ d: '2026-09-01', w: 80 }] })
    expect(progressSummary(S, TODAY).weight).toBeNull()
  })
})

describe('progressSummary: empty and pure', () => {
  it('an empty profile is empty, with no lifts', () => {
    const p = progressSummary(base(), TODAY)
    expect(p.empty).toBe(true)
    expect(p.lifts).toEqual([])
  })

  it('does not change the state', () => {
    const S = base({ workouts: [workout('a', '2026-09-10', 50)], bodyweight: [{ d: '2026-09-15', w: 80 }] })
    const before = JSON.stringify(S)
    progressSummary(S, TODAY)
    expect(JSON.stringify(S)).toBe(before)
    expect(clone(S)).toEqual(S)
  })
})
