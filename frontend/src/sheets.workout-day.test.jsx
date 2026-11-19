// @vitest-environment happy-dom
// A saved workout's sheet shows what the day said besides the workout, the check-in and the weight, and
// each is a tap from changing or deleting (with Undo). One check-in and one weight per day.
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { workoutDetailSheet } from './sheets.jsx'
import { formOf } from './lib/daily-form.js'

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
const rowOf = (host, title) => [...host.querySelectorAll('.item')].find(r => r.querySelector('.tt')?.textContent === title)
const pip = (host, row, n) => host.querySelectorAll('.dfc-scale')[row].querySelectorAll('button')[n - 1]

const DAY = '2026-09-15'
const workout = { id: 'w1', d: DAY, start: new Date(2026, 8, 15, 17).getTime(), end: new Date(2026, 8, 15, 18).getTime(), name: 'Push', vol: 0, prs: [], routineIds: [], entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 60, r: 5, done: true }] }] }

function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, { unit: 'kg', routines: [], workouts: [clone(workout)], active: null, bodyweight: [], dayForm: {} }, extra)
  useStore.setState({ S: st, user: null })
}
const open = () => { act(() => workoutDetailSheet(clone(workout))); return mountTopSheet() }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('the day on the workout sheet', () => {
  it('shows nothing extra for a day with neither a check-in nor a weight', () => {
    install()
    const host = open()
    expect(rowOf(host, 'Felt that day')).toBeUndefined()
    expect(rowOf(host, 'Weight that day')).toBeUndefined()
  })

  it('shows the answers given and the weight of that day', () => {
    install({ dayForm: { [DAY]: { sleep: 4, sore: 2, _ts: 1 } }, bodyweight: [{ d: DAY, w: 80.2, t: 1 }] })
    const host = open()
    expect(rowOf(host, 'Felt that day').querySelector('.ss').textContent).toBe('Sleep 4/5 · Soreness 2/5')
    expect(rowOf(host, 'Weight that day').querySelector('.ss').textContent).toBe('80.2 kg')
  })

  it('changes the check-in in place: one entry for the day', () => {
    install({ dayForm: { [DAY]: { sleep: 4, sore: 2, lighter: 'sets', _ts: 1 } } })
    const host = open()
    act(() => rowOf(host, 'Felt that day').click())
    const edit = mountTopSheet()
    expect(edit.querySelector('h3').textContent).toBe('Felt that day')
    expect(edit.querySelector('[aria-checked="true"]').textContent).toBe('4')
    act(() => pip(edit, 0, 5).click())
    act(() => button(edit, 'Save').click())
    expect(formOf(S(), DAY)).toEqual({ sleep: 5, energy: null, sore: 2, stress: null, lighter: 'sets' })
    expect(Object.keys(S().dayForm)).toEqual([DAY])
    expect(useUI.getState().toastMsg).toBe('Check-in saved')
  })

  it('Save waits for at least one answer', () => {
    install({ dayForm: { [DAY]: { sleep: 4, _ts: 1 } } })
    const host = open()
    act(() => rowOf(host, 'Felt that day').click())
    const edit = mountTopSheet()
    expect(button(edit, 'Save').disabled).toBe(false)
    act(() => pip(edit, 0, 4).click())
    expect(button(edit, 'Save').disabled).toBe(true)
  })

  it('deletes the check-in, and Undo puts it back as it was', () => {
    install({ dayForm: { [DAY]: { sleep: 4, sore: 2, _ts: 1 } } })
    const host = open()
    act(() => rowOf(host, 'Felt that day').click())
    const edit = mountTopSheet()
    act(() => button(edit, 'Delete check-in').click())
    expect(formOf(S(), DAY)).toBeNull()
    expect(useUI.getState().toastMsg).toBe('Check-in deleted')
    expect(useUI.getState().toastAction?.label).toBe('Undo')
    act(() => useUI.getState().runToastAction())
    expect(formOf(S(), DAY)).toMatchObject({ sleep: 4, sore: 2 })
  })

  it('opens the weight to change, and deletes it with Undo', () => {
    install({ bodyweight: [{ d: DAY, w: 80.2, t: 1 }] })
    const host = open()
    act(() => rowOf(host, 'Weight that day').click())
    const edit = mountTopSheet()
    expect(edit.querySelector('h3').textContent).toBe('Edit weigh-in')
    act(() => button(edit, 'Delete weigh-in').click())
    expect(S().bodyweight).toEqual([])
    expect(useUI.getState().toastMsg).toBe('Weigh-in deleted')
    act(() => useUI.getState().runToastAction())
    expect(S().bodyweight.map(b => [b.d, b.w])).toEqual([[DAY, 80.2]])
  })
})
