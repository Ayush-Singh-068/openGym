// @vitest-environment happy-dom
// The rest bar names a rest that was adapted to the set (Phase 1b N6) with one word on its label, only then;
// the word is kept across a reload, and a side-switch pause or a made-up value never carries it.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RestTimer from './RestTimer.jsx'
import { REST_KEY, restoreRest, useUI } from '../store/useUI.js'
import { useStore } from '../store/useStore.js'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn() }))

let host, root, originalS

beforeEach(() => {
  vi.useFakeTimers()
  originalS = useStore.getState().S
  useStore.setState({ S: { ...originalS, sound: false } })
  useUI.setState({ timer: null, work: null, timerFlashId: 0 })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(() => {
  act(() => root.render(null))
  useUI.getState().stopRest()
  useStore.setState({ S: originalS })
  host.remove()
  vi.useRealTimers()
})

const mount = () => act(() => root.render(<RestTimer />))
const label = () => host.querySelector('#timer .lbl').textContent

describe('the rest bar\'s label', () => {
  it('says "heavy set" or "light set" for an adapted rest and plain "Rest" otherwise', () => {
    act(() => useUI.getState().startRest(180, 0, { adapt: 'heavy' }))
    mount()
    expect(label()).toBe('Heavy set')
    expect(host.querySelector('#timer .t').textContent).toBe('3:00')
    act(() => useUI.getState().startRest(60, 0, { adapt: 'light' }))
    expect(label()).toBe('Light set')
    act(() => useUI.getState().startRest(90, 0))
    expect(label()).toBe('Rest')
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('a paused adapted rest says Paused, as before', () => {
    act(() => useUI.getState().startRest(180, 0, { adapt: 'heavy' }))
    mount()
    act(() => useUI.getState().pauseRest())
    expect(label()).toBe('Paused')
    act(() => useUI.getState().resumeRest())
    expect(label()).toBe('Heavy set')
  })

  it('a pause between the two sides, or a made-up word, never carries it', () => {
    act(() => useUI.getState().startRest(10, 0, { kind: 'switch', adapt: 'heavy' }))
    mount()
    expect(label()).toBe('Switch sides')
    expect(useUI.getState().timer.adapt).toBeUndefined()
    act(() => useUI.getState().startRest(90, 0, { adapt: 'huge' }))
    expect(label()).toBe('Rest')
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('+15 s keeps the word, and the word survives a reload of the app', () => {
    act(() => useUI.getState().startRest(180, 0, { adapt: 'heavy' }))
    mount()
    act(() => useUI.getState().addRest(15))
    expect(label()).toBe('Heavy set')
    expect(useUI.getState().timer.total).toBe(195)
    const saved = localStorage.getItem(REST_KEY)
    expect(JSON.parse(saved).adapt).toBe('heavy')
    useStore.setState({ S: { ...useStore.getState().S, active: { id: 'x', entries: [] } } })
    act(() => useUI.setState({ timer: null }))
    localStorage.setItem(REST_KEY, saved)
    expect(restoreRest()).toBe(true)
    expect(useUI.getState().timer.adapt).toBe('heavy')
  })
})
