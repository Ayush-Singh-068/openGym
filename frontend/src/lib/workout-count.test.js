import { afterEach, describe, expect, it } from 'vitest'
import { isNothingLogged, withoutEmptyWorkouts } from './workout-count.js'
import { registerWarmupExercises } from './warmup-exercises.js'

const row = (done, extra = {}) => ({ w: 60, r: 5, done, ...extra })
const workout = (id, entries) => ({ id, d: '2026-11-18', entries })

afterEach(() => registerWarmupExercises({}))

describe('isNothingLogged', () => {
  it('a workout with a done work set is not empty', () => {
    expect(isNothingLogged(workout('a', [{ id: '0025', sets: [row(true)] }]))).toBe(false)
  })
  it('no entries, or only sets that were not done, is nothing logged', () => {
    expect(isNothingLogged(workout('a', []))).toBe(true)
    expect(isNothingLogged(workout('a', [{ id: '0025', sets: [row(false)] }]))).toBe(true)
  })
  it('done warm-ups alone are nothing logged', () => {
    expect(isNothingLogged(workout('a', [{ id: '0025', sets: [row(true, { phase: 'warmup' })] }]))).toBe(true)
  })
  it('the sets of a warm-up exercise do not count', () => {
    registerWarmupExercises({ 1503: true })
    expect(isNothingLogged(workout('a', [{ id: '1503', sets: [row(true)] }]))).toBe(true)
    expect(isNothingLogged(workout('a', [{ id: '1503', sets: [row(true)] }, { id: '0025', sets: [row(true)] }]))).toBe(false)
  })
  it('a record with no entries list is left alone', () => {
    expect(isNothingLogged({ id: 'a', d: '2026-11-18', vol: 4000 })).toBe(false)
    expect(isNothingLogged(null)).toBe(false)
  })
})

describe('withoutEmptyWorkouts', () => {
  it('drops the empty ones and keeps the rest of the state', () => {
    const S = { unit: 'kg', workouts: [workout('a', [{ id: '0025', sets: [row(true)] }]), workout('b', [])] }
    const out = withoutEmptyWorkouts(S)
    expect(out.workouts.map(x => x.id)).toEqual(['a'])
    expect(out.unit).toBe('kg')
  })
  it('is the same object when nothing is empty', () => {
    const S = { workouts: [workout('a', [{ id: '0025', sets: [row(true)] }])] }
    expect(withoutEmptyWorkouts(S)).toBe(S)
  })
})
