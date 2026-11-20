// The "next time" numbers: what each slot opens at, the trainer default that starts planned
// sessions from the last one, and that reading them never changes the state.
import { describe, expect, it } from 'vitest'
import { applyTrainerDefaults, nextTargetsFor, nextTargetBySlot } from './next-targets.js'
import { buildSessionEntries } from './session-start.js'
import { buildCompletedWorkout } from './finish-workout.js'
import { isWarmupRow } from './workout-model.js'

const BENCH = '0025' // barbell bench press
const clone = v => JSON.parse(JSON.stringify(v))
const state = (routines, extra = {}) => ({ unit: 'kg', exWeights: {}, routines: clone(routines), workouts: [], week: {}, dayPlan: {}, ...extra })
const work = e => e.sets.filter(s => !isWarmupRow(s))

// Logs one session of `rid` with every work set done at `w` x `r`, on 2026-08-<day>.
function logSession(st, rid, w, r, day) {
  const entries = buildSessionEntries({ ...st, active: null }, st.routines.find(x => x.id === rid))
    .map(e => ({ ...e, sets: e.sets.map(s => (isWarmupRow(s) ? { ...s, done: true } : { ...s, w, r, done: true })) }))
  const d = `2026-08-${String(day).padStart(2, '0')}`
  const active = { id: 'w' + day, d, start: day * 1000, routineIds: [rid], name: 'x', entries }
  st.workouts.push(buildCompletedWorkout(active, { end: active.start + 1 }))
}

const routineA = (over = {}) => [{ id: 'A', name: 'Push', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 20, prog: 'off', ...over }] }]

describe('applyTrainerDefaults', () => {
  it('moves a profile once: starts from last, and sets the flag', () => {
    const S = { startFrom: 'plan' }
    expect(applyTrainerDefaults(S)).toBe(true)
    expect(S).toEqual({ startFrom: 'last', trainerDefaultsV1: true, layoutV2: true, workoutView: 'list', gymModeV1: true, gymMode: true, spokenCues: true, autoNextExercise: true, collapseV1: true, collapseCompleted: true })
  })

  it('a second call does nothing, so a later choice of plan is kept', () => {
    const S = { startFrom: 'plan' }
    applyTrainerDefaults(S)
    S.startFrom = 'plan'
    expect(applyTrainerDefaults(S)).toBe(false)
    expect(S.startFrom).toBe('plan')
  })

  it('turns collapse on once, and a later switch-off in Settings is kept', () => {
    const S = { collapseCompleted: false }
    applyTrainerDefaults(S)
    expect(S.collapseCompleted).toBe(true)
    S.collapseCompleted = false
    applyTrainerDefaults(S)
    expect(S.collapseCompleted).toBe(false)
  })

  it('tolerates no state', () => {
    expect(applyTrainerDefaults(null)).toBe(false)
  })
})

describe('applyTrainerDefaults: the List layout (layoutV2)', () => {
  it('moves a profile on Cards to List once, and sets the flag', () => {
    const S = { workoutView: 'cards' }
    expect(applyTrainerDefaults(S)).toBe(true)
    expect(S.workoutView).toBe('list')
    expect(S.layoutV2).toBe(true)
  })

  it('moves a profile with no layout saved to List', () => {
    const S = {}
    applyTrainerDefaults(S)
    expect(S.workoutView).toBe('list')
  })

  it('leaves Focus and Compact alone, but still sets the flag', () => {
    for (const view of ['focus', 'compact']) {
      const S = { workoutView: view }
      expect(applyTrainerDefaults(S)).toBe(true)
      expect(S.workoutView).toBe(view)
      expect(S.layoutV2).toBe(true)
    }
  })

  it('a profile already past the first trainer defaults still gets the layout, and keeps its own start choice', () => {
    const S = { startFrom: 'plan', trainerDefaultsV1: true, workoutView: 'cards' }
    expect(applyTrainerDefaults(S)).toBe(true)
    expect(S.workoutView).toBe('list')
    expect(S.startFrom).toBe('plan')
  })

  it('does it once: a later pick of Cards is kept', () => {
    const S = { workoutView: 'cards' }
    applyTrainerDefaults(S)
    S.workoutView = 'cards'
    expect(applyTrainerDefaults(S)).toBe(false)
    expect(S.workoutView).toBe('cards')
  })
})

describe('a policy-off slot opens at the last session, not the printed weight', () => {
  const trained = (startFrom) => {
    const st = state(routineA(), { startFrom })
    logSession(st, 'A', 50, 8, 1)
    return st
  }
  it('startFrom last: the row opens at 50', () => {
    expect(nextTargetsFor(trained('last'), ['A'])[0].rows[0].weight).toBe(50)
  })
  it('startFrom plan: the row opens at the slot weight 20', () => {
    expect(nextTargetsFor(trained('plan'), ['A'])[0].rows[0].weight).toBe(20)
  })
})

describe('nextTargetsFor', () => {
  it('one row per exercise, with the slot and the line', () => {
    const st = state(routineA(), { startFrom: 'last' })
    const row = nextTargetsFor(st, ['A'])[0].rows[0]
    expect(row).toMatchObject({ exId: BENCH, sets: 3, slot: 0 })
    expect(row.reps).toBeGreaterThan(0)
    expect(row.line).not.toBe('')
  })

  it('a double-progression slot climbs a weight when every set hit the top of the range', () => {
    const routines = [{ id: 'A', name: 'Push', ex: [{ id: BENCH, sets: 3, reps: 10, repsMin: 8, weight: 50, prog: 'double' }] }]
    const st = state(routines, { startFrom: 'last' })
    logSession(st, 'A', 50, 10, 1)
    const w = nextTargetsFor(st, ['A'])[0].rows[0].weight
    expect(w).toBeGreaterThan(50)
  })

  it('a double-progression slot holds the weight when a set missed the top', () => {
    const routines = [{ id: 'A', name: 'Push', ex: [{ id: BENCH, sets: 3, reps: 10, repsMin: 8, weight: 50, prog: 'double' }] }]
    const st = state(routines, { startFrom: 'last' })
    logSession(st, 'A', 50, 8, 1)
    expect(nextTargetsFor(st, ['A'])[0].rows[0].weight).toBe(50)
  })

  it('matches the weight the start flow builds', () => {
    const st = state(routineA(), { startFrom: 'last' })
    logSession(st, 'A', 50, 8, 1)
    const routine = st.routines[0]
    const top = Math.max(...work(buildSessionEntries({ ...st, active: null }, routine)[0]).map(s => Number(s.w) || 0))
    expect(nextTargetsFor(st, ['A'])[0].rows[0].weight).toBe(top)
  })

  it('does not change the state', () => {
    const st = state(routineA(), { startFrom: 'last' })
    logSession(st, 'A', 50, 8, 1)
    const before = JSON.stringify(st)
    nextTargetsFor(st, ['A'])
    nextTargetBySlot(st, 'A')
    expect(JSON.stringify(st)).toBe(before)
  })

  it('an unknown routine id gives nothing, and an empty routine gives no rows', () => {
    const st = state([...routineA(), { id: 'E', name: 'Empty', ex: [] }], { startFrom: 'last' })
    expect(nextTargetsFor(st, ['nope'])).toEqual([])
    expect(nextTargetsFor(st, ['E'])[0].rows).toEqual([])
  })

  it('the same exercise twice gets slot 0 and slot 1', () => {
    const routines = [{ id: 'A', name: 'Push', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 20, prog: 'off' }, { id: BENCH, sets: 2, reps: 5, weight: 30, prog: 'off' }] }]
    const rows = nextTargetsFor(state(routines, { startFrom: 'last' }), ['A'])[0].rows
    expect(rows.map(r => r.slot)).toEqual([0, 1])
  })

  it('nextTargetBySlot keys the rows by slot index', () => {
    const st = state(routineA(), { startFrom: 'last' })
    const map = nextTargetBySlot(st, 'A')
    expect(Object.keys(map)).toEqual(['0'])
    expect(map[0].exId).toBe(BENCH)
  })
})
