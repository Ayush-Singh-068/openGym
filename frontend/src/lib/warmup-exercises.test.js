import { afterEach, describe, expect, it } from 'vitest'
import { registerWarmupExercises, isWarmupExercise, isWarmupExerciseIn, withWarmupExercise } from './warmup-exercises.js'
import { workoutVolume, workSetsDone } from './history.js'
import { exerciseHistory } from './exercise-history.js'
import { loadOfWorkouts } from './muscles.js'
import { sessionPrs } from './finish-workout.js'

const BAND = '1503' // Band Pull-Apart
const BENCH = '0025'
const done = (w, r) => ({ w, r, done: true })
const entry = (id, sets) => ({ id, target: { mode: 'reps' }, sets })
const workout = (id, entries) => ({ id, d: '2026-11-18', start: 1, end: 2, entries })

afterEach(() => registerWarmupExercises({}))

describe('the registry', () => {
  it('knows only the exercises marked true', () => {
    registerWarmupExercises({ [BAND]: true, [BENCH]: false })
    expect(isWarmupExercise(BAND)).toBe(true)
    expect(isWarmupExercise(BENCH)).toBe(false)
    expect(isWarmupExercise(undefined)).toBe(false)
  })
  it('a missing or odd map marks nothing', () => {
    registerWarmupExercises(undefined)
    expect(isWarmupExercise(BAND)).toBe(false)
    registerWarmupExercises([BAND])
    expect(isWarmupExercise(BAND)).toBe(false)
  })
  it('reads a state object, and switches one exercise on and off', () => {
    expect(isWarmupExerciseIn({ exWarmup: { [BAND]: true } }, BAND)).toBe(true)
    expect(isWarmupExerciseIn({}, BAND)).toBe(false)
    const on = withWarmupExercise(undefined, BAND, true)
    expect(on).toEqual({ [BAND]: true })
    expect(withWarmupExercise(on, BAND, false)).toEqual({})
  })
})

describe('what a warm-up exercise leaves out', () => {
  it('volume and work sets', () => {
    const mixed = workout('w1', [entry(BAND, [done(20, 15), done(20, 15)]), entry(BENCH, [done(100, 5), done(100, 5)])])
    expect(workoutVolume(mixed)).toBe(600 + 1000)
    expect(workSetsDone(mixed)).toBe(4)
    registerWarmupExercises({ [BAND]: true })
    expect(workoutVolume(mixed)).toBe(1000)
    expect(workSetsDone(mixed)).toBe(2)
  })
  it('its history sheet has no sessions, so no records', () => {
    const S = { workouts: [workout('w1', [entry(BAND, [done(10, 20)])])] }
    expect(exerciseHistory(S, BAND).total).toBe(1)
    registerWarmupExercises({ [BAND]: true })
    expect(exerciseHistory(S, BAND)).toMatchObject({ total: 0, best: 0, sessions: [], points: [] })
  })
  it('the muscle load', () => {
    const w = workout('w1', [entry(BAND, [done(0, 15), done(0, 15)])])
    expect(Object.keys(loadOfWorkouts([w])).length).toBeGreaterThan(0)
    registerWarmupExercises({ [BAND]: true })
    expect(loadOfWorkouts([w])).toEqual({})
  })
  it('a personal record at the end of the workout', () => {
    const entries = [entry(BAND, [done(10, 10)]), entry(BENCH, [done(60, 5)])]
    expect(sessionPrs({ workouts: [] }, entries).prs).toEqual([BAND, BENCH])
    registerWarmupExercises({ [BAND]: true })
    expect(sessionPrs({ workouts: [] }, entries).prs).toEqual([BENCH])
  })
})
