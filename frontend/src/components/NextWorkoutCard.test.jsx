// @vitest-environment happy-dom
// The Home card for the next session: today's plan with Start and Skip, the next day once today is
// done, the skip state, and the resume line while a session runs.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import NextWorkoutCard from './NextWorkoutCard.jsx'

const startOrPreview = vi.fn()
vi.mock('./StartSheets.jsx', () => ({ startOrPreview: (...a) => startOrPreview(...a) }))

const BENCH = '0025'
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []

function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<MemoryRouter>{el}</MemoryRouter>))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

// Wednesday 16 September 2026: Push is planned on Monday, Wednesday and Friday.
function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    unit: 'kg',
    routines: [{ id: 'A', name: 'Push', emoji: 'dumbbell', ex: [{ id: BENCH, sets: 3, reps: 8, weight: 20, prog: 'off' }] }],
    week: { 1: ['A'], 3: ['A'], 5: ['A'] }, dayPlan: {}, active: null, workouts: [], weighIn: false, dayNotes: {},
  }, extra)
  useStore.setState({ S: st, user: null })
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toasts: [] })
  document.body.innerHTML = ''
  startOrPreview.mockClear()
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.useRealTimers()
})

describe('NextWorkoutCard', () => {
  it('shows the first exercise line with the session size, Start and Skip', () => {
    const host = mount(<NextWorkoutCard S={S()} />)
    expect(host.textContent).toContain('1 exercise')
    expect(host.textContent).toContain('barbell bench press')
    expect(button(host, 'Start')).toBeTruthy()
    expect(button(host, 'Skip')).toBeTruthy()
  })

  it('Start hands today’s routine ids to the start flow', () => {
    const host = mount(<NextWorkoutCard S={S()} />)
    click(button(host, 'Start'))
    expect(startOrPreview).toHaveBeenCalledWith(['A'])
  })

  it('Skip opens the skip sheet for today', () => {
    const host = mount(<NextWorkoutCard S={S()} />)
    click(button(host, 'Skip'))
    expect(useUI.getState().sheets.length).toBe(1)
  })

  it('after today’s workout it shows the next training day and no Skip', () => {
    install({ workouts: [{ id: 'w1', d: '2026-09-16', routineIds: ['A'], entries: [] }] })
    const host = mount(<NextWorkoutCard S={S()} />)
    expect(host.textContent).toContain('Next: Friday')
    expect(button(host, 'Start now')).toBeTruthy()
    expect(button(host, 'Skip')).toBeUndefined()
  })

  it('a running session leaves the row above to resume it and offers nothing here', () => {
    install({ active: { id: 'x', d: '2026-09-16', name: 'Push', start: 1, entries: [] } })
    const host = mount(<NextWorkoutCard S={S()} />)
    expect(host.innerHTML).toBe('')
  })

  it('a skipped day offers the undo and the next day', () => {
    install({ dayNotes: { '2026-09-16': { tag: 'busy', text: '' } } })
    const host = mount(<NextWorkoutCard S={S()} />)
    const undo = button(host, 'Undo skip')
    expect(undo).toBeTruthy()
    click(undo)
    expect(useUI.getState().sheets.length).toBe(1)
    expect(host.textContent).toContain('Next: Friday')
    expect(button(host, 'Skip')).toBeUndefined()
  })

  it('stays out of the way on a split day', () => {
    const host = mount(<NextWorkoutCard S={S()} hidden />)
    expect(host.innerHTML).toBe('')
  })

  it('renders nothing with no routines', () => {
    install({ routines: [], week: {} })
    const host = mount(<NextWorkoutCard S={S()} />)
    expect(host.innerHTML).toBe('')
  })
})
