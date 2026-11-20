// Gym mode, the pure side (lib/gym-mode.js): which parts are on, which set comes next, the line the
// rest bar shows, which sets "Complete as planned" ticks, and the one-time move of older profiles.
import { describe, expect, it } from 'vitest'
import { gymOn, gymOpt, nextSetPos, nextUpText, nextUpFor, asPlannedRows } from './gym-mode.js'
import { nextKindOf } from './cue-sounds.js'
import { applyTrainerDefaults } from './next-targets.js'
import { EXIDX } from './exercises.js'
import { exerciseNameFor } from './i18n-core.js'

// Strips the invisible direction marks the app puts around numbers, so text can be compared plainly.
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')

const row = (w, r, done = false) => ({ w, r, done })
const ex = (id, n, sets, target = {}, extra = {}) => ({ id, n, target: { mode: 'reps', sets: sets.length, reps: 8, ...target }, sets, ...extra })
const text = (entries, i, k, unit = 'kg') => plain(nextUpText(entries, i, k, unit))

describe('gymOn and gymOpt', () => {
  it('Gym mode is on only when S.gymMode is true', () => {
    expect(gymOn({ gymMode: true })).toBe(true)
    expect(gymOn({ gymMode: false })).toBe(false)
    expect(gymOn({})).toBe(false)
    expect(gymOn(null)).toBe(false)
  })

  it('a part is on with the master switch on, unless its own switch is false; a missing key means on', () => {
    expect(gymOpt({ gymMode: true }, 'big')).toBe(true)
    expect(gymOpt({ gymMode: true, gymOpts: {} }, 'next')).toBe(true)
    expect(gymOpt({ gymMode: true, gymOpts: { big: false } }, 'big')).toBe(false)
    expect(gymOpt({ gymMode: true, gymOpts: { big: false } }, 'next')).toBe(true)
    expect(gymOpt({ gymMode: false, gymOpts: { big: true } }, 'big')).toBe(false)
  })
})

describe('nextUpText', () => {
  it('the next set of the same exercise: its number, weight and reps', () => {
    const entries = [ex('x1', 'Bench Press', [row(80, 8, true), row(80, 8), row(80, 8)])]
    expect(text(entries, 0, 0)).toBe('Next: set 2 · 80 kg × 8')
  })

  it('marks the last work set of the exercise', () => {
    const entries = [ex('x1', 'Bench Press', [row(80, 8, true), row(80, 8, true), row(82.5, 6)])]
    expect(text(entries, 0, 1)).toBe('Next: set 3 · 82.5 kg × 6 · Last set')
  })

  it('counts the set just ticked as done even when the entries still show it open', () => {
    const entries = [ex('x1', 'Bench Press', [row(80, 8), row(80, 8)])]
    expect(text(entries, 0, 0)).toBe('Next: set 2 · 80 kg × 8 · Last set')
  })

  it('says nothing when nothing is left', () => {
    const entries = [ex('x1', 'Bench Press', [row(80, 8, true), row(80, 8, true), row(80, 8)])]
    expect(nextUpText(entries, 0, 2)).toBe('')
  })

  it('a different exercise: its name and its plan', () => {
    const entries = [
      ex('x1', 'Bench Press', [row(80, 8, true)]),
      ex('x2', 'Cable Fly', [row(20, 12), row(20, 12), row(20, 12)], { reps: 15, repsMin: 12 }),
    ]
    expect(text(entries, 0, 0)).toBe('Next: Cable Fly · 3 × 12–15')
  })

  it('the other exercise of a superset: its name and the set itself', () => {
    const entries = [
      ex('x1', 'Curl', [row(12, 10), row(12, 10)], {}, { sg: 's1' }),
      ex('x2', 'Pushdown', [row(25, 12), row(25, 12)], {}, { sg: 's1' }),
    ]
    expect(text(entries, 0, 0)).toBe('Next: Pushdown · 25 kg × 12')
    // Both first sets ticked: back round to the first exercise for its second set, its last.
    entries[0].sets[0].done = true
    entries[1].sets[0].done = true
    expect(text(entries, 1, 0)).toBe('Next: Curl · 12 kg × 10 · Last set')
  })

  it('a bodyweight set has reps only', () => {
    const entries = [ex('x1', 'Push-Up', [row(0, 15, true), row(0, 15)])]
    expect(text(entries, 0, 0)).toBe('Next: set 2 · 15 reps · Last set')
  })

  it('a timed hold says its seconds, with the load when there is one', () => {
    const hold = (w, done = false) => ({ sec: 45, w, done })
    const entries = [ex('x1', 'Plank', [hold(0, true), hold(0)], { mode: 'time', sec: 45 })]
    expect(text(entries, 0, 0)).toBe('Next: set 2 · 45 seconds · Last set')
    const loaded = [ex('x1', 'Plank', [hold(10, true), hold(10)], { mode: 'time', sec: 45 })]
    expect(text(loaded, 0, 0)).toBe('Next: set 2 · 45 seconds · 10 kg · Last set')
  })

  it('reads the weight in the unit it is given', () => {
    const entries = [ex('x1', 'Bench Press', [row(175, 5, true), row(175, 5)])]
    expect(text(entries, 0, 0, 'lb')).toBe('Next: set 2 · 175 lb × 5 · Last set')
  })

  it('a warm-up rung is called a warm-up, and the work sets are counted apart from it', () => {
    const warm = (w, r, done = false) => ({ w, r, done, phase: 'warmup', warmup: true })
    const entries = [ex('x1', 'Bench Press', [warm(20, 10, true), warm(40, 5), row(60, 8), row(60, 8)])]
    expect(text(entries, 0, 0)).toBe('Next: Warm-up · 40 kg × 5')
    entries[0].sets[1].done = true
    expect(text(entries, 0, 1)).toBe('Next: set 1 · 60 kg × 8')
  })

  it('a per-side set says its reps per side', () => {
    const sided = (w, r) => ({ w, r: r * 2, done: false, sides: { L: { w, r, done: false }, R: { w, r, done: false } } })
    const entries = [ex('x1', 'Split Squat', [row(16, 8, true), sided(16, 8)])]
    expect(text(entries, 0, 0)).toBe('Next: set 2 · 16 kg × 8/side · Last set')
  })

  it('wraps to an earlier exercise that still has a set', () => {
    const entries = [ex('x1', 'Bench Press', [row(80, 8)]), ex('x2', 'Row', [row(60, 8, true)])]
    expect(text(entries, 1, 0)).toBe('Next: Bench Press · 1 × 8')
  })

  it('is not usable input: an empty string, no throw', () => {
    expect(nextUpText(null, 0, 0)).toBe('')
    expect(nextUpText([], 0, 0)).toBe('')
    expect(nextUpText([ex('x1', 'A', [row(1, 1)])], 5, 0)).toBe('')
  })
})

describe('nextSetPos agrees with the cue sounds', () => {
  const cases = {
    'same exercise': [ex('x1', 'A', [row(1, 1), row(1, 1), row(1, 1)])],
    'last set': [ex('x1', 'A', [row(1, 1, true), row(1, 1), row(1, 1)])],
    'other exercise': [ex('x1', 'A', [row(1, 1)]), ex('x2', 'B', [row(1, 1), row(1, 1)])],
    superset: [ex('x1', 'A', [row(1, 1), row(1, 1)], {}, { sg: 's' }), ex('x2', 'B', [row(1, 1), row(1, 1)], {}, { sg: 's' })],
  }
  for (const [name, entries] of Object.entries(cases)) it(name, () => {
    const next = nextSetPos(entries, 0, 0)
    const kind = nextKindOf(entries, 0, 0)
    expect(next).not.toBeNull()
    if (kind === 'exercise') expect(next.idx !== 0 && !next.inSuperset).toBe(true)
    if (kind === 'set' || kind === 'last') expect(next.idx).toBe(0)
    if (kind === 'superset') expect(next.inSuperset && next.idx !== 0).toBe(true)
  })
})

describe('nextUpFor', () => {
  const entries = () => [ex('0025', '', [row(80, 8, true), row(80, 8)]), ex('3905', '', [row(0, 10), row(0, 10)])]
  const S = over => ({ unit: 'kg', gymMode: true, active: { entries: entries() }, ...over })

  it('is the same line, in the profile unit, with the exercise names the app shows', () => {
    expect(plain(nextUpFor(S(), 0, 0))).toBe('Next: set 2 · 80 kg × 8 · Last set')
    S().active.entries[0].sets[1].done = true
    const done = S()
    done.active.entries[0].sets[1].done = true
    expect(plain(nextUpFor(done, 0, 1))).toContain(exerciseNameFor(EXIDX['3905']))
    expect(plain(nextUpFor(S({ unit: 'lb' }), 0, 0))).toContain('80 lb')
  })

  it('is empty with Gym mode off, with Show what’s next off, and with nothing running', () => {
    expect(nextUpFor(S({ gymMode: false }), 0, 0)).toBe('')
    expect(nextUpFor(S({ gymOpts: { next: false } }), 0, 0)).toBe('')
    expect(nextUpFor({ gymMode: true, active: null }, 0, 0)).toBe('')
  })
})

describe('asPlannedRows', () => {
  it('the open working sets: not done, not warm-ups, not per-side rows', () => {
    const entry = ex('x1', 'A', [
      { w: 20, r: 10, done: false, phase: 'warmup', warmup: true },
      row(60, 8, true),
      row(60, 8),
      { w: 0, sec: 30, done: false, side: 'L' },
      { w: 16, r: 16, done: false, sides: { L: { w: 16, r: 8, done: false }, R: { w: 16, r: 8, done: false } } },
      row(60, 8),
    ])
    expect(asPlannedRows(entry)).toEqual([2, 5])
  })

  it('nothing for no entry, or an exercise with everything done', () => {
    expect(asPlannedRows(null)).toEqual([])
    expect(asPlannedRows(ex('x1', 'A', [row(1, 1, true)]))).toEqual([])
  })
})

describe('applyTrainerDefaults: Gym mode (gymModeV1)', () => {
  it('turns Gym mode, spoken cues and the next exercise on, once', () => {
    const S = { gymMode: false, spokenCues: false, autoNextExercise: false }
    expect(applyTrainerDefaults(S)).toBe(true)
    expect(S).toMatchObject({ gymModeV1: true, gymMode: true, spokenCues: true, autoNextExercise: true })
  })

  it('a profile already moved keeps a later switch-off', () => {
    const S = { trainerDefaultsV1: true, layoutV2: true, gymModeV1: true, collapseV1: true, gymMode: false, spokenCues: false, autoNextExercise: false }
    expect(applyTrainerDefaults(S)).toBe(false)
    expect(S).toMatchObject({ gymMode: false, spokenCues: false, autoNextExercise: false })
  })

  it('a profile moved by an earlier version still gets Gym mode', () => {
    const S = { trainerDefaultsV1: true, layoutV2: true, workoutView: 'compact' }
    expect(applyTrainerDefaults(S)).toBe(true)
    expect(S.gymMode).toBe(true)
    expect(S.workoutView).toBe('compact')
  })
})
