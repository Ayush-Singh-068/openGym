// @vitest-environment happy-dom
// Gym mode on the workout screen: the .gym root, one-tap ticks with no typo question, Complete as
// planned with its Undo, what the rest bar says is next, the workout-done cue, and the screen-awake
// chip and note.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { playCueIf } from '../lib/cue-sounds.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../lib/cue-sounds.js', async importOriginal => ({ ...(await importOriginal()), playCueIf: vi.fn(() => true) }))
const awake = vi.hoisted(() => ({ status: 'idle' }))
vi.mock('../lib/wakelock.js', () => ({ useWakeLockStatus: () => awake.status, useWakeLock: () => {}, wakeLockSupported: () => false }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))

const BENCH = '0025'
const entry = sets => ({ id: BENCH, target: { sets: sets.length, reps: 8, mode: 'reps' }, sets })
const past = sets => ({ id: 'w1', d: '2026-10-01', start: 1, entries: [{ id: BENCH, sets }] })
const three = () => [{ w: 80, r: 8, done: false }, { w: 80, r: 8, done: false }, { w: 80, r: 8, done: false }]

let roots = []
beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, timer: null, work: null, awakeDismissed: false })
  awake.status = 'idle'
  playCueIf.mockClear()
})
afterEach(() => {
  for (const [root, el] of roots) { act(() => root.unmount()); el.remove() }
  roots = []
  useUI.getState().stopRest()
})
function render(node) {
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(node))
  roots.push([root, el])
  return el
}
function mount(sets, { workouts = [], gym = {}, view = 'list', more = [] } = {}) {
  const S = clone(DEF)
  S.unit = 'kg'
  S.workoutView = view
  S.workouts = workouts
  Object.assign(S, { gymMode: true, gymOpts: { big: true, asPlanned: true, next: true, awake: true } }, gym)
  S.active = { id: 'gym-test', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Gym', bw: null, cur: 0, entries: [entry(sets), ...more], workoutView: view }
  useStore.setState({ S, user: null })
  return render(<MemoryRouter><Workout /></MemoryRouter>)
}
const tick = (el, n = 1) => act(() => el.querySelector(`[aria-label^="Set ${n} done"]`).click())
const setAt = i => useStore.getState().S.active.entries[0].sets[i]
const button = (el, text) => [...el.querySelectorAll('button')].find(b => b.textContent === text)
const sheet = () => render(useUI.getState().sheets.at(-1).render(() => {}))

describe('Big buttons', () => {
  it('the workout root carries .gym and the page body .gym-big while the part is on', () => {
    const el = mount(three())
    expect(el.querySelector('.narrow').classList.contains('gym')).toBe(true)
    expect(document.body.classList.contains('gym-big')).toBe(true)
  })

  it('neither with Gym mode off, nor with Big buttons off', () => {
    let el = mount(three(), { gym: { gymMode: false } })
    expect(el.querySelector('.narrow').classList.contains('gym')).toBe(false)
    expect(document.body.classList.contains('gym-big')).toBe(false)
    el = mount(three(), { gym: { gymOpts: { big: false } } })
    expect(el.querySelector('.narrow').classList.contains('gym')).toBe(false)
  })
})

describe('one tap as planned', () => {
  const history = [past([{ w: 30, r: 8, done: true }])]

  it('ticks a set that carries what the app filled in with no question, even when it looks off', () => {
    const el = mount([{ w: 300, r: 8, done: false }, { w: 300, r: 8, done: false }], { workouts: history })
    tick(el)
    expect(setAt(0).done).toBe(true)
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('still asks about a weight typed or stepped by hand', () => {
    const el = mount([{ w: 300, r: 8, done: false }, { w: 300, r: 8, done: false }], { workouts: history })
    act(() => el.querySelector('.setrow .stp.w button[aria-label*=": Increase"]').click())
    expect(setAt(0).w).toBeGreaterThan(300)
    tick(el)
    expect(setAt(0).done).toBe(false)
    expect(sheet().textContent).toContain('is more than twice your heaviest')
  })

  it('asks as before with the part switched off', () => {
    const el = mount([{ w: 300, r: 8, done: false }, { w: 300, r: 8, done: false }], { workouts: history, gym: { gymOpts: { asPlanned: false } } })
    tick(el)
    expect(setAt(0).done).toBe(false)
    expect(sheet().textContent).toContain('is more than twice your heaviest')
  })
})

describe('Complete as planned', () => {
  it('ticks every open working set, starts one rest, and the Undo puts them back', () => {
    // A second exercise with a set to do, so the workout is not over and the last tick rests.
    const el = mount(three(), { more: [entry([{ w: 60, r: 8, done: false }])] })
    act(() => button(el, 'Complete as planned').click())
    expect([0, 1, 2].map(i => setAt(i).done)).toEqual([true, true, true])
    expect(useUI.getState().toastMsg).toBe('Sets done as planned: 3')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    // One rest, for the last set, so the final tick is the one that rests.
    expect(useUI.getState().timer.forSet).toBe(2)
    act(() => useUI.getState().runToastAction())
    expect([0, 1, 2].map(i => setAt(i).done)).toEqual([false, false, false])
    expect(useUI.getState().timer).toBeNull()
    expect(button(el, 'Complete as planned')).toBeTruthy()
  })

  it('takes only the sets still open, and leaves a warm-up alone', () => {
    const sets = [{ w: 20, r: 10, done: false, phase: 'warmup', warmup: true }, { w: 80, r: 8, done: true }, { w: 80, r: 8, done: false }, { w: 80, r: 8, done: false }]
    const el = mount(sets)
    act(() => button(el, 'Complete as planned').click())
    expect([0, 1, 2, 3].map(i => setAt(i).done)).toEqual([false, true, true, true])
    expect(useUI.getState().toastMsg).toBe('Sets done as planned: 2')
    act(() => useUI.getState().runToastAction())
    expect([0, 1, 2, 3].map(i => setAt(i).done)).toEqual([false, true, false, false])
  })

  it('is in Cards and Compact too, and not with the part off, Gym mode off, or nothing left to tick', () => {
    expect(button(mount(three(), { view: 'cards' }), 'Complete as planned')).toBeTruthy()
    expect(button(mount(three(), { view: 'compact' }), 'Complete as planned')).toBeTruthy()
    expect(button(mount(three(), { gym: { gymOpts: { asPlanned: false } } }), 'Complete as planned')).toBeUndefined()
    expect(button(mount(three(), { gym: { gymMode: false } }), 'Complete as planned')).toBeUndefined()
    expect(button(mount([{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }]), 'Complete as planned')).toBeUndefined()
  })
})

describe('the rest after a tick says what is next', () => {
  it('names the next set, and the kind for the end-of-rest cue', () => {
    const el = mount(three())
    tick(el)
    expect(useUI.getState().timer.next).toBe('Next: set 2 · 80 kg × 8')
    expect(useUI.getState().timer.nextKind).toBe('set')
  })

  it('marks the last set of the exercise', () => {
    const el = mount(three())
    tick(el, 1)
    tick(el, 2)
    expect(useUI.getState().timer.next).toBe('Next: set 3 · 80 kg × 8 · Last set')
    expect(useUI.getState().timer.nextKind).toBe('last')
  })

  it('has no line with Show what’s next off', () => {
    const el = mount(three(), { gym: { gymOpts: { next: false } } })
    tick(el)
    expect(useUI.getState().timer.next).toBeUndefined()
    expect(useUI.getState().timer.nextKind).toBe('set')
  })
})

describe('Show what’s next scrolls the next set into view', () => {
  const rowsScrolled = scroll => scroll.mock.contexts.filter(c => c.matches?.('.setrow')).map(c => c.dataset.set)

  it('after a tick, the next open set comes to the middle of the screen', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const el = mount(three())
    scroll.mockClear()
    tick(el)
    expect(rowsScrolled(scroll)).toContain('1')
    expect(scroll).toHaveBeenCalledWith({ block: 'center', behavior: 'smooth' })
  })

  it('does not with the part off', () => {
    const scroll = vi.fn()
    Element.prototype.scrollIntoView = scroll
    const el = mount(three(), { gym: { gymOpts: { next: false } } })
    scroll.mockClear()
    tick(el)
    expect(rowsScrolled(scroll)).toEqual([])
  })
})

describe('the workout-done cue', () => {
  it('plays when the last set of the workout is ticked, and not before', () => {
    const el = mount([{ w: 80, r: 8, done: false }, { w: 80, r: 8, done: false }])
    tick(el, 1)
    expect(playCueIf.mock.calls.filter(c => c[1] === 'workoutDone')).toHaveLength(0)
    tick(el, 2)
    expect(playCueIf.mock.calls.filter(c => c[1] === 'workoutDone')).toHaveLength(1)
  })
})

describe('Screen-awake notice', () => {
  it('shows "Screen on" in the header while the screen is kept on', () => {
    awake.status = 'held'
    const el = mount(three())
    expect(el.querySelector('.whdr-awake').textContent).toBe('Screen on')
    expect(el.querySelector('.gym-awake-note')).toBeNull()
  })

  it('shows the one-time note when the lock could not be had, and Dismiss closes it', () => {
    awake.status = 'problem'
    const el = mount(three())
    expect(el.querySelector('.whdr-awake')).toBeNull()
    expect(el.querySelector('.gym-awake-note').textContent).toContain('Your phone may lock the screen. Rest sounds will not play while it is locked. Low Power Mode on iPhone stops the app keeping the screen on.')
    act(() => el.querySelector('.gym-awake-note button[aria-label="Dismiss"]').click())
    expect(el.querySelector('.gym-awake-note')).toBeNull()
    expect(useUI.getState().awakeDismissed).toBe(true)
  })

  it('shows neither with the part off or Gym mode off', () => {
    awake.status = 'held'
    expect(mount(three(), { gym: { gymOpts: { awake: false } } }).querySelector('.whdr-awake')).toBeNull()
    awake.status = 'problem'
    expect(mount(three(), { gym: { gymMode: false } }).querySelector('.gym-awake-note')).toBeNull()
  })
})
