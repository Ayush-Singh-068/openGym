// @vitest-environment happy-dom
// Package A: the lean layouts. The warm-up ramp folds into ONE summary line that opens its rungs on
// a tap, the per-rung captions and the "Working sets" divider stay out (Cards keeps them), and each
// work set carries last time's result as a small hint. That is the Compact layout now; the List
// layout is the calm card, whose ramp is one quieter "Warm-up · 4 sets" row (last describe below).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const BENCH = '0025'

let root, container
beforeEach(() => { useUI.setState({ sheets: [], toastMsg: '', timer: null, work: null }) })
afterEach(() => { if (root) act(() => root.unmount()); container?.remove(); root = container = null })

// Strips the invisible direction marks the app puts around numbers, so text can be compared plainly.
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')

// Four ramp rungs (bar, 40%, 60%, 80%) then three work sets of 80. `known` false leaves the rung
// weights at 0 (no working weight known yet), so the summary shows percents instead of weights.
function rungs(known, done = false) {
  return [
    { w: known ? 20 : 0, r: 10, done, phase: 'warmup', warmup: true, wb: true },
    { w: known ? 32 : 0, r: 8, rMin: 6, done, phase: 'warmup', warmup: true, wp: 40 },
    { w: known ? 48 : 0, r: 5, rMin: 4, done, phase: 'warmup', warmup: true, wp: 60 },
    { w: known ? 64 : 0, r: 3, rMin: 2, done, phase: 'warmup', warmup: true, wp: 80 },
  ]
}

function mount({ view = 'list', known = true, rungsDone = false, history = true } = {}) {
  const S = clone(DEF)
  Object.assign(S, { unit: 'kg', workoutView: view })
  S.workouts = history ? [{ id: 'old', d: '2026-10-01', start: new Date('2026-10-01T17:00:00').getTime(), name: 'Push', entries: [
    { id: BENCH, target: { mode: 'reps', sets: 3, reps: 8 }, sets: [{ w: 20, r: 8, done: true }, { w: 22.5, r: 8, done: true }, { w: 25, r: 6, done: true }] },
  ] }] : []
  S.active = { id: 'a', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Push', bw: null, cur: 0, workoutView: view, entries: [
    { id: BENCH, target: { mode: 'reps', sets: 3, reps: 8 }, sets: [
      ...rungs(known, rungsDone),
      { w: 80, r: 8, done: false }, { w: 80, r: 8, done: false }, { w: 80, r: 8, done: false },
    ] },
  ] }
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
}

const tap = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

describe('compact layout: the ramp is one line', () => {
  it('shows exactly one ramp summary line with the weights, and no rung rows, captions or divider', () => {
    mount({ view: 'compact' })
    const sums = container.querySelectorAll('.rampsum')
    expect(sums).toHaveLength(1)
    expect(plain(sums[0].querySelector('.rampsum-t').textContent)).toBe('Ramp-up · bar×10 · 32×6-8 · 48×4-5 · 64×2-3')
    expect(sums[0].getAttribute('aria-expanded')).toBe('false')
    // only the three work sets are drawn as rows
    expect(container.querySelectorAll('.setrow')).toHaveLength(3)
    expect(container.querySelectorAll('.rampcap')).toHaveLength(0)
    expect(container.textContent).not.toContain('Working sets')
    expect(container.textContent).not.toContain('of working weight')
  })

  it('shows percents in place of weights when no working weight is known yet', () => {
    mount({ view: 'compact', known: false })
    expect(plain(container.querySelector('.rampsum-t').textContent)).toBe('Ramp-up · bar×10 · 40%×6-8 · 60%×4-5 · 80%×2-3')
  })

  it('a tap opens the rungs as tickable rows, a second tap folds them again', () => {
    mount({ view: 'compact' })
    tap(container.querySelector('.rampsum'))
    expect(container.querySelector('.rampsum').getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('.setrow')).toHaveLength(7)
    expect(container.querySelectorAll('.rampsum')).toHaveLength(1)
    expect(container.querySelectorAll('.rampcap')).toHaveLength(0)
    tap(container.querySelector('.rampsum'))
    expect(container.querySelectorAll('.setrow')).toHaveLength(3)
  })

  it('starts open when a rung is already ticked', () => {
    mount({ view: 'compact', rungsDone: true })
    expect(container.querySelector('.rampsum').getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('.setrow')).toHaveLength(7)
  })

  it('compact layout folds the ramp the same way', () => {
    mount({ view: 'compact' })
    expect(container.querySelectorAll('.rampsum')).toHaveLength(1)
    expect(container.querySelectorAll('.rampcap')).toHaveLength(0)
    expect(container.querySelectorAll('.setrow')).toHaveLength(3)
  })

  it('cards layout keeps the rung captions, the Ramp-up header and the Working sets divider', () => {
    mount({ view: 'cards' })
    expect(container.querySelectorAll('.rampsum')).toHaveLength(0)
    expect(container.querySelectorAll('.rampcap')).toHaveLength(4)
    expect(container.textContent).toContain('Working sets')
    expect(container.textContent).toContain('Ramp-up')
    expect(container.querySelectorAll('.lasthint')).toHaveLength(0)
    expect(container.querySelectorAll('.setrow')).toHaveLength(7)
  })
})

describe('compact layout: last time under each work set', () => {
  it('shows what the same set did last time, one hint per work set', () => {
    mount({ view: 'compact' })
    const hints = [...container.querySelectorAll('.lasthint')].map(h => plain(h.textContent))
    expect(hints).toEqual(['last 20×8', 'last 22.5×8', 'last 25×6'])
  })

  it('shows no hint when there is no history', () => {
    mount({ view: 'compact', history: false })
    expect(container.querySelectorAll('.lasthint')).toHaveLength(0)
  })

  it('puts no hint under an opened ramp rung', () => {
    mount({ view: 'compact' })
    tap(container.querySelector('.rampsum'))
    expect(container.querySelectorAll('.lasthint')).toHaveLength(3)
  })
})

describe('list layout: the ramp is one calm row', () => {
  const warmRow = () => [...container.querySelectorAll('.calm-fold')].find(b => b.textContent.startsWith('Warm-up'))
  const weights = () => [...container.querySelectorAll('.setrow')].map(r => r.querySelector('.stp.w input'))

  it('shows one closed "Warm-up · 4 sets" row and only the work sets as rows', () => {
    mount()
    expect(container.querySelectorAll('.rampsum')).toHaveLength(0)
    expect(warmRow().textContent).toBe('Warm-up · 4 sets')
    expect(warmRow().getAttribute('aria-expanded')).toBe('false')
    expect(container.querySelectorAll('.setrow')).toHaveLength(3)
    expect(container.querySelectorAll('.rampcap')).toHaveLength(0)
    expect(container.textContent).not.toContain('Working sets')
  })

  it('a tap opens the rungs as tickable rows with their kilos, a second tap folds them again', () => {
    mount()
    tap(warmRow())
    expect(warmRow().getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('.setrow')).toHaveLength(7)
    expect(weights().map(i => i.value)).toEqual(['20', '32', '48', '64', '80', '80', '80'])
    tap(warmRow())
    expect(container.querySelectorAll('.setrow')).toHaveLength(3)
  })

  it('a rung shows its share of the working weight in place of a 0 until the weight is known', () => {
    mount({ known: false })
    tap(warmRow())
    expect(weights().slice(0, 4).map(i => [i.value, i.placeholder])).toEqual([['', 'bar'], ['', '40%'], ['', '60%'], ['', '80%']])
  })

  it('starts open when a rung is already ticked', () => {
    mount({ rungsDone: true })
    expect(warmRow().getAttribute('aria-expanded')).toBe('true')
    expect(container.querySelectorAll('.setrow')).toHaveLength(7)
  })

  it('puts no last-time hint under the rows: it is one line under the name, and not in Details', () => {
    mount()
    expect(container.querySelectorAll('.lasthint')).toHaveLength(0)
    expect(container.querySelector('.calm-last').textContent).toContain('Last time')
    tap([...container.querySelectorAll('.calm-fold')].find(b => b.textContent === 'Details'))
    expect(container.querySelector('.refline')).toBeNull()
  })
})
