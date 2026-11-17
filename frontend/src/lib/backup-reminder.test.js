import { describe, it, expect } from 'vitest'
import { exportDue } from './backup-reminder.js'

const D = 86400000
const now = 100 * D

describe('exportDue', () => {
  it('is quiet with no data or no starting point', () => {
    expect(exportDue({ has: false, last: 1, now })).toBe(false)
    expect(exportDue({ now })).toBe(false)
  })
  it('asks once a week has passed since the last export', () => {
    expect(exportDue({ last: now - 6 * D, now })).toBe(false)
    expect(exportDue({ last: now - 7 * D, now })).toBe(true)
  })
  it('counts from the first data when nothing was ever exported', () => {
    expect(exportDue({ first: now - 3 * D, now })).toBe(false)
    expect(exportDue({ first: now - 8 * D, now })).toBe(true)
  })
  it('stays quiet for a day after it was put off', () => {
    expect(exportDue({ last: now - 30 * D, snoozed: now - D / 2, now })).toBe(false)
    expect(exportDue({ last: now - 30 * D, snoozed: now - D, now })).toBe(true)
  })
})
