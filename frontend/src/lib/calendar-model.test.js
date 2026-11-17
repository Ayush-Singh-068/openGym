// The calendar's month grid, week numbers, month steps and week sums.
import { describe, expect, it } from 'vitest'
import { addDays, clampMonth, monthGrid, shiftMonth, weekDays, weekNumberOf, weekSummary, weekToSelect, yearOptions, firstWorkoutDay } from './calendar-model.js'

const S = (workouts = [], extra = {}) => ({ workouts, unit: 'kg', ...extra })
const at = iso => new Date(iso + 'T18:00:00').getTime()
const workout = (id, iso, extra = {}) => ({ id, d: iso, name: 'Push', start: at(iso), end: at(iso) + 1800000, entries: [{ id: '0025', sets: [{ w: 50, r: 10, done: true }] }], ...extra })

describe('monthGrid', () => {
  it('starts March 2026 on the Monday before the 1st when weeks start on Monday', () => {
    const grid = monthGrid(2026, 2, 1)
    expect(grid.weeks[0].days[0].iso).toBe('2026-02-23')
    expect(grid.weeks.length).toBe(6)
  })

  it('starts March 2026 on the 1st when weeks start on Sunday', () => {
    const grid = monthGrid(2026, 2, 0)
    expect(grid.weeks[0].days[0].iso).toBe('2026-03-01')
    expect(grid.weeks.length).toBe(5)
  })

  it('has seven days in every row and marks the neighbouring days', () => {
    for (const ws of [0, 1]) {
      const grid = monthGrid(2026, 2, ws)
      grid.weeks.forEach(wk => expect(wk.days.length).toBe(7))
      const inMonth = grid.weeks.flatMap(wk => wk.days).filter(d => d.inMonth)
      expect(inMonth.length).toBe(31)
      expect(inMonth[0].day).toBe(1)
    }
  })

  it('keys each row by its first day', () => {
    const grid = monthGrid(2026, 2, 1)
    expect(grid.weeks[1].key).toBe('2026-03-02')
  })
})

describe('weekNumberOf', () => {
  it('numbers the first week of 2026 as week 1', () => {
    expect(weekNumberOf('2026-01-01', 1).week).toBe(1)
  })

  it('puts 2024-12-30 in week 1 of 2025', () => {
    expect(weekNumberOf('2024-12-30', 1)).toEqual({ week: 1, year: 2025 })
  })

  it('puts 2021-01-03 in week 53 of 2020 when weeks start on Monday', () => {
    expect(weekNumberOf('2021-01-03', 1).week).toBe(53)
  })

  it('puts 2026-12-31 in week 53', () => {
    expect(weekNumberOf('2026-12-31', 1).week).toBe(53)
  })

  it('numbers a Sunday-first week by its Thursday, the same as the Monday-first week of that Thursday', () => {
    expect(weekNumberOf('2026-08-16', 0).week).toBe(weekNumberOf('2026-08-17', 1).week)
  })
})

describe('shiftMonth', () => {
  it('steps back across a year', () => {
    expect(shiftMonth(2026, 0, -1)).toEqual({ year: 2025, monthIndex0: 11 })
  })

  it('steps forward across a year', () => {
    expect(shiftMonth(2026, 11, 1)).toEqual({ year: 2027, monthIndex0: 0 })
  })

  it('takes a long step back', () => {
    expect(shiftMonth(2026, 5, -18)).toEqual({ year: 2024, monthIndex0: 11 })
  })
})

describe('yearOptions and firstWorkoutDay', () => {
  it('lists years down to the first workout and always next year', () => {
    const s = S([workout('a', '2024-05-02'), workout('b', '2026-02-02')])
    expect(firstWorkoutDay(s)).toBe('2024-05-02')
    expect(yearOptions(s, '2026-11-17')).toEqual([2027, 2026, 2025, 2024])
  })

  it('lists this year and next when there are no workouts', () => {
    expect(yearOptions(S(), '2026-11-17')).toEqual([2027, 2026])
  })
})

describe('clampMonth', () => {
  it('refuses a month before the first workout', () => {
    const s = S([workout('a', '2026-03-10')])
    expect(clampMonth(s, '2026-11-17', 2025, 4)).toEqual({ year: 2026, monthIndex0: 2 })
  })

  it('refuses a month more than a year ahead of today', () => {
    expect(clampMonth(S(), '2026-11-17', 2030, 0)).toEqual({ year: 2027, monthIndex0: 10 })
  })

  it('keeps a month in range', () => {
    expect(clampMonth(S([workout('a', '2026-03-10')]), '2026-11-17', 2026, 4)).toEqual({ year: 2026, monthIndex0: 4 })
  })
})

describe('weekDays and addDays', () => {
  it('gives seven days from the week start', () => {
    expect(weekDays('2026-02-23')).toEqual(['2026-02-23', '2026-02-24', '2026-02-25', '2026-02-26', '2026-02-27', '2026-02-28', '2026-03-01'])
  })

  it('moves across a month and a year', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('weekSummary', () => {
  it('totals the week and keeps each day in start order', () => {
    const late = workout('b', '2026-02-24', { start: at('2026-02-24') + 3600000, end: at('2026-02-24') + 5400000 })
    const early = workout('a', '2026-02-24', { start: at('2026-02-24'), end: at('2026-02-24') + 1800000 })
    const other = workout('c', '2026-03-05')
    const s = S([late, early, other])
    const sum = weekSummary(s, weekDays('2026-02-23'))
    expect(sum.days.length).toBe(7)
    expect(sum.days[1].workouts.map(x => x.w.id)).toEqual(['a', 'b'])
    expect(sum.workouts).toBe(2)
    expect(sum.durationMs).toBe(1800000 + 1800000)
    expect(sum.volume).toBe(1000)
  })
})

describe('weekToSelect', () => {
  const grid = monthGrid(2026, 2, 1)
  it('keeps the picked week while it is in the grid', () => {
    expect(weekToSelect(grid, '2026-03-09', '2026-11-17')).toBe('2026-03-09')
  })

  it('falls back to the week of today when it is in the grid', () => {
    expect(weekToSelect(grid, '2026-11-02', '2026-03-18')).toBe('2026-03-16')
  })

  it('falls back to the week of the 1st otherwise', () => {
    expect(weekToSelect(grid, null, '2026-11-17')).toBe('2026-02-23')
  })
})
