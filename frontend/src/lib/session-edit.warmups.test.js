import { describe, expect, it } from 'vitest'
import { editCompletedSession, saveWorkoutEdit, diffWorkoutEdit } from './session-edit.js'
import { isWarmupRow } from './workout-model.js'

// The QA scenario (Q12): a saved Push Day with a ticked warm-up (20 x 10), a warm-up that was left
// unticked (40 x 5) and nine ticked working sets, one weight corrected from 60 to 62.5.
const work = Array.from({ length: 9 }, () => ({ w: 60, r: 8, done: true }))
const saved = () => ({
  id: 'push', d: '2026-04-15', start: 1000, end: 2000, name: 'Push Day 1', prs: [],
  entries: [{ id: '0025', target: { mode: 'reps' }, sets: [
    { w: 20, r: 10, done: true, phase: 'warmup' },
    { w: 40, r: 5, done: false, phase: 'warmup' },
    ...structuredClone(work),
  ] }],
})
const fixture = () => ({ active: null, exWeights: {}, routines: [], workouts: [saved()] })
const open = () => { const st = fixture(); editCompletedSession(st, 'push'); return st }
const rows = st => st.workouts[0].entries[0].sets

describe('editing a saved workout keeps every set (Q12)', () => {
  it('correcting one working weight changes that set only: ten ticked sets, the warm-ups and all', () => {
    const st = open()
    st.active.entries[0].sets[2].w = 62.5
    expect(diffWorkoutEdit(st)).toEqual([{
      kind: 'set-changed', id: '0025', set: 1, before: { w: 60, r: 8, sec: 0 }, after: { w: 62.5, r: 8, sec: 0 },
    }])
    saveWorkoutEdit(st)
    const after = rows(st)
    expect(after).toHaveLength(11)
    expect(after.filter(isWarmupRow)).toHaveLength(2)
    expect(after[0]).toMatchObject({ w: 20, r: 10, done: true })
    expect(after[1]).toMatchObject({ w: 40, r: 5, done: false })
    expect(after[2]).toMatchObject({ w: 62.5, r: 8, done: true })
    expect(after.filter(s => s.done)).toHaveLength(10)
  })

  it('saving with no change keeps all eleven rows exactly as they were', () => {
    const st = open()
    expect(diffWorkoutEdit(st)).toEqual([])
    saveWorkoutEdit(st)
    expect(rows(st)).toEqual(saved().entries[0].sets)
  })

  it('unticking a warm-up is listed as that warm-up, and the row stays in the record', () => {
    const st = open()
    st.active.entries[0].sets[0].done = false
    expect(diffWorkoutEdit(st)).toEqual([{
      kind: 'set-unticked', id: '0025', set: 1, warmup: true, before: { w: 20, r: 10, sec: 0 }, after: { w: 20, r: 10, sec: 0 },
    }])
    saveWorkoutEdit(st)
    expect(rows(st)).toHaveLength(11)
    expect(rows(st)[0]).toMatchObject({ w: 20, r: 10, done: false })
  })

  it('ticking an unticked warm-up is listed too', () => {
    const st = open()
    st.active.entries[0].sets[1].done = true
    expect(diffWorkoutEdit(st)).toEqual([{
      kind: 'set-ticked', id: '0025', set: 2, warmup: true, before: { w: 40, r: 5, sec: 0 }, after: { w: 40, r: 5, sec: 0 },
    }])
  })

  it('a warm-up weight changed, a warm-up removed and a warm-up added are each listed', () => {
    const changed = open()
    changed.active.entries[0].sets[0].w = 25
    expect(diffWorkoutEdit(changed)).toEqual([{
      kind: 'set-changed', id: '0025', set: 1, warmup: true, before: { w: 20, r: 10, sec: 0 }, after: { w: 25, r: 10, sec: 0 },
    }])
    const removed = open()
    removed.active.entries[0].sets.splice(1, 1)
    expect(diffWorkoutEdit(removed)).toEqual([{
      kind: 'set-removed', id: '0025', set: 2, warmup: true, before: { w: 40, r: 5, sec: 0 }, after: null,
    }])
    const added = open()
    added.active.entries[0].sets.splice(2, 0, { w: 50, r: 3, done: true, phase: 'warmup' })
    expect(diffWorkoutEdit(added)).toEqual([{
      kind: 'set-added', id: '0025', set: 3, warmup: true, before: null, after: { w: 50, r: 3, sec: 0 },
    }])
  })

  it('a work set unticked and a work set removed are listed apart', () => {
    const st = open()
    st.active.entries[0].sets[3].done = false
    st.active.entries[0].sets.pop()
    expect(diffWorkoutEdit(st)).toEqual([
      { kind: 'set-unticked', id: '0025', set: 2, before: { w: 60, r: 8, sec: 0 }, after: { w: 60, r: 8, sec: 0 } },
      { kind: 'set-removed', id: '0025', set: 9, before: { w: 60, r: 8, sec: 0 }, after: null },
    ])
  })
})
