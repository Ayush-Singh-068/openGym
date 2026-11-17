// A scheduled deload week with the plan's settings: fewer sets, a lighter weight, no cardio.
// Default settings must leave the deload week exactly as it was.
import { describe, it, expect } from 'vitest'
import { buildSessionEntries } from './session-start.js'
import { isWarmupRow } from './workout-model.js'

const BENCH = '0025'
const CARDIO = '0100'
const work = e => e.sets.filter(s => !isWarmupRow(s))
// The 4th week from 2 Nov 2026 is the deload week: 23 Nov.
const DELOAD_DAY = '2026-11-25'
const cycle = extra => ({ every: 4, from: '2026-11-02', ...extra })
const routine = ex => ({ id: 'r1', name: 'Push', ex })
const bench = extra => ({ id: BENCH, sets: 4, reps: 8, weight: 80, ...extra })
const cardio = { id: CARDIO, mode: 'cardio', min: 15 }

describe('a scheduled deload week with the plan\'s settings', () => {
  it('4 × 8 at 80 kg becomes 2 sets at 40 kg, and the cardio slot is left out', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle({ sets: 2, drop: 50, cardio: 'skip' }) }
    const r = routine([bench(), cardio])
    S.routines = [r]
    const entries = buildSessionEntries(S, r)
    expect(entries.map(e => e.id)).toEqual([BENCH])
    const [e] = entries
    expect(e.plan.kind).toBe('deloadweek')
    expect(e.noProg).toBe(true)
    expect(work(e).map(s => s.w)).toEqual([40, 40])
    expect(work(e).map(s => s.r)).toEqual([8, 8])
  })

  it('with default fields the same week keeps the cardio slot, the sets share and the weight', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle() }
    const r = routine([bench(), cardio])
    S.routines = [r]
    const entries = buildSessionEntries(S, r)
    expect(entries.map(e => e.id)).toEqual([BENCH, CARDIO])
    const [e] = entries
    expect(e.plan.kind).toBe('deloadweek')
    expect(work(e).map(s => s.w)).toEqual([80, 80])
    expect(work(e)).toHaveLength(deloadSetsOf(4))
  })

  it('warm-ups ramp toward the cut weight, not the routine\'s 80 kg', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle({ sets: 2, drop: 50 }) }
    const r = routine([bench({ warmupSets: 2 })])
    S.routines = [r]
    const [e] = buildSessionEntries(S, r)
    const warm = e.sets.filter(isWarmupRow).map(s => s.w)
    expect(warm.length).toBeGreaterThan(0)
    expect(warm.every(w => w < 40)).toBe(true)
    expect(work(e).map(s => s.w)).toEqual([40, 40])
  })

  it('rounds the cut weight down to the exercise\'s step', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle({ sets: 2, drop: 50 }) }
    const r = routine([bench({ weight: 81, inc: 2.5 })])
    S.routines = [r]
    expect(work(buildSessionEntries(S, r)[0]).map(s => s.w)).toEqual([40, 40])
    const db = routine([bench({ weight: 80, inc: 2 })])
    S.routines = [db]
    expect(work(buildSessionEntries({ ...S, routines: [db] }, db)[0]).map(s => s.w)).toEqual([40, 40])
  })

  it('a routine with only cardio keeps it on a deload day, even with cardio skipped', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle({ sets: 2, drop: 50, cardio: 'skip' }) }
    const r = routine([cardio])
    S.routines = [r]
    const entries = buildSessionEntries(S, r)
    expect(entries.map(e => e.id)).toEqual([CARDIO])
  })

  it('names the chosen settings in the why line, and keeps the default line otherwise', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle({ sets: 2, drop: 50, cardio: 'skip' }) }
    const r = routine([bench(), cardio])
    S.routines = [r]
    expect(buildSessionEntries(S, r)[0].plan.why).toEqual(['Deload week: {0} sets per exercise. {1}% lighter weights. No cardio.', 2, 50])
    const plain = { ...S, deloadCycle: cycle() }
    expect(buildSessionEntries(plain, { ...r })[0].plan.why).toEqual(['Deload week: {0} of {1} sets, same weight. Lighter on purpose.', 2, 4])
  })

  it('a timed hold trains 2 sets with sets 2, and the default keeps its sets', () => {
    const plank = { id: '0300', mode: 'time', sets: 3, sec: 30 }
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: DELOAD_DAY }, deloadCycle: cycle({ sets: 2 }) }
    const r = routine([plank])
    S.routines = [r]
    const [e] = buildSessionEntries(S, r)
    expect(work(e)).toHaveLength(2)
    expect(work(e).every(s => s.sec === 30)).toBe(true)
    const d = { ...S, deloadCycle: cycle() }
    expect(work(buildSessionEntries(d, { ...r, ex: [plank] })[0])).toHaveLength(3)   // a timed hold keeps its sets by default
  })

  it('a normal week ignores the deload settings', () => {
    const S = { weekStart: 1, unit: 'kg', workouts: [], routines: [], exWeights: {}, active: { d: '2026-11-18' }, deloadCycle: cycle({ sets: 2, drop: 50, cardio: 'skip' }) }
    const r = routine([bench(), cardio])
    S.routines = [r]
    const entries = buildSessionEntries(S, r)
    expect(entries.map(e => e.id)).toEqual([BENCH, CARDIO])
    expect(entries[0].plan?.kind).not.toBe('deloadweek')
    expect(work(entries[0])).toHaveLength(4)
    expect(work(entries[0]).every(s => s.w === 80)).toBe(true)
  })
})

// 4 sets scaled by the usual 60 % share, as deloadSets gives it.
const deloadSetsOf = n => Math.max(1, Math.round(n * 0.6))
