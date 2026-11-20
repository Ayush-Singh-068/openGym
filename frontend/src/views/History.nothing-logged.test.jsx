// @vitest-environment happy-dom
// T2 fix round: History's header counts only the workouts with something logged, a workout with
// nothing logged reads so in its row, and the list has one heading per month.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import History from './History.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const w = (id, d, entries) => ({ id, d, start: Date.parse(d + 'T10:00:00Z'), end: Date.parse(d + 'T11:00:00Z'), name: 'Push', routineIds: [], entries })
const done = [{ w: 60, r: 5, done: true }]
const roots = []

beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; useUI.setState({ sheets: [] }) })
afterEach(() => { roots.splice(0).forEach(r => act(() => r.unmount())); document.body.innerHTML = '' })

function mount(workouts) {
  const S = Object.assign(clone(DEF), { routines: [], week: {}, dayPlan: {}, active: null, workouts, dayNotes: {}, dayForm: {} })
  useStore.setState({ S, user: null })
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  roots.push(root)
  act(() => root.render(<MemoryRouter><History /></MemoryRouter>))
  return host
}

describe('History with a workout that has nothing logged', () => {
  it('the header counts only the workouts with something logged', () => {
    const host = mount([w('a', '2026-11-18', [{ id: '0025', sets: done }]), w('b', '2026-11-17', [{ id: '0025', sets: [] }])])
    expect(host.querySelector('.hdr .sub').textContent).toBe('1 workout')
  })
  it('its row reads Nothing logged', () => {
    const host = mount([w('a', '2026-11-18', [{ id: '0025', sets: done }]), w('b', '2026-11-17', [{ id: '0025', sets: [] }])])
    const row = [...host.querySelectorAll('.list .item')].find(r => r.querySelector('.ss')?.textContent.includes('Nothing logged'))
    expect(row).toBeTruthy()
  })
  it('the list has one heading per month, newest first', () => {
    const host = mount([w('a', '2026-11-18', [{ id: '0025', sets: done }]), w('b', '2026-10-03', [{ id: '0025', sets: done }])])
    expect([...host.querySelectorAll('h4.sec')].map(h => h.textContent)).toEqual(['November 2026', 'October 2026'])
  })
})
