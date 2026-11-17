// The wake lock's status for the workout screen (lib/wakelock.js): 'held' while the screen is really
// being kept on (the "Screen on" chip), 'problem' when the lock is wanted but refused, unsupported or
// lost with the page on screen (the "your phone may lock" note), 'idle' otherwise. The fake browser
// drops the lock when the document hides, as a real one does, which is not a problem.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

let live, listeners, reject

const setNavigator = value =>
  Object.defineProperty(globalThis, 'navigator', { value, configurable: true, writable: true })

function fakeBrowser() {
  live = null; reject = false
  listeners = new Set()
  globalThis.document = {
    visibilityState: 'visible',
    addEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.add(fn) },
    removeEventListener: (type, fn) => { if (type === 'visibilitychange') listeners.delete(fn) },
  }
  setNavigator({
    wakeLock: {
      request: async () => {
        if (reject) throw new Error('NotAllowedError')   // iOS Low Power Mode
        const subs = new Set()
        const s = { addEventListener: (_, fn) => subs.add(fn), release: async () => { if (live === s) live = null; subs.forEach(fn => fn()) } }
        live = s
        return s
      },
    },
  })
}
const fire = () => listeners.forEach(fn => fn())
const settle = () => new Promise(r => setTimeout(r, 0))

let wl

beforeEach(async () => {
  fakeBrowser()
  vi.resetModules()   // the module holds process-wide state; each test gets a fresh one
  wl = await import('./wakelock.js')
})
afterEach(() => { delete globalThis.document; delete globalThis.navigator })

describe('wakeLockStatus', () => {
  it('is idle before anything is asked', () => {
    expect(wl.wakeLockStatus()).toBe('idle')
    expect(wl.wakeLockHeld()).toBe(false)
    expect(wl.wakeLockProblem()).toBe(false)
  })

  it('is held once the lock is taken, and tells a listener', async () => {
    let calls = 0
    wl.onWakeLockChange(() => { calls++ })
    wl.requestWakeLock(); await settle()
    expect(wl.wakeLockStatus()).toBe('held')
    expect(wl.wakeLockHeld()).toBe(true)
    expect(calls).toBeGreaterThan(0)
  })

  it('is a problem when the browser refuses the lock (Low Power Mode)', async () => {
    reject = true
    wl.requestWakeLock(); await settle()
    expect(wl.wakeLockStatus()).toBe('problem')
    expect(wl.wakeLockProblem()).toBe(true)
    expect(wl.wakeLockHeld()).toBe(false)
  })

  it('is a problem at once where the browser has no wake lock at all', () => {
    setNavigator({})
    let calls = 0
    wl.onWakeLockChange(() => { calls++ })
    wl.requestWakeLock()
    expect(wl.wakeLockStatus()).toBe('problem')
    expect(calls).toBe(1)
  })

  it('is not a problem when the browser drops the lock because the page hid, and held again when it is shown', async () => {
    wl.requestWakeLock(); await settle()
    globalThis.document.visibilityState = 'hidden'
    await live.release(); fire(); await settle()
    expect(wl.wakeLockStatus()).toBe('idle')
    globalThis.document.visibilityState = 'visible'
    fire(); await settle()
    expect(wl.wakeLockStatus()).toBe('held')
  })

  it('is a problem when the lock is lost while the page is on screen', async () => {
    wl.requestWakeLock(); await settle()
    await live.release(); await settle()
    expect(wl.wakeLockStatus()).toBe('problem')
  })

  it('a refused lock that is granted on the next show is held, with no problem left', async () => {
    reject = true
    wl.requestWakeLock(); await settle()
    expect(wl.wakeLockStatus()).toBe('problem')
    reject = false
    fire(); await settle()
    expect(wl.wakeLockStatus()).toBe('held')
  })

  it('goes back to idle when the workout no longer wants the screen on, and stops telling a listener that left', async () => {
    let calls = 0
    const off = wl.onWakeLockChange(() => { calls++ })
    reject = true
    wl.requestWakeLock(); await settle()
    wl.releaseWakeLock()
    expect(wl.wakeLockStatus()).toBe('idle')
    off()
    const before = calls
    wl.requestWakeLock(); await settle()
    expect(calls).toBe(before)
  })
})
