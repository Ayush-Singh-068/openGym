// @vitest-environment happy-dom
// Settings → Timer alerts → Sound cues: the volume slider, one row per cue with a play button and
// a switch, and the footer about a locked iPhone.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'
import { playTones, setMasterVolume } from '../lib/sound.js'
import { CUES } from '../lib/cue-sounds.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => {
      const next = structuredClone(state.S)
      mut(next)
      state.S = next
    },
    replaceState: vi.fn(), setUser: vi.fn(), pullState: vi.fn(), pushState: vi.fn(),
    signOut: vi.fn(), signOutAll: vi.fn(), resetDemo: vi.fn(), disconnectServer: vi.fn(),
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => selector ? selector(mocks.snapshot()) : mocks.snapshot()
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('../store/useUI.js', () => {
  const snap = () => ({ toast: vi.fn(), openSheet: vi.fn() })
  const useUI = selector => selector ? selector(snap()) : snap()
  useUI.getState = snap
  return { useUI }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => () => {} }))
vi.mock('../lib/api.js', () => ({
  api: vi.fn(), webauthnOK: () => false, passkeyLogin: vi.fn(), passkeyRegister: vi.fn(), IS_ANDROID: false,
}))
vi.mock('../lib/push.js', () => ({ pushSupported: () => false, enablePush: vi.fn(), disablePush: vi.fn(), sendTestPush: vi.fn() }))
vi.mock('../lib/wakelock.js', () => ({ wakeLockSupported: () => false }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
vi.mock('./MobileOnboarding.jsx', () => ({ ConnectSheet: () => null }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
}))
// Real sound.js, except that nothing makes sound and every call can be read back.
vi.mock('../lib/sound.js', async importOriginal => {
  const real = await importOriginal()
  return { ...real, unlock: vi.fn(), chime: vi.fn(), playTones: vi.fn(), setMasterVolume: vi.fn() }
})

globalThis.__APP_VERSION__ ??= 'test'

const ROWS = ['Next set', 'Next exercise', 'Last set', 'Superset switch', '10 seconds left', 'Workout finished']
let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: true, soundOnSilent: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  playTones.mockClear()
  setMasterVolume.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = (page = 'alerts') => act(() => root.render(<Settings page={page} />))
const rowTitled = title => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const remount = () => { act(() => root.unmount()); root = createRoot(host); mount() }

describe('Settings, Timer alerts: sound cues', () => {
  it('has a volume slider and one row per cue, under Sound cues', () => {
    mount()
    expect([...host.querySelectorAll('.sect-t')].map(e => e.textContent)).toContain('Sound cues')
    for (const title of ['Sound volume', ...ROWS]) expect(rowTitled(title), title).toBeTruthy()
    expect(host.querySelectorAll('[aria-label="Preview"]')).toHaveLength(6)
    expect(host.querySelector('[role="slider"]').getAttribute('aria-valuenow')).toBe('100')
    expect(host.textContent).toContain('A locked iPhone cannot play them')
  })
  it('is not offered while Sounds is off', () => {
    mocks.S.sound = false
    mount()
    expect(rowTitled('Sound volume')).toBeUndefined()
    expect(rowTitled('Last set')).toBeUndefined()
  })
  it('shows the saved volume as a percentage', () => {
    mocks.S.soundVolume = 0.4
    mount()
    expect(host.querySelector('[role="slider"]').getAttribute('aria-valuenow')).toBe('40')
    expect(rowTitled('Sound volume').querySelector('.lrow-v').textContent).toBe('40%')
  })
  it('stores the volume as 0 to 1, applies it at once and plays a sample', () => {
    mount()
    act(() => { host.querySelector('[role="slider"]').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })) })
    expect(mocks.S.soundVolume).toBe(0.95)
    expect(setMasterVolume).toHaveBeenLastCalledWith(0.95)
    expect(playTones).toHaveBeenCalledTimes(1)
  })
  it('plays a cue from its play button', () => {
    mount()
    act(() => { rowTitled('Last set').querySelector('[aria-label="Preview"]').click() })
    expect(playTones).toHaveBeenCalledTimes(1)
    expect(playTones.mock.calls[0][0]).toEqual(CUES.find(c => c.id === 'lastSet').notes)
  })
  it('stores only the cues that are off, and turning one back on removes it', () => {
    mount()
    expect(rowTitled('Last set').querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    act(() => { rowTitled('Last set').querySelector('[role="switch"]').click() })
    expect(mocks.S.soundCues).toEqual({ lastSet: false })
    remount()
    expect(rowTitled('Last set').querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('false')
    expect(rowTitled('Next set').querySelector('[role="switch"]').getAttribute('aria-checked')).toBe('true')
    act(() => { rowTitled('Last set').querySelector('[role="switch"]').click() })
    expect(mocks.S.soundCues).toEqual({})
  })
})
