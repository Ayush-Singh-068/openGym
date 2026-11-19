// @vitest-environment happy-dom
// Settings → Automatic copies, restoring: the latest auto-save is the top row, labels are in local
// time with no ISO text, each row says what its copy holds (an empty one is labelled), the restore
// question shows the copy against what you have now with a strong warning when it holds less, and
// what you have now is saved as a "before a restore" copy before anything is replaced.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ snaps: [], latest: null, bodies: {}, order: [], sheet: null, current: {}, safeOk: true, safeJson: '', importBackup: null }))
vi.mock('../lib/local-mirror.js', async o => ({
  ...(await o()),
  listSnapshots: async () => mocks.snaps,
  latestCopy: async () => mocks.latest,
  readSnapshot: async id => mocks.bodies[id] ?? null,
  writeSafety: async json => { mocks.order.push('safety'); mocks.safeJson = json; return mocks.safeOk },
  latestSavedAt: async () => null,
  onMirrorSaved: () => () => {},
}))
vi.mock('../store/useStore.js', () => {
  const useStore = sel => sel({ importBackup: (...a) => { mocks.order.push('import'); mocks.importBackup(...a) } })
  useStore.getState = () => ({ S: mocks.current })
  return { useStore }
})
vi.mock('../sheets.jsx', () => ({ confirmSheet: opts => { mocks.sheet = opts } }))

const { default: LocalSnapshots } = await import('./LocalSnapshots.jsx')
const { useUI } = await import('../store/useUI.js')
const { dateLocale } = await import('../lib/i18n.js')

const AT = new Date(2026, 10, 17, 15, 56).getTime()
const stamp = ts => new Date(ts).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })
const many = n => Array.from({ length: n }, (_, i) => ({ id: 'r' + i }))
const FULL = { routines: many(15), workouts: [{ d: '2026-11-17' }] }
const BEFORE_ID = '2026-11-17 before 2026-11-17T10:24:21'
let root, host, toast
const flush = async () => { for (let i = 0; i < 12; i++) await act(async () => { await Promise.resolve() }) }
const titles = () => [...host.querySelectorAll('.lrow-t')].map(e => e.textContent)
const subtitles = () => [...host.querySelectorAll('.lrow-s')].map(e => e.textContent)
const tap = async i => { act(() => { host.querySelectorAll('button.lrow')[i].click() }); await flush() }
const messageText = () => {
  const box = document.createElement('div')
  document.body.appendChild(box)
  const r = createRoot(box)
  act(() => r.render(mocks.sheet.message))
  const text = box.textContent
  act(() => r.unmount())
  box.remove()
  return text
}

beforeEach(async () => {
  mocks.current = FULL
  mocks.latest = { id: 'latest', ts: AT + 120_000, size: 4096 }
  mocks.snaps = [{ id: BEFORE_ID, ts: AT, size: 2048 }, { id: '2026-11-17', ts: AT - 3_600_000, size: 2048 }]
  mocks.bodies = { latest: JSON.stringify(FULL), [BEFORE_ID]: JSON.stringify(FULL), '2026-11-17': JSON.stringify({ routines: [], workouts: [] }) }
  mocks.order = []; mocks.sheet = null; mocks.safeOk = true; mocks.safeJson = ''
  mocks.importBackup = vi.fn()
  toast = vi.fn()
  useUI.setState({ toast })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  act(() => root.render(<LocalSnapshots />))
  await flush()
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('the list of copies', () => {
  it('puts the latest auto-save on top, then the rest, with local-time labels and no raw timestamps', () => {
    const [first, second, third] = titles()
    expect(first).toBe(`${stamp(AT + 120_000)} (latest auto-save)`)
    expect(second).toBe(`${stamp(AT)} (before a restore)`)
    expect(third).toBe(stamp(AT - 3_600_000))
    for (const title of titles()) expect(title).not.toMatch(/T\d\d:\d\d|before 20/)
  })

  it('says what each copy holds and labels the empty one', () => {
    const [first, second, third] = subtitles()
    expect(first).toContain('15 routines, 1 workout, last workout')
    expect(second).toContain('15 routines')
    expect(third).toContain('Empty copy')
    expect(third).toContain('2 KB')
  })
})

describe('restoring a copy', () => {
  it('an empty copy gets a strong warning, and Restore anyway saves what you have first, then restores', async () => {
    await tap(2)
    expect(mocks.sheet.title).toBe('Restore an empty copy?')
    expect(mocks.sheet.confirmText).toBe('Restore anyway')
    expect(mocks.sheet.danger).toBe(true)
    const text = messageText()
    expect(text).toContain('This copy is empty.')
    expect(text).toContain('15 routines')
    expect(text).toContain('no routines, no workouts')
    expect(text).toContain('marked “before a restore”')
    expect(mocks.order).toEqual([])
    await act(async () => { await mocks.sheet.onConfirm() })
    expect(mocks.order).toEqual(['safety', 'import'])
    expect(JSON.parse(mocks.safeJson).routines).toHaveLength(15)
    expect(mocks.importBackup).toHaveBeenCalledWith({ routines: [], workouts: [] })
    expect(toast).toHaveBeenCalledWith('Copy restored')
  })

  it('a copy with fewer routines or workouts than now is warned about', async () => {
    mocks.bodies[BEFORE_ID] = JSON.stringify({ routines: many(3), workouts: [{ d: '2026-11-16' }] })
    await tap(1)
    expect(mocks.sheet.title).toBe('Restore a smaller copy?')
    expect(mocks.sheet.danger).toBe(true)
    expect(messageText()).toContain('fewer routines or workouts than you have now')
  })

  it('a copy with as much as you have is a plain Restore with no warning', async () => {
    await tap(0)
    expect(mocks.sheet.title).toBe('Restore this copy?')
    expect(mocks.sheet.confirmText).toBe('Restore')
    expect(mocks.sheet.danger).toBe(false)
    expect(messageText()).not.toContain('fewer')
  })

  it('does not replace anything when the copy of what you have now cannot be saved', async () => {
    mocks.safeOk = false
    await tap(2)
    await act(async () => { await mocks.sheet.onConfirm() })
    expect(mocks.importBackup).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Your current data could not be saved as a copy first, so nothing was changed.')
  })

  it('has nothing to save first when there is no data yet', async () => {
    mocks.current = {}
    await tap(0)
    await act(async () => { await mocks.sheet.onConfirm() })
    expect(mocks.order).toEqual(['import'])
  })

  it('says so when the copy cannot be read, and asks nothing', async () => {
    mocks.bodies[BEFORE_ID] = '{broken'
    await tap(1)
    expect(mocks.sheet).toBeNull()
    expect(toast).toHaveBeenCalledWith('That copy could not be read')
  })
})
