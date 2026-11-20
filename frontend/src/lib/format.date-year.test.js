import { describe, expect, it } from 'vitest'
import { fmtDateY, monthHeading } from './format.js'

const NOW = new Date('2026-11-20T12:00:00')

describe('fmtDateY', () => {
  it('leaves the year out for the current year', () => {
    expect(fmtDateY('2026-11-18', true, NOW)).toBe('Wed 18 Nov')
    expect(fmtDateY('2026-03-01', false, NOW)).toBe('1 Mar')
  })
  it('shows the year for any other year', () => {
    expect(fmtDateY('2025-10-03', true, NOW)).toBe('Fri, 3 Oct 2025')
    expect(fmtDateY('2027-01-05', false, NOW)).toBe('5 Jan 2027')
  })
})

describe('monthHeading', () => {
  it('reads "November 2026" from any day of that month', () => {
    expect(monthHeading('2026-11-01')).toBe('November 2026')
    expect(monthHeading('2025-10-31')).toBe('October 2025')
  })
  it('is empty for text that is not a date', () => {
    expect(monthHeading('nope')).toBe('')
  })
})
