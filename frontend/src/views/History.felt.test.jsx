// @vitest-environment happy-dom
// A check-in belongs to its workout's sheet. Only one on a day with no saved workout (the ones logged
// before a workout had to be saved, or of a workout since deleted) gets a row in History, so it can
// still be found, changed or deleted.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import History, { historyRows } from './History.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const w = (id, d) => ({ id, d, start: Date.parse(d + 'T10:00:00Z'), end: Date.parse(d + 'T11:00:00Z'), name: 'Push', routineIds: [], entries: [{ id: '0025', sets: [{ w: 60, r: 5, done: true }] }] })
const state = extra => Object.assign(clone(DEF), { routines: [], workouts: [], dayNotes: {}, dayForm: {}, ...extra })
const roots = []

beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; useUI.setState({ sheets: [] }) })
afterEach(() => { roots.splice(0).forEach(r => act(() => r.unmount())); document.body.innerHTML = '' })

describe('History rows for check-ins', () => {
  it('a day with a check-in and a workout has only the workout row; a day without a workout has a check-in row', () => {
    const S = state({ workouts: [w('a', '2026-11-03')], dayForm: { '2026-11-03': { sleep: 4, _ts: 1 }, '2026-11-05': { sleep: 2, sore: 4, _ts: 1 } } })
    const rows = historyRows(S)
    expect(rows.map(r => [r.d, r.w ? 'workout' : r.felt ? 'felt' : 'other'])).toEqual([['2026-11-05', 'felt'], ['2026-11-03', 'workout']])
  })

  it('a cleared check-in has no row', () => {
    expect(historyRows(state({ dayForm: { '2026-11-05': { _ts: 9 } } }))).toEqual([])
  })

  it('shows the row with its answers; tapping it opens the check-in to change or delete', () => {
    useStore.setState({ S: state({ workouts: [w('a', '2026-11-03')], dayForm: { '2026-11-05': { sleep: 2, sore: 4, _ts: 1 } } }), user: null })
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    roots.push(root)
    act(() => root.render(<MemoryRouter><History /></MemoryRouter>))
    const row = [...host.querySelectorAll('.list .item')].find(r => r.textContent.includes('Check-in, no workout'))
    expect(row.querySelector('.ss').textContent).toContain('Sleep 2/5 · Soreness 4/5')
    expect(host.querySelector('.sub').textContent).toBe('1 workout')
    act(() => row.click())
    expect(useUI.getState().sheets).toHaveLength(1)
  })
})
