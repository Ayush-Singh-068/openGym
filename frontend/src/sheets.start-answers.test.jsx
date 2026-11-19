// @vitest-environment happy-dom
// What Start asks for the day (the check-in and the body weight) belongs to the workout until it is
// saved: a discarded workout, a closed weigh-in sheet or a skipped question leaves nothing behind, the
// first workout of the day asks, and the later ones do not (lib/day-answers.js).
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { startFlow, finishWorkoutNow, repeatWorkout, startBuiltSession } from './sheets.jsx'
import { discardActiveWorkout } from './lib/discard-workout.js'
import { pickedExerciseConfig } from './lib/history.js'
import { readingsOf } from './lib/weigh-ins.js'

const BENCH = '0025'
const DAY = '2026-11-06'
const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []
function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const pip = (host, row, n) => host.querySelectorAll('.dfc-scale')[row].querySelectorAll('button')[n - 1]

function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    routines: [{ id: 'A', name: 'Push', emoji: 'dumbbell', ex: [{ id: BENCH, sets: 3, reps: 5, weight: 80 }] }],
    week: {}, dayPlan: {}, active: null, workouts: [], weighIn: true, dailyForm: true, bodyweight: [], dayForm: {},
  }, extra)
  useStore.setState({ S: st, user: null })
}
// Start, answer sleep 4 and soreness 2, set the weight to 71 (the sheet starts on 70): the workout runs.
function answerAndStart() {
  act(() => startFlow(['A']))
  let host = mountTopSheet()
  act(() => pip(host, 0, 4).click())
  act(() => pip(host, 2, 2).click())
  act(() => button(host, 'Start workout').click())
  host = mountTopSheet()
  act(() => button(host, '+1').click())
  act(() => button(host, 'Save & start workout').click())
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-11-06T12:00:00'))
  useUI.setState({ sheets: [], toasts: [] })
})
afterEach(() => {
  mounted.splice(0).forEach(r => act(() => r.unmount()))
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('the answers belong to the workout until it is saved', () => {
  it('while it runs they ride on the workout and the day has nothing; saving writes them to the day', () => {
    install()
    answerAndStart()
    expect(S().active.bw).toBe(71)
    expect(S().active.staged).toMatchObject({ form: { sleep: 4, sore: 2 }, bw: { w: 71, at: '12:00' } })
    expect(S().dayForm).toEqual({})
    expect(S().bodyweight).toEqual([])
    act(() => finishWorkoutNow())
    expect(S().dayForm[DAY]).toMatchObject({ sleep: 4, sore: 2 })
    expect(readingsOf(S().bodyweight[0])).toMatchObject([{ at: '12:00', w: 71 }])
    expect(S().workouts).toHaveLength(1)
    expect(S().workouts[0].bw).toBe(71)
    expect(S().workouts[0].staged).toBeUndefined()
  })

  it('discarding the workout leaves no check-in and no weight, and the next Start asks both again', () => {
    install()
    answerAndStart()
    act(() => discardActiveWorkout())
    expect(S().active).toBeNull()
    expect(S().dayForm).toEqual({})
    expect(S().bodyweight).toEqual([])
    useUI.setState({ sheets: [] })
    act(() => startFlow(['A']))
    let host = mountTopSheet()
    expect(host.querySelectorAll('.dfc-scale')).toHaveLength(4)
    act(() => button(host, 'Start without answering').click())
    expect(useUI.getState().sheets.at(-1).locked).toBe(true)
    host = mountTopSheet()
    expect(host.textContent).toContain('Today’s weight')
  })

  it('closing the weigh-in sheet starts nothing and keeps nothing: the check-in is asked again', () => {
    install()
    act(() => startFlow(['A']))
    let host = mountTopSheet()
    act(() => pip(host, 0, 4).click())
    act(() => button(host, 'Start workout').click())
    host = mountTopSheet()
    act(() => host.querySelector('button[aria-label="Cancel"]').click())
    expect(S().active).toBeNull()
    expect(S().dayForm).toEqual({})
    expect(S().bodyweight).toEqual([])
    act(() => startFlow(['A']))
    expect(mountTopSheet().querySelectorAll('.dfc-scale')).toHaveLength(4)
  })

  it('Skip for today and Start without weighing in start a workout with nothing staged', () => {
    install()
    act(() => startFlow(['A']))
    const ask = mountTopSheet()
    act(() => button(ask, 'Skip for today').click())
    const weigh = mountTopSheet()
    act(() => button(weigh, 'Start without weighing in').click())
    expect(S().active.bw).toBeNull()
    expect(S().active.staged).toBeUndefined()
    act(() => finishWorkoutNow())
    expect(S().dayForm).toEqual({})
    expect(S().bodyweight).toEqual([])
  })
})

describe('once a day', () => {
  it('after the first workout is saved, the second one of the day asks nothing and starts at the day\'s weight', () => {
    install()
    answerAndStart()
    act(() => finishWorkoutNow())
    useUI.setState({ sheets: [] })
    act(() => startFlow(['A']))
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().active.bw).toBe(71)
    expect(S().active.staged).toBeUndefined()
    act(() => discardActiveWorkout())
    expect(S().dayForm[DAY]).toMatchObject({ sleep: 4, sore: 2 })
    expect(readingsOf(S().bodyweight[0])).toHaveLength(1)
  })

  it('a weight already logged today is not asked for again, and discarding a workout never takes it away', () => {
    install({ bodyweight: [{ d: DAY, w: 80, t: 1 }] })
    act(() => startFlow(['A']))
    const ask = mountTopSheet()
    act(() => button(ask, 'Start without answering').click())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().active.bw).toBe(80)
    act(() => discardActiveWorkout())
    expect(S().bodyweight).toEqual([{ d: DAY, w: 80, t: 1 }])
  })

  it('a check-in typed meanwhile wins when the workout is saved', () => {
    install()
    answerAndStart()
    act(() => useStore.getState().update(s => { s.dayForm = { [DAY]: { sleep: 1, _ts: 5 } }; s.bodyweight = [{ d: DAY, w: 90, t: 5 }] }))
    act(() => finishWorkoutNow())
    expect(S().dayForm[DAY]).toMatchObject({ sleep: 1 })
    expect(S().dayForm[DAY].sore).toBeUndefined()
    expect(S().bodyweight).toHaveLength(1)
    expect(S().bodyweight[0].w).toBe(90)
  })
})

describe('Repeat today and a built session ask the same two questions', () => {
  const past = { id: 'p1', d: '2026-11-01', name: 'Push', start: new Date('2026-11-01T18:00:00').getTime(), end: new Date('2026-11-01T19:00:00').getTime(), routineIds: [], entries: [{ id: BENCH, sets: [{ w: 80, r: 5, done: true }] }] }

  it('Repeat today asks the check-in, then the weight, and the answers ride on the new workout', () => {
    install({ workouts: [past] })
    act(() => repeatWorkout(past))
    let host = mountTopSheet()
    expect(host.querySelectorAll('.dfc-scale')).toHaveLength(4)
    act(() => pip(host, 0, 5).click())
    act(() => button(host, 'Start workout').click())
    host = mountTopSheet()
    act(() => button(host, 'Save & start workout').click())
    expect(S().active.staged).toMatchObject({ form: { sleep: 5 }, bw: { w: 70, at: '12:00' } })
    expect(S().dayForm).toEqual({})
    act(() => discardActiveWorkout())
    expect(S().bodyweight).toEqual([])
  })

  it('a built session asks too, and with the weigh-in off it only asks the check-in', () => {
    install({ weighIn: false })
    act(() => startBuiltSession([pickedExerciseConfig(BENCH, undefined, S())], 'Quick one'))
    const host = mountTopSheet()
    expect(host.querySelectorAll('.dfc-scale')).toHaveLength(4)
    act(() => pip(host, 1, 3).click())
    act(() => button(host, 'Start workout').click())
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(S().active.name).toBe('Quick one')
    expect(S().active.staged).toEqual({ form: expect.objectContaining({ energy: 3 }) })
  })
})
