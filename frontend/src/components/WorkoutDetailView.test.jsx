// @vitest-environment happy-dom
// The saved workout sheet body: header, exercise cards, "vs last time", the note and the actions.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkoutDetailView from './WorkoutDetailView.jsx'
import { DEF, useStore } from '../store/useStore.js'
import * as sheets from '../sheets.jsx'

// The sheets module is mocked: its helpers are added to it by the integration step, and these
// tests only check that the view calls them.
vi.mock('../sheets.jsx', () => ({
  menuSheet: vi.fn(), confirmSheet: vi.fn(), exerciseDetailSheet: vi.fn(), exerciseHistorySheet: vi.fn(),
  workoutDateSheet: vi.fn(), workoutDurationSheet: vi.fn(), shareWorkoutSheet: vi.fn(), repeatWorkout: vi.fn(),
  AutoEndedNote: () => null, mediaGoesToo: () => '', saveFitFile: vi.fn(),
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const at = iso => new Date(iso + 'T18:00:00').getTime()

let root, container
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); root = container = null })

// Two bench sessions (the second one has a warm-up and a PR) and a Push routine.
const earlier = { id: 'a', d: '2026-10-01', name: 'Push', start: at('2026-10-01'), end: at('2026-10-01') + 3600000, routineIds: ['r1'], entries: [
  { id: '0025', sets: [{ w: 100, r: 5, done: true }] },
] }
const today = { id: 'b', d: '2026-10-08', name: 'Push', start: at('2026-10-08'), end: at('2026-10-08') + 3600000, routineIds: ['r1'], prs: ['0025'], note: 'Felt good', entries: [
  { id: '0025', sets: [{ w: 20, r: 10, done: true, phase: 'warmup' }, { w: 105, r: 5, done: true, rir: 2 }] },
  { id: '0043', sets: [{ w: 40, r: 10, done: true }] },
] }

function mount(workouts = [earlier, today], patch = {}) {
  const S = clone(DEF)
  Object.assign(S, { workouts, routines: [{ id: 'r1', name: 'Push', emoji: '💪', sets: [] }] }, patch)
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<WorkoutDetailView w={today} close={() => {}} />))
}
const button = text => [...container.querySelectorAll('button')].find(b => b.textContent.includes(text))

describe('WorkoutDetailView', () => {
  it('shows the routine name, the volume and the PR count in the header', () => {
    mount()
    expect(container.querySelector('h3').textContent).toBe('Push')
    expect(container.querySelector('.wdv-stat.pr-tile').textContent).toContain('1')
    // 105 x 5 and 40 x 10; the warm-up is not counted
    expect(container.querySelector('.wdv-stats').textContent).toContain('925 kg')
  })

  it('renders one exercise card per entry, in order', () => {
    mount()
    const cards = [...container.querySelectorAll('.wd-ex')]
    expect(cards).toHaveLength(2)
    expect(cards[0].querySelector('.wdv-card-title').textContent).toContain('1 set · 525 kg')
    expect(cards[1].querySelector('.wdv-card-title').textContent).toContain('400 kg')
  })

  it('marks the warm-up row and numbers it apart from the work sets', () => {
    mount()
    const warm = container.querySelector('.wdv-set.warm')
    expect(warm).not.toBeNull()
    expect(warm.textContent).toContain('Warm-up')
    const work = [...container.querySelector('.wd-ex').querySelectorAll('.wdv-set:not(.warm) .wdv-n')].map(td => td.textContent)
    expect(work).toEqual(['1'])
  })

  it('reads the top set against last time as +5 kg', () => {
    mount()
    const vs = container.querySelector('.wdv-vs')
    expect(vs.textContent).toContain('+5 kg on the best set')
    expect(vs.classList.contains('up')).toBe(true)
  })

  it('shows the estimated 1RM of the top set', () => {
    mount()
    expect(container.querySelector('.wdv-e1rm').textContent).toContain('Est. 1RM')
  })

  it('opens the exercise history when its title is tapped', () => {
    mount()
    act(() => container.querySelector('.wdv-card-title').click())
    expect(sheets.exerciseHistorySheet).toHaveBeenCalledWith('0025')
  })

  it('offers Edit workout, Repeat today and the workout options', () => {
    mount()
    expect(button('Edit workout')).toBeTruthy()
    expect(button('Repeat today')).toBeTruthy()
    expect(container.querySelector('[data-tour="wd-options"]')).not.toBeNull()
  })

  it('saves a typed session note on blur, stamped', () => {
    mount()
    const area = container.querySelector('textarea[data-tour="wd-note"]')
    expect(area.value).toBe('Felt good')
    act(() => {
      const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set
      set.call(area, 'Felt strong')
      area.dispatchEvent(new Event('input', { bubbles: true }))
    })
    act(() => area.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
    const saved = useStore.getState().S.workouts.find(x => x.id === 'b')
    expect(saved.note).toBe('Felt strong')
    expect(saved._ts).toBeGreaterThan(0)
  })
})
