// @vitest-environment happy-dom
// The Home progress card: this month against the plan, a lift that moved, and a tap that opens Stats.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom'
import { DEF } from '../store/useStore.js'
import ProgressCard from './ProgressCard.jsx'

const BENCH = '0025'
const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []
let where = ''
function Probe() { where = useLocation().pathname; return null }

function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={el} /><Route path="/stats" element={<Probe />} /></Routes></MemoryRouter>))
  return host
}

// One routine on Mon/Wed/Fri. Bench logged on Sep 2, 4 and 9 with a rising estimate.
function fixture(extra = {}) {
  const st = clone(DEF)
  const bench = (d, w) => ({ id: 'w' + d, d: '2026-09-' + String(d).padStart(2, '0'), routineIds: ['A'], start: 1, name: 'Push', entries: [{ id: BENCH, sets: [{ w, r: 8, done: true }], target: { id: BENCH } }] })
  Object.assign(st, {
    unit: 'kg',
    routines: [{ id: 'A', name: 'Push', ex: [{ id: BENCH, sets: 1, reps: 8, weight: 50 }] }],
    week: { 1: ['A'], 3: ['A'], 5: ['A'] }, dayPlan: {}, active: null, dayNotes: {}, bodyweight: [],
    workouts: [bench(2, 50), bench(4, 52.5), bench(9, 55)],
  }, extra)
  return st
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = ''
  where = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.useRealTimers()
})

describe('ProgressCard', () => {
  it('shows the month against the plan and a lift', () => {
    const host = mount(<ProgressCard S={fixture()} />)
    expect(host.textContent).toContain('Your progress')
    expect(host.textContent).toContain('3 of ')
    expect(host.textContent).toContain('workouts this month')
    expect(host.textContent).toContain('barbell bench press')
    expect(host.textContent).toContain('est. 1RM')
  })

  it('opens Stats from its header', () => {
    const host = mount(<ProgressCard S={fixture()} />)
    act(() => { host.querySelector('.card-head-main').dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    expect(where).toBe('/stats')
  })

  it('renders nothing for an empty profile', () => {
    const host = mount(<ProgressCard S={fixture({ workouts: [], bodyweight: [] })} />)
    expect(host.innerHTML).toBe('')
  })
})
