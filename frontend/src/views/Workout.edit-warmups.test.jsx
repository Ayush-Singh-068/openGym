// @vitest-environment happy-dom
// Q12: editing a saved workout used to re-aim its warm-ups at a corrected work weight, the way a
// running workout does. In a saved workout every row is history: the warm-ups stay as they were.
import { describe, expect, it, vi } from 'vitest'
import { DEF } from '../store/useStore.js'
import { rerampOpen } from './Workout.jsx'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})), appBase: () => '/' }))

const entry = () => ({
  id: '0025', target: { mode: 'reps', reps: 8, weight: 62.5 },
  sets: [
    { w: 20, r: 10, done: false, phase: 'warmup', warmup: true },
    { w: 62.5, r: 8, done: true },
    { w: 60, r: 8, done: true },
  ],
})
const stateWith = active => ({ ...structuredClone(DEF), unit: 'kg', active })

describe('re-aiming warm-ups after a work weight changed', () => {
  it('a running workout re-aims the warm-ups that are not ticked yet', () => {
    const e = entry()
    rerampOpen(stateWith({ id: 'live', entries: [e] }), e, 1)
    expect(e.sets[0].w).not.toBe(20)
    expect(e.sets).toHaveLength(3)
  })

  it('an edit of a saved workout leaves every warm-up exactly as it was saved', () => {
    const e = entry()
    rerampOpen(stateWith({ id: 'saved', editingWorkoutId: 'saved', entries: [e] }), e, 1)
    expect(e.sets[0]).toEqual({ w: 20, r: 10, done: false, phase: 'warmup', warmup: true })
    expect(e.sets).toHaveLength(3)
  })
})
