// @vitest-environment happy-dom
// Saving an edit to a past workout shows what changes first (the next targets come from history),
// a note-only edit saves at once, and a workout cannot be edited while another session is open.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { saveWorkoutEdits, workoutDetailSheet } from './sheets.jsx'
import { setNav } from './lib/nav.js'
import { EXDB } from './lib/exercises.js'
import { editCompletedSession } from './lib/session-edit.js'
import { exerciseNameFor } from './lib/i18n.js'
import { exOr } from './lib/exercises.js'

const clone = v => JSON.parse(JSON.stringify(v))
const LIFTS = EXDB.filter(e => e.bp !== 'cardio').slice(0, 10).map(e => e.id)
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
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const S = () => useStore.getState().S

const saved = (ids = LIFTS.slice(0, 1)) => ({
  id: 'w-old', d: '2026-09-10', start: 1, end: 2, name: 'Push', prs: [],
  entries: ids.map(id => ({ id, target: { mode: 'reps', reps: 8 }, sets: [{ w: 40, r: 5, done: true }] })),
})

let navigated
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  navigated = []
  setNav(to => { navigated.push(to) })
  useUI.setState({ sheets: [], toastMsg: '' })
  const st = clone(DEF)
  Object.assign(st, { unit: 'kg', routines: [], workouts: [saved()], active: null })
  useStore.setState({ S: st, user: null })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('confirm before saving an edit', () => {
  it('a changed weight opens a summary; the record is unchanged until Save changes; Keep editing stays in the editor', () => {
    act(() => useStore.getState().update(s => { editCompletedSession(s, 'w-old'); s.active.entries[0].sets[0].w = 50 }))
    act(() => saveWorkoutEdits())
    const host = mountTop()
    expect(host.querySelector('h3').textContent).toBe('Save these changes?')
    const name = exerciseNameFor(exOr(LIFTS[0]))
    expect(host.textContent).toContain(name)
    expect(host.textContent).toContain('set 1')
    expect(host.textContent).toContain('40 kg')
    expect(host.textContent).toContain('50 kg')
    expect(host.textContent).toContain('Your next targets will be worked out from this change.')
    expect(S().workouts[0].entries[0].sets[0].w).toBe(40)

    act(() => { button(host, 'Keep editing').click() })
    expect(S().active.editingWorkoutId).toBe('w-old')
    expect(S().workouts[0].entries[0].sets[0].w).toBe(40)
  })

  it('Save changes writes the edit and leaves the editor', () => {
    act(() => useStore.getState().update(s => { editCompletedSession(s, 'w-old'); s.active.entries[0].sets[0].w = 50 }))
    act(() => saveWorkoutEdits())
    const host = mountTop()
    act(() => { button(host, 'Save changes').click() })
    expect(S().active).toBeNull()
    expect(S().workouts[0].entries[0].sets[0].w).toBe(50)
    expect(useUI.getState().toastMsg).toBe('Workout updated')
    expect(navigated).toEqual(['/history'])
  })

  it('a note-only edit saves at once, with no sheet', () => {
    act(() => useStore.getState().update(s => { editCompletedSession(s, 'w-old'); s.active.note = 'felt strong' }))
    act(() => saveWorkoutEdits())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().active).toBeNull()
    expect(S().workouts[0].note).toBe('felt strong')
  })

  it('more than eight changes list eight and then "+ N more changes"', () => {
    const st = clone(DEF)
    Object.assign(st, { unit: 'kg', routines: [], workouts: [saved(LIFTS)], active: null })
    useStore.setState({ S: st, user: null })
    act(() => useStore.getState().update(s => {
      editCompletedSession(s, 'w-old')
      s.active.entries.forEach(e => { e.sets[0].w = 50 })
    }))
    act(() => saveWorkoutEdits())
    const text = mountTop().textContent
    expect(text).toContain('+ 2 more changes')
    expect(text.match(/set 1: 40 kg × 5 → 50 kg × 5/g)).toHaveLength(8)
  })
})

describe('a workout cannot be edited while another session is open', () => {
  const running = () => {
    const st = clone(DEF)
    Object.assign(st, { unit: 'kg', routines: [], workouts: [saved()], active: { id: 'live', d: '2026-09-16', start: 1, entries: [], routineIds: [] } })
    useStore.setState({ S: st, user: null })
  }

  it('shows the reason and an Open running workout button that goes to the workout, with no Edit button', () => {
    running()
    act(() => workoutDetailSheet(S().workouts[0]))
    const host = mountTop()
    expect(host.querySelector('[data-testid="wd-edit-blocked"]').textContent)
      .toBe('A workout is in progress. Finish it first, then you can edit this one.')
    expect(button(host, 'Edit workout')).toBeUndefined()
    act(() => { button(host, 'Open running workout').click() })
    expect(navigated).toEqual(['/workout'])
  })

  it('while an edit is open it says so, and offers the way back into it', () => {
    const st = clone(DEF)
    Object.assign(st, { unit: 'kg', routines: [], workouts: [saved()], active: null })
    useStore.setState({ S: st, user: null })
    act(() => useStore.getState().update(s => { editCompletedSession(s, 'w-old') }))
    act(() => workoutDetailSheet(S().workouts[0]))
    const host = mountTop()
    expect(host.querySelector('[data-testid="wd-edit-blocked"]').textContent)
      .toBe('You are already editing a workout. Finish or discard that edit first.')
    expect(button(host, 'Open the edit')).toBeTruthy()
  })
})
