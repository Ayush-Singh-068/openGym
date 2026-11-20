// @vitest-environment happy-dom
// T2 fix round: the saved workout sheet counts done warm-up sets only, so the sets of a warm-up
// exercise (lib/warmup-exercises.js) are neither work nor "+N warm-up sets". And its Body weight tile
// is left out when "Weight that day" shows the same number.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WorkoutDetailView from './WorkoutDetailView.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { registerWarmupExercises } from '../lib/warmup-exercises.js'

vi.mock('../sheets.jsx', () => ({
  menuSheet: vi.fn(), confirmSheet: vi.fn(), exerciseDetailSheet: vi.fn(), exerciseHistorySheet: vi.fn(),
  workoutDateSheet: vi.fn(), workoutDurationSheet: vi.fn(), shareWorkoutSheet: vi.fn(), repeatWorkout: vi.fn(),
  AutoEndedNote: () => null, mediaGoesToo: () => '', saveFitFile: vi.fn(),
}))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const day = '2026-10-08'
const at = iso => new Date(iso + 'T18:00:00').getTime()
const bench = [
  { w: 20, r: 10, done: true, phase: 'warmup' },
  { w: 40, r: 5, done: true, phase: 'warmup' },
  ...Array.from({ length: 13 }, () => ({ w: 60, r: 5, done: true })),
]
const band = [{ w: 0, r: 15, done: true }, { w: 0, r: 15, done: true }]
const workout = (entries, extra = {}) => ({ id: 'w', d: day, name: 'Push', start: at(day), end: at(day) + 3600000, routineIds: ['r1'], entries, ...extra })

let root, container
afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  root = container = null
  registerWarmupExercises({})
})

function mount(w, bodyweight = []) {
  const S = JSON.parse(JSON.stringify(DEF))
  Object.assign(S, { workouts: [w], routines: [{ id: 'r1', name: 'Push', emoji: '💪', sets: [] }], bodyweight })
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<WorkoutDetailView w={w} close={() => {}} />))
}
const statTile = label => [...container.querySelectorAll('.wdv-stat')].find(el => el.querySelector('span')?.textContent === label)
const statLabels = () => [...container.querySelectorAll('.wdv-stat span')].map(s => s.textContent)

describe('the saved workout sheet counts', () => {
  it('13 work sets and 2 warm-up sets; a warm-up exercise adds to neither', () => {
    registerWarmupExercises({ 1503: true })
    mount(workout([{ id: '0025', sets: bench }, { id: '1503', sets: band }]))
    expect(statTile('Sets').querySelector('b').textContent).toBe('13')
    // the warm-up count is its own line under the numbers, not a wider tile that squeezes Volume
    expect(container.querySelector('.wdv-warm').textContent).toBe('+2 warm-up sets')
  })
})

describe('the Body weight tile', () => {
  it('is left out when the day\'s weigh-in is the same number', () => {
    mount(workout([{ id: '0025', sets: bench }], { bw: 81.8 }), [{ d: day, w: 81.8, t: at(day) }])
    expect(statLabels()).not.toContain('Body weight')
    expect(container.textContent).toContain('Weight that day')
  })
  it('is shown when the day has a different weigh-in', () => {
    mount(workout([{ id: '0025', sets: bench }], { bw: 81.8 }), [{ d: day, w: 80.2, t: at(day) }])
    expect(statLabels()).toContain('Body weight')
  })
})
