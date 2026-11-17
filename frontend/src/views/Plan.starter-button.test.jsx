// @vitest-environment happy-dom
// The starter plans were only one tap away with no routines (the empty state) or in the ⋯ menu.
// With routines, the Routines tab shows a button for them beside New routine too.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Plan from './Plan.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const mocks = vi.hoisted(() => {
  const state = { S: null }
  state.snapshot = () => ({
    S: state.S,
    user: null,
    update: mut => { const next = structuredClone(state.S); mut(next); state.S = next },
  })
  return state
})
vi.mock('../store/useStore.js', () => {
  const useStore = selector => (selector ? selector(mocks.snapshot()) : mocks.snapshot())
  useStore.getState = mocks.snapshot
  return { useStore, DEF: { reminder: { time: '17:30' } }, hasData: () => false }
})
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false, isAndroid: () => Promise.resolve(false), shareExport: vi.fn(), syncReminder: vi.fn() }))
const starterPlanSheet = vi.hoisted(() => vi.fn())
vi.mock('../sheets.jsx', () => ({ starterPlanSheet, dayAssignSheet: vi.fn() }))

let host, root
beforeEach(() => {
  starterPlanSheet.mockClear()
  localStorage.clear()
  localStorage.setItem('gym_plan_view', 'routines')
  mocks.S = { unit: 'kg', workouts: [], exWeights: {}, week: {}, dayPlan: {}, routines: [{ id: 'a', name: 'Push A', ex: [] }] }
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const buttons = () => [...host.querySelectorAll('.plan-routines-bar button')]
const label = b => b.textContent.trim()

describe('Plan starter plans button', () => {
  it('shows Starter plans beside New routine when routines exist', () => {
    act(() => root.render(<Plan />))
    expect(buttons().map(label)).toEqual(['Edit', 'Starter plans', 'New routine'])
    act(() => buttons()[1].click())
    expect(starterPlanSheet).toHaveBeenCalledTimes(1)
  })

  it('keeps the empty state as it was when there are no routines', () => {
    mocks.S = { ...mocks.S, routines: [] }
    localStorage.removeItem('gym_plan_view')   // the default view, where the empty state lives
    act(() => root.render(<Plan />))
    expect([...host.querySelectorAll('.plan-empty button')].map(label)).toEqual(['Load starter plan', 'New routine'])
  })
})
