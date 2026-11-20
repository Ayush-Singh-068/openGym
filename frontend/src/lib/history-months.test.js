import { describe, expect, it } from 'vitest'
import { groupByMonth, monthKeyOf } from './history-months.js'

describe('groupByMonth', () => {
  it('starts a new group whenever the month changes, years apart too', () => {
    const rows = [{ d: '2026-11-18' }, { d: '2026-11-02' }, { d: '2026-10-30' }, { d: '2025-10-03' }]
    expect(groupByMonth(rows).map(g => [g.key, g.rows.length])).toEqual([['2026-11', 2], ['2026-10', 1], ['2025-10', 1]])
  })
  it('keeps the rows of a month in the order they came', () => {
    const rows = [{ d: '2026-11-18', id: 'b' }, { d: '2026-11-18', id: 'a' }]
    expect(groupByMonth(rows)[0].rows.map(r => r.id)).toEqual(['b', 'a'])
  })
  it('is empty for no rows', () => {
    expect(groupByMonth([])).toEqual([])
    expect(groupByMonth(undefined)).toEqual([])
  })
  it('reads the month from the date text', () => {
    expect(monthKeyOf('2026-11-18')).toBe('2026-11')
    expect(monthKeyOf(undefined)).toBe('')
  })
})
