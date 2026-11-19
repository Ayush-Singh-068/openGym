// The calm List card, the pure side (lib/gym-mode.js): the line under the exercise's name, and
// whether "Complete as planned" has to ask for a working weight first, and what it fills in.
import { describe, expect, it } from 'vitest'
import { exerciseTargetLine, needsWorkingWeight, withWorkingWeight } from './gym-mode.js'
import { WEIGHT_ORIGIN_MANUAL } from './workout-model.js'

// Strips the invisible direction marks the app puts around numbers, so text can be compared plainly.
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')

const row = (w, r = 8, done = false) => ({ w, r, done })
const ex = (id, sets, target = {}) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 8, ...target }, sets })
const BENCH = '0025'

describe('exerciseTargetLine', () => {
  it('sets, reps and the working weight in words: "4 sets · 8 reps · 60 kg"', () => {
    expect(plain(exerciseTargetLine(ex(BENCH, [row(60), row(60), row(60), row(60)]), 'kg'))).toBe('4 sets · 8 reps · 60 kg')
  })

  it('a rep range reads as a range: "4 sets · 5–6 reps · 60 kg"', () => {
    const entry = ex(BENCH, [row(60, 6), row(60, 6), row(60, 6), row(60, 6)], { reps: 6, repsMin: 5 })
    expect(plain(exerciseTargetLine(entry, 'kg'))).toBe('4 sets · 5–6 reps · 60 kg')
  })

  it('leaves the weight out while it is 0', () => {
    expect(plain(exerciseTargetLine(ex(BENCH, [row(0), row(0), row(0)]), 'kg'))).toBe('3 sets · 8 reps')
  })

  it('the unit is the one given', () => {
    expect(plain(exerciseTargetLine(ex(BENCH, [row(135), row(135)]), 'lb'))).toBe('2 sets · 8 reps · 135 lb')
  })

  it('the weight is the first work set, not a warm-up', () => {
    const entry = ex(BENCH, [{ w: 20, r: 10, done: false, phase: 'warmup', warmup: true }, row(80), row(80)])
    expect(plain(exerciseTargetLine(entry, 'kg'))).toBe('2 sets · 8 reps · 80 kg')
  })

  it('the count follows the rows: a set added by hand reads as one more', () => {
    expect(plain(exerciseTargetLine(ex(BENCH, [row(60), row(60), row(60)], { sets: 2 }), 'kg'))).toBe('3 sets · 8 reps · 60 kg')
  })

  it('a hold reads its seconds, a run its minutes', () => {
    expect(plain(exerciseTargetLine({ id: '0841', target: { mode: 'time', sets: 2, sec: 45 }, sets: [{ sec: 45, w: 0, done: false }, { sec: 45, w: 0, done: false }] }, 'kg'))).toBe('2 sets · 45 s')
    expect(plain(exerciseTargetLine({ id: '3666', target: { mode: 'cardio', sets: 1, min: 15, speed: 4.5 }, sets: [{ min: 15, speed: 4.5, done: false }] }, 'kg', 'kmh'))).toContain('1 × 15 min')
  })

  it('says nothing for no entry', () => {
    expect(exerciseTargetLine(null)).toBe('')
  })
})

describe('needsWorkingWeight', () => {
  it('a weighted rep exercise with an open work set at 0 asks', () => {
    expect(needsWorkingWeight(ex(BENCH, [row(0), row(0)]))).toBe(true)
    expect(needsWorkingWeight(ex(BENCH, [row(60, 8, true), row(0)]))).toBe(true)
  })

  it('does not ask once the open sets have a weight, or when nothing is open', () => {
    expect(needsWorkingWeight(ex(BENCH, [row(60), row(60)]))).toBe(false)
    expect(needsWorkingWeight(ex(BENCH, [row(0, 8, true), row(0, 8, true)]))).toBe(false)
  })

  it('a warm-up at 0 does not make it ask', () => {
    expect(needsWorkingWeight(ex(BENCH, [{ w: 0, r: 10, done: false, phase: 'warmup', warmup: true }, row(60)]))).toBe(false)
  })

  it('body weight, a hold and a run are never asked', () => {
    expect(needsWorkingWeight(ex(BENCH, [row(0), row(0)], { bodyweight: true }))).toBe(false)
    expect(needsWorkingWeight({ id: '0841', target: { mode: 'time', sets: 1, sec: 30 }, sets: [{ sec: 30, w: 0, done: false }] })).toBe(false)
    expect(needsWorkingWeight({ id: '3666', target: { mode: 'cardio', sets: 1, min: 15 }, sets: [{ min: 15, speed: 4.5, done: false }] })).toBe(false)
  })

  it('no entry, no question', () => {
    expect(needsWorkingWeight(null)).toBe(false)
  })
})

describe('withWorkingWeight', () => {
  it('puts the weight on every open work set at 0, and marks the first as typed', () => {
    const entry = ex(BENCH, [row(0), row(0), row(0)])
    const sets = withWorkingWeight(entry, 60)
    expect(sets.map(s => s.w)).toEqual([60, 60, 60])
    expect(sets[0].weightOrigin).toBe(WEIGHT_ORIGIN_MANUAL)
    expect(sets[1].weightOrigin).toBeUndefined()
    expect(sets.map(s => s.r)).toEqual([8, 8, 8])
  })

  it('leaves ticked sets, warm-ups and sets that have a weight as they are', () => {
    const warm = { w: 0, r: 10, done: false, phase: 'warmup', warmup: true }
    const entry = ex(BENCH, [warm, row(50, 8, true), row(70), row(0)])
    const sets = withWorkingWeight(entry, 60)
    expect(sets.map(s => s.w)).toEqual([0, 50, 70, 60])
    expect(sets[0]).toBe(warm)
  })

  it('does not change the entry it was given', () => {
    const entry = ex(BENCH, [row(0), row(0)])
    withWorkingWeight(entry, 60)
    expect(entry.sets.map(s => s.w)).toEqual([0, 0])
  })
})
