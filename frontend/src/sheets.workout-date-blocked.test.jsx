// @vitest-environment happy-dom
// Q13: a saved workout's date and duration cannot be changed while another workout is running (or
// being edited): the same rule, and the same words, as the Edit workout button.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { workoutDateSheet, workoutDurationSheet, workoutDetailSheet } from './sheets.jsx'
import { backfillStart } from './lib/backfill.js'
import { workoutOption } from './lib/workout-options.test-util.js'

const RUNNING = 'A workout is in progress. Finish it first, then you can edit this one.'
const EDITING = 'You are already editing a workout. Finish or discard that edit first.'
const mounted = []
let toast
const past = () => {
  const start = backfillStart('2026-08-20', '18:00')
  return { id: 'past', d: '2026-08-20', start, end: start + 3_600_000, name: 'Past', vol: 100, prs: [], entries: [{ id: 'bench', sets: [{ w: 80, r: 5, done: true }] }] }
}
const setState = patch => useStore.setState(s => ({ S: { ...s.S, workouts: [past()], active: null, ...patch } }))
const live = { id: 'live', d: '2026-11-19', start: 1, entries: [], routineIds: [] }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  toast = vi.fn()
  useUI.setState({ sheets: [], toasts: [], toast })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(r => r.unmount()) }) })

describe('date and duration of a saved workout while another one is open', () => {
  it('with a workout running, neither sheet opens and the Edit message is shown', () => {
    setState({ active: live })
    workoutDateSheet(past())
    workoutDurationSheet(past())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(toast).toHaveBeenCalledTimes(2)
    expect(toast).toHaveBeenNthCalledWith(1, RUNNING)
    expect(toast).toHaveBeenNthCalledWith(2, RUNNING)
  })

  it('while another saved workout is being edited, it says so instead', () => {
    setState({ active: { ...live, editingWorkoutId: 'other' } })
    workoutDateSheet(past())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(toast).toHaveBeenCalledWith(EDITING)
  })

  it('with nothing open, both sheets open as before', () => {
    setState({})
    workoutDateSheet(past())
    workoutDurationSheet(past())
    expect(useUI.getState().sheets).toHaveLength(2)
    expect(toast).not.toHaveBeenCalled()
  })

  it('the options menu names the reason under both rows while a workout is open, and not otherwise', () => {
    const detail = () => {
      workoutDetailSheet(past())
      const sheet = useUI.getState().sheets.at(-1)
      const host = document.createElement('div')
      document.body.appendChild(host)
      const root = createRoot(host)
      mounted.push(root)
      act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
      return host
    }
    setState({ active: live })
    let host = detail()
    expect(workoutOption(host, 'Change date & time').querySelector('.ss').textContent).toBe('Finish your workout first')
    expect(workoutOption(host, 'Change duration').querySelector('.ss').textContent).toBe('Finish your workout first')
    useUI.setState({ sheets: [] })
    setState({})
    host = detail()
    expect(workoutOption(host, 'Change date & time').querySelector('.ss')).toBeNull()
  })
})
