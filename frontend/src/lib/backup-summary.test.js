import { describe, expect, it } from 'vitest'
import { summarize, isEmptyCopy, holdsLess } from './backup-summary.js'

describe('summarize', () => {
  it('counts routines and workouts and finds the newest workout day', () => {
    const s = summarize({ routines: [{}, {}], workouts: [{ d: '2026-04-15' }, { d: '2026-11-17' }, { d: '2026-09-01' }] })
    expect(s).toEqual({ routines: 2, workouts: 3, last: '2026-11-17', any: true })
  })
  it('reads an empty or broken profile as nothing', () => {
    expect(summarize({})).toEqual({ routines: 0, workouts: 0, last: '', any: false })
    expect(summarize(null)).toEqual({ routines: 0, workouts: 0, last: '', any: false })
    expect(summarize({ routines: 'x', workouts: { d: '2026-01-01' } })).toMatchObject({ routines: 0, workouts: 0, last: '' })
  })
  it('counts a profile with only body weights as holding something', () => {
    expect(summarize({ bodyweight: [{ d: '2026-01-01', w: 80 }] })).toMatchObject({ routines: 0, workouts: 0, any: true })
  })
})

describe('isEmptyCopy and holdsLess', () => {
  const sum = (routines, workouts) => ({ routines, workouts, last: '', any: routines + workouts > 0 })
  it('an empty copy has neither routines nor workouts', () => {
    expect(isEmptyCopy(sum(0, 0))).toBe(true)
    expect(isEmptyCopy(sum(0, 1))).toBe(false)
    expect(isEmptyCopy(sum(3, 0))).toBe(false)
  })
  it('a copy holds less when it has fewer routines or fewer workouts', () => {
    expect(holdsLess(sum(0, 0), sum(15, 1))).toBe(true)
    expect(holdsLess(sum(15, 0), sum(15, 1))).toBe(true)
    expect(holdsLess(sum(14, 5), sum(15, 1))).toBe(true)
    expect(holdsLess(sum(15, 1), sum(15, 1))).toBe(false)
    expect(holdsLess(sum(16, 9), sum(15, 1))).toBe(false)
  })
})
