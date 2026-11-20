import { describe, it, expect } from 'vitest'
import { exerciseRecords } from './exercise-records.js'

const s = (id, d, t, sets) => ({ id, d, t, sets })

describe('exerciseRecords', () => {
  it('no sessions gives no records', () => {
    const r = exerciseRecords({ metric: 'weight', sessions: [] })
    expect(r.count).toBe(0)
    expect(r.heavy).toBeNull()
    expect(r.latestId).toBeNull()
  })
  it('a heaviest-weight tie goes to more reps', () => {
    // Newest first, as exerciseHistory returns them.
    const h = { metric: 'weight', sessions: [
      s('b', '2026-11-18', 2, [{ w: 125, r: 8, done: true }]),
      s('a', '2026-11-11', 1, [{ w: 125, r: 10, done: true }]),
    ] }
    const r = exerciseRecords(h)
    expect(r.heavy).toEqual({ w: 125, r: 10, d: '2026-11-11', sid: 'a' })
    expect(r.most).toEqual({ w: 125, r: 10, d: '2026-11-11', sid: 'a' })
    expect(r.inSession).toEqual({ v: 1250, n: 1, d: '2026-11-11', sid: 'a' })
    expect(r.latestId).toBe('b')
  })
  it('a full tie keeps the earlier session', () => {
    const h = { metric: 'weight', sessions: [
      s('b', '2026-11-18', 2, [{ w: 125, r: 10, done: true }]),
      s('a', '2026-11-11', 1, [{ w: 125, r: 10, done: true }]),
    ] }
    const r = exerciseRecords(h)
    expect(r.heavy.sid).toBe('a')
    expect(r.most.sid).toBe('a')
    expect(r.inSession.sid).toBe('a')
  })
  it('sets that are not done are not counted', () => {
    const h = { metric: 'weight', sessions: [
      s('a', '2026-11-11', 1, [{ w: 125, r: 10, done: true }, { w: 200, r: 1, done: false }]),
    ] }
    expect(exerciseRecords(h).heavy.w).toBe(125)
  })
  it('rep-only exercises use reps, not weight', () => {
    const h = { metric: 'reps', sessions: [
      s('a', '2026-11-11', 1, [{ w: 0, r: 12, done: true }, { w: 0, r: 10, done: true }]),
    ] }
    const r = exerciseRecords(h)
    expect(r.heavy).toBeNull()
    expect(r.most).toEqual({ w: 0, r: 12, d: '2026-11-11', sid: 'a' })
    expect(r.inSession).toEqual({ v: 22, n: 2, d: '2026-11-11', sid: 'a' })
  })
  it('timed exercises use the session value', () => {
    const h = { metric: 'sec', sessions: [
      { id: 'b', d: '2026-11-18', t: 2, value: 90, sets: [] },
      { id: 'a', d: '2026-11-11', t: 1, value: 60, sets: [] },
    ] }
    expect(exerciseRecords(h).inSession).toEqual({ v: 90, n: 0, d: '2026-11-18', sid: 'b' })
  })
})
