// @vitest-environment happy-dom
// The Home week strip reads each day's status (lib/day-status.js), and the Calendar button opens /calendar.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from '../store/useStore.js'
import Home from './Home.jsx'

const navigate = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('../sheets.jsx', () => ({
  starterPlanSheet: vi.fn(), bwSheet: vi.fn(), goalSheet: vi.fn(), dayOverrideSheet: vi.fn(),
  calendarSheet: vi.fn(), startFlow: vi.fn(), bwDeltaColor: () => '', weighInsSheet: vi.fn(), exerciseNameFor: x => x,
}))

let host, root
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  navigate.mockClear()
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.useRealTimers() })

const routines = [{ id: 'A', name: 'Push', ex: [] }]
function mountWith(patch) {
  useStore.setState(s => ({ S: { ...s.S, routines, workouts: [], bodyweight: [], dayPlan: {}, dayNotes: {}, week: { 1: ['A'], 3: ['A'], 5: ['A'] }, active: null, queue: null, rotation: null, scheduleMode: null, weekStart: 1, ...patch }, user: null }))
  act(() => root.render(<Home />))
}
// The seven day cells of the shown week, in order (Monday first).
const days = () => [...host.querySelectorAll('.wday')]

describe('Home week strip statuses', () => {
  it('marks a missed scheduled day, a trained day, and a skipped day with its icon', () => {
    mountWith({
      workouts: [
        { id: 'w0', d: '2026-09-07', routineIds: ['A'], entries: [{ id: '0025', sets: [{ w: 60, r: 5, done: true }] }] },
        { id: 'w1', d: '2026-09-16', routineIds: ['A'], entries: [{ id: '0025', sets: [{ w: 60, r: 5, done: true }] }] },
      ],
      dayNotes: { '2026-09-18': { tag: 'travel', _ts: 1 } },
    })
    const cells = days()
    expect(cells).toHaveLength(7)
    expect(cells[0].querySelector('.dot.missed')).not.toBeNull()
    expect(cells[2].querySelector('.dot.done')).not.toBeNull()
    expect(cells[4].querySelector('svg')).not.toBeNull()
    expect(cells[4].querySelector('.dot')).toBeNull()
  })

  it('the Calendar button navigates to /calendar', () => {
    mountWith({})
    const btn = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Calendar')
    expect(btn).toBeTruthy()
    act(() => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(navigate).toHaveBeenCalledWith('/calendar')
  })
})
