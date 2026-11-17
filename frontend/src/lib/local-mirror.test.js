import { describe, it, expect } from 'vitest'
import { dayKey, pruneKeys, shrank, fitsLocalStorage, LS_MAX, SNAP_KEEP } from './local-mirror.js'

describe('dayKey', () => {
  it('writes the device calendar day as YYYY-MM-DD', () => {
    expect(dayKey(new Date(2030, 0, 5, 23, 59))).toBe('2030-01-05')
    expect(dayKey(new Date(2030, 11, 31, 0, 0))).toBe('2030-12-31')
  })
})

describe('pruneKeys', () => {
  it('keeps the newest SNAP_KEEP and names the older ones', () => {
    const keys = Array.from({ length: SNAP_KEEP + 3 }, (_, i) => `2030-01-${String(i + 1).padStart(2, '0')}`)
    expect(pruneKeys(keys)).toEqual(['2030-01-01', '2030-01-02', '2030-01-03'])
  })
  it('deletes nothing while there are few', () => {
    expect(pruneKeys(['2030-01-02', '2030-01-01'])).toEqual([])
  })
  it('does not depend on the order it is given', () => {
    expect(pruneKeys(['b', 'a', 'c'], 2)).toEqual(['a'])
  })
})

describe('shrank', () => {
  it('flags a copy that lost more than half', () => {
    expect(shrank(10000, 4000)).toBe(true)
    expect(shrank(10000, 6000)).toBe(false)
  })
  it('ignores tiny profiles and a missing earlier copy', () => {
    expect(shrank(1500, 100)).toBe(false)
    expect(shrank(undefined, 5)).toBe(false)
  })
})

describe('fitsLocalStorage', () => {
  it('keeps small profiles in localStorage and sends big ones to IndexedDB alone', () => {
    expect(fitsLocalStorage(40_000)).toBe(true)
    expect(fitsLocalStorage(LS_MAX)).toBe(true)
    expect(fitsLocalStorage(LS_MAX + 1)).toBe(false)
  })
})
