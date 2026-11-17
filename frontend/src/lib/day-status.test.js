// The day-by-day status the calendar, the week strip and the Skip sheet all read from.
import { describe, expect, it } from 'vitest'
import { dayStatus, monthStatuses, withSkipDays, withoutSkipDays, dayKeyOf, daysBetween, addDaysKey } from './day-status.js'

const fixture = (over = {}) => ({
  routines: [{ id: 'A', name: 'Push', ex: [] }, { id: 'B', name: 'Pull', ex: [] }],
  week: { 1: ['A'], 3: ['B'], 5: ['A'] },
  dayPlan: {}, workouts: [], dayNotes: {}, bodyweight: [],
  ...over,
})
const today = '2026-09-16' // a Wednesday

describe('dayStatus: planned, today, rest', () => {
  it('today, the future and rest days', () => {
    const S = fixture()
    expect(dayStatus(S, '2026-09-16', today).kind).toBe('today')
    expect(dayStatus(S, '2026-09-16', today).routineIds).toEqual(['B'])
    expect(dayStatus(S, '2026-09-18', today).kind).toBe('planned')
    expect(dayStatus(S, '2026-09-17', today).kind).toBe('rest')
  })

  it('a past scheduled day with nothing logged is missed once there is a first workout', () => {
    const S = fixture({ workouts: [{ id: 'w1', d: '2026-09-01', routineIds: ['A'], entries: [] }] })
    expect(dayStatus(S, '2026-09-14', today)).toEqual({ kind: 'missed', workoutIds: [], routineIds: ['A'] })
    expect(dayStatus(S, '2026-08-31', today).kind).toBe('rest')
  })

  it('no workouts at all: a past scheduled day is rest, not a wall of misses', () => {
    expect(dayStatus(fixture(), '2026-09-14', today).kind).toBe('rest')
  })
})

describe('dayStatus: done', () => {
  it('a workout on the day is done, with its routine and id', () => {
    const S = fixture({ workouts: [{ id: 'w2', d: '2026-09-14', routineIds: ['A'], entries: [] }] })
    expect(dayStatus(S, '2026-09-14', today)).toEqual({ kind: 'done', workoutIds: ['w2'], routineIds: ['A'] })
  })

  it('a workout beats a skip note on the same day', () => {
    const S = fixture({
      workouts: [{ id: 'w2', d: '2026-09-14', routineIds: ['A'], entries: [] }],
      dayNotes: { '2026-09-14': { tag: 'travel', _ts: 1 } },
    })
    expect(dayStatus(S, '2026-09-14', today).kind).toBe('done')
  })
})

describe('dayStatus: skips', () => {
  const skipOn = (day, note, extra = {}) => fixture({ workouts: [{ id: 'w1', d: '2026-09-01', routineIds: ['A'], entries: [] }], dayNotes: { [day]: note }, ...extra })

  it('each skip reason reads back', () => {
    for (const tag of ['travel', 'sick', 'busy', 'other']) {
      expect(dayStatus(skipOn('2026-09-14', { tag, _ts: 1 }), '2026-09-14', today)).toMatchObject({ kind: 'skipped', reason: tag })
    }
  })

  it('injured reads as sick, and a text-only note on a scheduled day reads as other', () => {
    expect(dayStatus(skipOn('2026-09-14', { tag: 'injured', _ts: 1 }), '2026-09-14', today)).toMatchObject({ kind: 'skipped', reason: 'sick' })
    expect(dayStatus(skipOn('2026-09-14', { text: 'Wedding', _ts: 1 }), '2026-09-14', today)).toMatchObject({ kind: 'skipped', reason: 'other' })
  })

  it('a rest note on an unscheduled day stays rest', () => {
    expect(dayStatus(skipOn('2026-09-17', { tag: 'rest', _ts: 1 }), '2026-09-17', today).kind).toBe('rest')
  })

  it('a cleared note falls back to missed', () => {
    expect(dayStatus(skipOn('2026-09-14', { _ts: 1 }), '2026-09-14', today).kind).toBe('missed')
  })

  it('a skip on a future scheduled day is skipped', () => {
    expect(dayStatus(skipOn('2026-09-18', { tag: 'travel', _ts: 1 }), '2026-09-18', today)).toMatchObject({ kind: 'skipped', reason: 'travel' })
  })
})

describe('dayStatus: plan overrides', () => {
  it('a one-off routine turns a rest day into planned, and a rest override clears a planned day', () => {
    const S = fixture({ dayPlan: { '2026-09-17': 'A', '2026-09-18': 'rest' } })
    expect(dayStatus(S, '2026-09-17', today).kind).toBe('planned')
    expect(dayStatus(S, '2026-09-18', today).kind).toBe('rest')
  })
})

describe('monthStatuses', () => {
  it('has every day of the month', () => {
    const m = monthStatuses(fixture(), 2026, 8, today)
    const keys = Object.keys(m)
    expect(keys).toHaveLength(30)
    expect(keys[0]).toBe('2026-09-01')
    expect(keys[keys.length - 1]).toBe('2026-09-30')
  })
})

describe('skip writes', () => {
  it('withSkipDays writes one tagged, stamped note per day', () => {
    const m = withSkipDays({}, ['2026-09-14', '2026-09-15', '2026-09-16'], 'busy', 'Deadline', 42)
    expect(Object.keys(m)).toHaveLength(3)
    expect(m['2026-09-15']).toEqual({ tag: 'busy', text: 'Deadline', _ts: 42 })
  })

  it('withoutSkipDays clears only skip days and leaves cleared and other notes alone', () => {
    const start = {
      '2026-09-14': { tag: 'travel', _ts: 1 },
      '2026-09-15': { tag: 'rest', _ts: 1 },
      '2026-09-16': { _ts: 1 },
    }
    const out = withoutSkipDays(start, ['2026-09-14', '2026-09-15', '2026-09-16'], 9)
    expect(out['2026-09-14']).toEqual({ _ts: 9 })
    expect(out['2026-09-15']).toEqual({ tag: 'rest', _ts: 1 })
    expect(out['2026-09-16']).toEqual({ _ts: 1 })
  })
})

describe('dayStatus does not mutate', () => {
  it('leaves the state as it was', () => {
    const S = fixture({ workouts: [{ id: 'w1', d: '2026-09-01', routineIds: ['A'], entries: [] }], dayNotes: { '2026-09-14': { tag: 'sick', _ts: 1 } } })
    const before = JSON.stringify(S)
    monthStatuses(S, 2026, 8, today)
    dayStatus(S, '2026-09-14', today)
    expect(JSON.stringify(S)).toBe(before)
  })
})

describe('date helpers', () => {
  it('dayKeyOf, addDaysKey and daysBetween work on local calendar days', () => {
    expect(dayKeyOf(new Date(2026, 8, 3, 23, 30))).toBe('2026-09-03')
    expect(addDaysKey('2026-02-28', 1)).toBe('2026-03-01')
    expect(daysBetween('2026-09-14', '2026-09-16')).toEqual(['2026-09-14', '2026-09-15', '2026-09-16'])
    expect(daysBetween('2026-09-16', '2026-09-14')).toEqual([])
  })
})
