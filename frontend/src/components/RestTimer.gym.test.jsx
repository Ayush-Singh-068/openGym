// @vitest-environment happy-dom
// Gym mode on the rest bar: the "Next:" line under the clock (it rides on timer.next), and a rest
// that ran out while the page was hidden, told once when the page is shown again.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestTimer from './RestTimer.jsx'
import { useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'
import { alertBuzz } from '../lib/sound.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn() }))

let host, root, originalS, hidden

beforeEach(() => {
  vi.useFakeTimers()
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
  originalS = useStore.getState().S
  useStore.setState({ S: { ...originalS, sound: false, gymMode: true } })
  useUI.setState({ timer: null, work: null, timerFlashId: 0, toastMsg: '', toastAction: null })
  alertBuzz.mockClear()
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.render(null))
  useUI.getState().stopRest()
  useStore.setState({ S: originalS })
  delete document.hidden
  host.remove()
  vi.useRealTimers()
})

const mount = () => act(() => root.render(<RestTimer />))
const nextLine = () => host.querySelector('#timer .restnext')

describe('the Next line on the rest bar', () => {
  it('shows what comes next under the clock, while counting and when Ready', () => {
    act(() => useUI.getState().startRest(30, 0, { forSet: 0, next: 'Next: set 2 · 80 kg × 8' }))
    mount()
    expect(nextLine().textContent).toBe('Next: set 2 · 80 kg × 8')
    expect(host.querySelector('#timer').className).toContain('withnext')
    expect(host.querySelector('#timer .t').textContent).toBe('0:30')
    act(() => vi.advanceTimersByTime(30000))
    expect(host.querySelector('#timer .t').textContent).toBe('Ready')
    expect(nextLine().textContent).toBe('Next: set 2 · 80 kg × 8')
  })

  it('has no line when the rest does not say, and none for a switch-sides pause', () => {
    act(() => useUI.getState().startRest(30, 0, { forSet: 0 }))
    mount()
    expect(nextLine()).toBeNull()
    expect(host.querySelector('#timer').className).not.toContain('withnext')
    act(() => useUI.getState().startRest(10, 0, { kind: 'switch', forSet: 0, next: 'Next: set 2 · 80 kg × 8' }))
    expect(nextLine()).toBeNull()
  })

  it('keeps the line when +15 s is pressed on a rest that is Ready, and when the wheel restarts it', () => {
    act(() => useUI.getState().startRest(5, 0, { forSet: 0, rest: 'work', nextKind: 'set', next: 'Next: set 2 · 80 kg × 8' }))
    mount()
    act(() => vi.advanceTimersByTime(5000))
    expect(host.querySelector('#timer .t').textContent).toBe('Ready')
    act(() => useUI.getState().addRest(15))
    expect(useUI.getState().timer.next).toBe('Next: set 2 · 80 kg × 8')
    expect(useUI.getState().timer.nextKind).toBe('set')
    expect(nextLine().textContent).toBe('Next: set 2 · 80 kg × 8')
  })
})

describe('a rest that ran out while the page was hidden', () => {
  it('is told once when the page is shown again: how long ago, one buzz', () => {
    act(() => useUI.getState().startRest(5, 0, { forSet: 0, nextKind: 'set' }))
    hidden = true
    act(() => vi.advanceTimersByTime(8000))
    expect(useUI.getState().timer.ready).toBe(true)
    expect(useUI.getState().timer.missed).toBeGreaterThan(0)
    expect(alertBuzz).not.toHaveBeenCalled()
    hidden = false
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(useUI.getState().toastMsg).toBe('Rest ended 3s ago')
    expect(alertBuzz).toHaveBeenCalledTimes(1)
    expect(useUI.getState().timer.missed).toBeUndefined()
    useUI.getState().dismissToast()
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(useUI.getState().toastMsg).toBe('')
    expect(alertBuzz).toHaveBeenCalledTimes(1)
  })

  it('is not told with Gym mode off', () => {
    useStore.setState({ S: { ...useStore.getState().S, gymMode: false } })
    act(() => useUI.getState().startRest(5, 0, { forSet: 0 }))
    hidden = true
    act(() => vi.advanceTimersByTime(8000))
    expect(useUI.getState().timer.missed).toBeUndefined()
    hidden = false
    act(() => { document.dispatchEvent(new Event('visibilitychange')) })
    expect(useUI.getState().toastMsg).not.toContain('Rest ended')
    expect(alertBuzz).not.toHaveBeenCalled()
  })

  it('is not told with Screen-awake notice off', () => {
    useStore.setState({ S: { ...useStore.getState().S, gymOpts: { awake: false } } })
    act(() => useUI.getState().startRest(5, 0, { forSet: 0 }))
    hidden = true
    act(() => vi.advanceTimersByTime(8000))
    expect(useUI.getState().timer.missed).toBeUndefined()
  })

  it('a rest that ends with the page on screen is not announced late', () => {
    act(() => useUI.getState().startRest(5, 0, { forSet: 0 }))
    act(() => vi.advanceTimersByTime(5000))
    expect(useUI.getState().timer.ready).toBe(true)
    expect(useUI.getState().timer.missed).toBeUndefined()
    expect(useUI.getState().toastMsg).not.toContain('Rest ended')
  })
})
