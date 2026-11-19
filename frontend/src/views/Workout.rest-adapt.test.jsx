// @vitest-environment happy-dom
// Adaptive rest on the workout screen (Phase 1b N6): ticking a set starts the rest that fits it (a heavy set
// of a big lift twice the Rest timer, a light one two thirds, a normal one as it was), the bar is told which,
// and the Lock Screen forecast says the same number before the tick.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { upcomingSets } from '../lib/live-activity.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../lib/wakelock.js', () => ({ useWakeLockStatus: () => 'held', useWakeLock: () => {}, wakeLockSupported: () => false }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))

const BENCH = '0025'   // barbell bench press
const row = r => ({ w: 100, r, done: false })
const entry = (id, reps, target = {}) => ({ id, target: { mode: 'reps', sets: 3, reps, weight: 100, ...target }, sets: [row(reps), row(reps), row(reps)] })

let roots = []
beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, timer: null, work: null })
})
afterEach(() => {
  for (const [root, el] of roots) { act(() => root.unmount()); el.remove() }
  roots = []
  useUI.getState().stopRest()
})
function mount(entries, patch = {}) {
  const S = clone(DEF)
  S.unit = 'kg'
  S.workoutView = 'list'
  Object.assign(S, { gymMode: true, gymOpts: { big: true, asPlanned: true, next: true, awake: true } }, patch)
  S.active = { id: 'rest-adapt-test', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Rest', bw: null, cur: 0, entries, workoutView: S.workoutView }
  useStore.setState({ S, user: null })
  const el = document.createElement('div')
  document.body.appendChild(el)
  const root = createRoot(el)
  act(() => root.render(<MemoryRouter><Workout /></MemoryRouter>))
  roots.push([root, el])
  return el
}
const tick = (el, n) => act(() => el.querySelector(`[aria-label^="Set ${n} done"]`).click())

describe('the rest after a tick fits the set', () => {
  it('a heavy set (5 reps of a big lift) rests twice the Rest timer, and the bar says so', () => {
    const el = mount([entry(BENCH, 5)])
    expect(upcomingSets(useStore.getState().S).map(x => x.restAfter)).toEqual([180, 180, 180])
    tick(el, 1)
    expect(useUI.getState().timer).toMatchObject({ total: 180, adapt: 'heavy' })
  })

  it('a normal set rests the Rest timer as it always did, with nothing added', () => {
    const el = mount([entry(BENCH, 8)])
    tick(el, 1)
    expect(useUI.getState().timer.total).toBe(90)
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('a light set (13 reps) rests two thirds of it', () => {
    const el = mount([entry(BENCH, 15)])
    expect(upcomingSets(useStore.getState().S).map(x => x.restAfter)).toEqual([60, 60, 60])
    tick(el, 1)
    expect(useUI.getState().timer).toMatchObject({ total: 60, adapt: 'light' })
  })

  it('follows the user\'s own Rest timer', () => {
    const el = mount([entry(BENCH, 5)], { restSec: 120 })
    tick(el, 1)
    expect(useUI.getState().timer).toMatchObject({ total: 240, adapt: 'heavy' })
  })

  it('with "Adjust rest to the set" off every set rests the plain Rest timer', () => {
    const el = mount([entry(BENCH, 5)], { restAdapt: false })
    tick(el, 1)
    expect(useUI.getState().timer.total).toBe(90)
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('an exercise with its own rest keeps it', () => {
    const el = mount([entry(BENCH, 5, { restSec: 100 })])
    tick(el, 1)
    expect(useUI.getState().timer.total).toBe(100)
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('a set given its own rest in its menu keeps it, and the bar does not name an adaptation', () => {
    const el = mount([{ ...entry(BENCH, 5), sets: [{ ...row(5), restSec: 40 }, row(5), row(5)] }])
    tick(el, 1)
    expect(useUI.getState().timer.total).toBe(40)
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('the rest into the next exercise, when the profile sets one, is not adapted either', () => {
    const el = mount([entry(BENCH, 5), entry('0313', 10)], { nextRestSec: 120 })
    tick(el, 1)
    tick(el, 2)
    tick(el, 3)
    expect(useUI.getState().timer.total).toBe(120)
    expect(useUI.getState().timer.adapt).toBeUndefined()
  })

  it('the Rest timer off starts no rest at all', () => {
    const el = mount([entry(BENCH, 5)], { restSec: 0 })
    tick(el, 1)
    expect(useUI.getState().timer).toBeNull()
  })
})
