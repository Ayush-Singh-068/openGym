// The words on the calm card: the target line ("4 sets · 5–6 reps · 60 kg"), the Last time line and
// the folded "Done · best set 62.5 kg × 6" line.
import { describe, expect, it } from 'vitest'
import { exerciseTargetLine, lastTimeLine, exerciseDoneLine } from './gym-mode.js'

// Strips the invisible direction marks the app puts around numbers, so text can be compared plainly.
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')
const BENCH = '0025'
const HOLD = '0841'
const RUN = '3666'
const row = (w, r = 8, done = false) => ({ w, r, done })
const ex = (id, sets, target = {}) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 8, ...target }, sets })

describe('exerciseTargetLine, in words', () => {
  it('one rep, one set', () => {
    expect(plain(exerciseTargetLine(ex(BENCH, [row(100, 1)], { reps: 1 }), 'kg'))).toBe('1 set · 1 rep · 100 kg')
  })

  it('a hold: sets and seconds', () => {
    const hold = { id: HOLD, target: { mode: 'time', sets: 3, sec: 45 }, sets: [{ sec: 45, w: 0, done: false }, { sec: 45, w: 0, done: false }, { sec: 45, w: 0, done: false }] }
    expect(plain(exerciseTargetLine(hold, 'kg'))).toBe('3 sets · 45 s')
  })

  it('added weight reads as added', () => {
    expect(plain(exerciseTargetLine(ex('0260', [row(10), row(10)], { bodyweight: true }), 'kg'))).toBe('2 sets · 8 reps · +10 kg')
  })

  it('a run keeps the plan\'s own wording', () => {
    const run = { id: RUN, target: { mode: 'cardio', sets: 1, min: 15, speed: 4.5 }, sets: [{ min: 15, speed: 4.5, done: false }] }
    expect(plain(exerciseTargetLine(run, 'kg', 'kmh'))).toContain('1 × 15 min')
  })
})

describe('lastTimeLine', () => {
  const last = (sets, target = { mode: 'reps', reps: 10 }) => ({ d: '2026-11-01', sets, target })

  it('every set of the last session on one line: weight × reps', () => {
    expect(plain(lastTimeLine(BENCH, last([row(120, 10, true), row(120, 10, true), row(120, 9, true)]), 'kmh'))).toBe('Last time: 120 × 10 · 120 × 10 · 120 × 9')
  })

  it('holds read as seconds', () => {
    const l = last([{ sec: 45, w: 0, done: true }, { sec: 40, w: 0, done: true }], { mode: 'time', sets: 2, sec: 45 })
    expect(plain(lastTimeLine(HOLD, l, 'kmh'))).toBe('Last time: 45 s · 40 s')
  })

  it('a set with no weight is its reps; added weight keeps its plus', () => {
    expect(plain(lastTimeLine(BENCH, last([row(0, 12, true), row(0, 10, true)]), 'kmh'))).toBe('Last time: 12 reps · 10 reps')
    expect(plain(lastTimeLine('0260', last([row(10, 8, true)], { mode: 'reps', reps: 8, bodyweight: true }), 'kmh'))).toBe('Last time: +10 × 8')
  })

  it('a per-side set reads its reps per side', () => {
    const side = { w: 20, r: 16, done: true, sides: { L: { w: 20, r: 8, done: true }, R: { w: 20, r: 8, done: true } } }
    expect(plain(lastTimeLine(BENCH, last([side]), 'kmh'))).toBe('Last time: 20 × 8/side')
  })

  it('nothing last time, nothing said', () => {
    expect(lastTimeLine(BENCH, null, 'kmh')).toBe('')
    expect(lastTimeLine(BENCH, last([]), 'kmh')).toBe('')
  })
})

describe('exerciseDoneLine', () => {
  it('names the best set: by weight, then reps', () => {
    const entry = ex(BENCH, [row(60, 8, true), row(62.5, 6, true), row(62.5, 5, true), row(60, 10, true)])
    expect(plain(exerciseDoneLine(entry, 'kg'))).toBe('Done · best set 62.5 kg × 6')
  })

  it('warm-ups and open sets do not count', () => {
    const entry = ex(BENCH, [{ w: 100, r: 5, done: true, phase: 'warmup', warmup: true }, row(60, 8, true), row(80, 8, false)])
    expect(plain(exerciseDoneLine(entry, 'kg'))).toBe('Done · best set 60 kg × 8')
  })

  it('with no weight it is the reps; a hold is its longest time; a run is just Done', () => {
    expect(plain(exerciseDoneLine(ex(BENCH, [row(0, 12, true), row(0, 15, true)]), 'kg'))).toBe('Done · best set 15 reps')
    const hold = { id: HOLD, target: { mode: 'time', sets: 2, sec: 45 }, sets: [{ sec: 45, w: 0, done: true }, { sec: 50, w: 0, done: true }] }
    expect(plain(exerciseDoneLine(hold, 'kg'))).toBe('Done · best set 50 s')
    const run = { id: RUN, target: { mode: 'cardio', sets: 1, min: 15, speed: 4.5 }, sets: [{ min: 15, speed: 4.5, done: true }] }
    expect(exerciseDoneLine(run, 'kg')).toBe('Done')
  })

  it('the unit is the one given', () => {
    expect(plain(exerciseDoneLine(ex(BENCH, [row(135, 5, true)]), 'lb'))).toBe('Done · best set 135 lb × 5')
  })
})
