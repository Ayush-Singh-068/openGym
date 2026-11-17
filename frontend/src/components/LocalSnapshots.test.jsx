// @vitest-environment happy-dom
// Settings → Automatic copies: the snapshot rows show the day and the time, and the live
// "Auto-saved" line says when the latest copy was written, counting up between saves.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({ snaps: [], saved: null, cb: null, readSnapshot: vi.fn() }))
vi.mock('../lib/local-mirror.js', async o => ({
  ...(await o()),
  listSnapshots: async () => mocks.snaps,
  readSnapshot: mocks.readSnapshot,
  latestSavedAt: async () => mocks.saved,
  onMirrorSaved: fn => { mocks.cb = fn; return () => { mocks.cb = null } },
}))
vi.mock('../store/useStore.js', () => ({ useStore: sel => sel({ importBackup: () => {} }) }))
vi.mock('../sheets.jsx', () => ({ confirmSheet: () => {} }))

const { default: LocalSnapshots, AutoSavedLine } = await import('./LocalSnapshots.jsx')
const { dateLocale } = await import('../lib/i18n.js')
let root, host
const flush = async () => { for (let i = 0; i < 6; i++) await act(async () => { await Promise.resolve() }) }
const titles = () => [...host.querySelectorAll('.lrow-t')].map(e => e.textContent)

beforeEach(() => {
  mocks.snaps = []; mocks.saved = null; mocks.cb = null
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { vi.useRealTimers(); act(() => root.unmount()); host.remove() })

describe('snapshot rows', () => {
  it('show the day and time of the copy, and fall back to the day when the time is unknown', async () => {
    const at = new Date(2026, 8, 16, 14, 5).getTime()
    mocks.snaps = [{ id: '2026-09-16', ts: at, size: 2048 }, { id: '2026-09-15', ts: 0, size: 1024 }]
    act(() => root.render(<LocalSnapshots />))
    await flush()
    const expected = new Date(at).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })
    const [first, second] = titles()
    expect(first).toBe(expected)
    expect(first).toContain('2026')
    expect(first).toMatch(/5/)
    expect(second).toBe('2026-09-15')
  })
})

describe('AutoSavedLine', () => {
  it('says when nothing has been saved yet', async () => {
    mocks.saved = null
    act(() => root.render(<AutoSavedLine />))
    await flush()
    expect(host.textContent).toContain('Not auto-saved yet')
  })
  it('counts up from the save time while the page stays open', async () => {
    vi.useFakeTimers()
    const saved = new Date(2026, 8, 16, 14, 5, 0).getTime()
    vi.setSystemTime(saved)
    mocks.saved = saved
    act(() => root.render(<AutoSavedLine />))
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    const time = new Date(saved).toLocaleTimeString(dateLocale(), { timeStyle: 'short' })
    expect(host.textContent).toContain(`Auto-saved ${time} (just now)`)

    await act(async () => { await vi.advanceTimersByTimeAsync(20_000) })
    expect(host.textContent).toContain('20 seconds ago')

    await act(async () => { await vi.advanceTimersByTimeAsync(100_000) })
    expect(host.textContent).toContain('2 minutes ago')
  })
  it('updates when a save is announced', async () => {
    vi.useFakeTimers()
    const later = new Date(2026, 8, 16, 14, 30, 0).getTime()
    vi.setSystemTime(later)
    mocks.saved = new Date(2026, 8, 16, 14, 5, 0).getTime()
    act(() => root.render(<AutoSavedLine />))
    await flush()
    act(() => mocks.cb(later))
    await flush()
    const time = new Date(later).toLocaleTimeString(dateLocale(), { timeStyle: 'short' })
    expect(host.textContent).toContain(`Auto-saved ${time} (just now)`)
  })
})
