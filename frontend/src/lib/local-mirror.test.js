import { describe, it, expect } from 'vitest'
import { dayKey, pruneKeys, shrank, fitsLocalStorage, LS_MAX, SNAP_KEEP, agoOf, backupStamp, backupFileName, onMirrorSaved } from './local-mirror.js'

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
  it('counts the copies kept before a restore apart from the day copies', () => {
    const days = Array.from({ length: SNAP_KEEP }, (_, i) => `2030-02-${String(i + 1).padStart(2, '0')}`)
    const few = ['2030-02-14 before 2030-02-13T10:00:00', '2030-02-14 before 2030-02-14T09:00:00']
    expect(pruneKeys([...days, ...few])).toEqual([])
    const many = Array.from({ length: SNAP_KEEP + 2 }, (_, i) => '2030-02-14 before 2030-02-14T09:' + String(i).padStart(2, '0') + ':00')
    expect(pruneKeys([...days, ...many])).toEqual(many.slice(0, 2))
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

describe('agoOf', () => {
  const now = 1_000_000_000_000
  const ago = s => agoOf(now - s * 1000, now)
  it('says "now" for the first few seconds', () => {
    expect(ago(4)).toMatchObject({ unit: 'now', n: 0 })
    expect(ago(0)).toMatchObject({ unit: 'now', n: 0 })
  })
  it('counts seconds, then minutes, hours and days at each boundary', () => {
    expect(ago(5)).toMatchObject({ unit: 'seconds', n: 5 })
    expect(ago(59)).toMatchObject({ unit: 'seconds', n: 59 })
    expect(ago(60)).toMatchObject({ unit: 'minutes', n: 1 })
    expect(ago(3599)).toMatchObject({ unit: 'minutes', n: 59 })
    expect(ago(3600)).toMatchObject({ unit: 'hours', n: 1 })
    expect(ago(47 * 3600)).toMatchObject({ unit: 'hours', n: 47 })
    expect(ago(48 * 3600)).toMatchObject({ unit: 'days', n: 2 })
  })
  it('clamps a time in the future to now', () => {
    expect(agoOf(now + 60_000, now)).toMatchObject({ unit: 'now', n: 0 })
  })
  it('words the count through Intl.RelativeTimeFormat, with no plural key', () => {
    expect(ago(12).text).toBe('12 seconds ago')
    expect(ago(60).text).toBe('1 minute ago')
    expect(ago(2 * 60).text).toBe('2 minutes ago')
    expect(ago(3600).text).toBe('1 hour ago')
    expect(ago(48 * 3600).text).toBe('2 days ago')
    expect(ago(0).text).toBe('now')
  })
})

describe('backupStamp and backupFileName', () => {
  it('stamps the device clock as YYYY-MM-DD-HHMMSS', () => {
    expect(backupStamp(new Date(2030, 0, 5, 7, 3, 9))).toBe('2030-01-05-070309')
    expect(backupStamp(new Date(2030, 0, 5, 0, 0, 0))).toBe('2030-01-05-000000')
  })
  it('names the file with the stamp and the extension', () => {
    expect(backupFileName('json', new Date(2030, 0, 5, 7, 3, 9))).toBe('opengym-backup-2030-01-05-070309.json')
    expect(backupFileName('zip', new Date(2030, 0, 5, 7, 3, 9))).toMatch(/\.zip$/)
  })
  it('gives two exports in the same minute different names', () => {
    const a = backupFileName('json', new Date(2030, 0, 5, 7, 3, 9))
    const b = backupFileName('json', new Date(2030, 0, 5, 7, 3, 41))
    expect(a).not.toBe(b)
  })
})

describe('onMirrorSaved', () => {
  it('returns an unsubscribe function and registers a listener once', () => {
    const fn = () => {}
    const off = onMirrorSaved(fn)
    expect(typeof off).toBe('function')
    expect(onMirrorSaved(fn)).toBeTypeOf('function')
    off()
  })
})
