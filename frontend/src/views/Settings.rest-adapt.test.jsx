// @vitest-environment happy-dom
// Settings > Workout > Rest: the switch "Adjust rest to the set" (Phase 1b N6). On for a profile that never chose.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Settings from './Settings.jsx'

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
  loadStarterPlan: vi.fn(), starterPlanSheet: vi.fn(), confirmSheet: vi.fn(), importFromApp: vi.fn(),
  importFromHevy: vi.fn(), equipmentProfileSheet: vi.fn(),
}))

// The Settings view reads the build-time version constant at render time.
globalThis.__APP_VERSION__ ??= 'test'

let host, root
beforeEach(() => {
  mocks.S = {
    unit: 'kg', restSec: 90, restPauseSec: 15, sound: false, effort: 'none',
    gifSize: 'full', workouts: [], routines: [], exWeights: {},
  }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

const mount = () => act(() => root.render(<Settings page="workout" />))
const row = () => [...host.querySelectorAll('.lrow')].find(r => r.textContent.includes('Adjust rest to the set'))
const sw = () => row().querySelector('[role="switch"]')

describe('Settings: Adjust rest to the set', () => {
  it('is on for a profile that never chose, with its one-line explanation', () => {
    mount()
    expect(row()).toBeTruthy()
    expect(sw().getAttribute('aria-checked')).toBe('true')
    expect(row().textContent).toContain('A rest you set yourself is never changed.')
  })

  it('turns off and on again, writing restAdapt to the store', () => {
    mount()
    act(() => { sw().click() })
    expect(mocks.S.restAdapt).toBe(false)
    mount()
    expect(sw().getAttribute('aria-checked')).toBe('false')
    act(() => { sw().click() })
    expect(mocks.S.restAdapt).toBe(true)
  })

  it('is not offered while the Rest timer is off', () => {
    mocks.S.restSec = 0
    mount()
    expect(row()).toBeUndefined()
  })
})
