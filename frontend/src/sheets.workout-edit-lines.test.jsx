// @vitest-environment happy-dom
// The "Save these changes?" question lists every change to a saved workout: warm-ups, sets that are
// no longer ticked, and sets taken out, each in words (Q12).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { saveWorkoutEdits } from './sheets.jsx'
import { setNav } from './lib/nav.js'
import { EXDB } from './lib/exercises.js'
import { editCompletedSession } from './lib/session-edit.js'

const clone = v => JSON.parse(JSON.stringify(v))
const LIFT = EXDB.find(e => e.bp !== 'cardio').id
const mounted = []
const mountTop = () => {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const lines = host => [...host.querySelectorAll('li')].map(li => li.textContent)

const saved = () => ({
  id: 'w-old', d: '2026-04-15', start: 1, end: 2, name: 'Push Day 1', prs: [],
  entries: [{ id: LIFT, target: { mode: 'reps', reps: 8 }, sets: [
    { w: 20, r: 10, done: true, phase: 'warmup' },
    { w: 60, r: 8, done: true },
    { w: 60, r: 8, done: true },
  ] }],
})
const edit = change => {
  act(() => useStore.getState().update(s => { editCompletedSession(s, 'w-old'); change(s.active.entries[0].sets) }))
  act(() => saveWorkoutEdits())
  return lines(mountTop())
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  setNav(() => {})
  useUI.setState({ sheets: [], toastMsg: '' })
  const st = clone(DEF)
  Object.assign(st, { unit: 'kg', routines: [], workouts: [saved()], active: null })
  useStore.setState({ S: st, user: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('what the save question lists', () => {
  it('a corrected work weight and an unticked warm-up are two lines', () => {
    const out = edit(sets => { sets[1].w = 62.5; sets[0].done = false })
    expect(out.some(l => l.includes('set 1: 60 kg × 8 → 62.5 kg × 8'))).toBe(true)
    expect(out.some(l => l.includes('warm-up 1 unticked (was 20 kg × 10)'))).toBe(true)
  })

  it('a removed warm-up and a removed set are listed', () => {
    const out = edit(sets => { sets.splice(0, 1); sets.pop() })
    expect(out.some(l => l.includes('warm-up 1 removed (was 20 kg × 10)'))).toBe(true)
    expect(out.some(l => l.includes('set 2 removed (was 60 kg × 8)'))).toBe(true)
  })

  it('an added warm-up, an unticked set and a ticked warm-up are listed', () => {
    const out = edit(sets => { sets.splice(1, 0, { w: 40, r: 5, done: true, phase: 'warmup' }); sets[2].done = false })
    expect(out.some(l => l.includes('warm-up 2 added: 40 kg × 5'))).toBe(true)
    expect(out.some(l => l.includes('set 1 unticked (was 60 kg × 8)'))).toBe(true)
  })
})
