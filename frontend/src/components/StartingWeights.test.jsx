// @vitest-environment happy-dom
// The starting weights sheet: a row for each main lift, typing a weight and Save writes it into
// the routines, Skip for now writes nothing.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { parsePlan } from '../lib/plan-share.js'
import { SIX_DAY_PPL } from '../lib/plans/six-day-ppl.js'
import { applySixDayPpl } from '../lib/plans/load-six-day-ppl.js'
import { mainRoutineIds } from '../lib/starting-weights.js'
import StartingWeights from './StartingWeights.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []
let ids = []

function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const field = (host, exId) => host.querySelector(`[data-ex="${exId}"] input`)
// Types into a field the way a keyboard does, so the field's own change handler runs.
function type(input, text) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
const weightOf = (routineName, exId) =>
  S().routines.find(r => r.name === routineName && r.folder === SIX_DAY_PPL.name).ex.find(x => x.id === exId).weight

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toasts: [] })
  document.body.innerHTML = ''
  const st = clone(DEF)
  Object.assign(st, { routines: [], week: {}, workouts: [], active: null })
  const result = applySixDayPpl(st, parsePlan(SIX_DAY_PPL, 'kg'), { schedule: true })
  ids = mainRoutineIds(st, result.ids, SIX_DAY_PPL.name)
  useStore.setState({ S: st, user: null })
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('StartingWeights', () => {
  it('shows a row for each main lift, grouped under the day it first appears in', () => {
    const host = mount(<StartingWeights routineIds={ids} close={() => {}} />)
    expect(host.textContent).toContain('What do you lift now?')
    expect(host.querySelectorAll('[data-ex]')).toHaveLength(42)
    expect([...host.querySelectorAll('h4.sec')].map(h => h.textContent)).toEqual(
      ['Pull Day 1', 'Push Day 1', 'Leg Day 1', 'Pull Day 2', 'Push Day 2', 'Leg Day 2'])
    expect(host.querySelector('[data-ex="1503"]')).toBeNull()       // a band warm-up is not asked
    expect(host.querySelector('[data-ex="3666"]')).toBeNull()       // nor the treadmill
    expect(field(host, '0047').value).toBe('0')
  })

  it('Save weights stores what was typed and closes', () => {
    const close = vi.fn()
    const host = mount(<StartingWeights routineIds={ids} close={close} />)
    type(field(host, '0047'), '60')
    type(field(host, '0841'), '12.5')
    act(() => { button(host, 'Save weights').click() })
    expect(weightOf('Push Day 1', '0047')).toBe(60)
    expect(weightOf('Pull Day 1', '0841')).toBe(12.5)
    expect(weightOf('Push Day 1', '0289')).toBe(0)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('the plus button adds the lift step', () => {
    const host = mount(<StartingWeights routineIds={ids} close={() => {}} />)
    act(() => { host.querySelector('[data-ex="0047"]').querySelectorAll('button')[1].click() })
    expect(field(host, '0047').value).toBe('2.5')
  })

  it('Skip for now changes nothing and closes', () => {
    const close = vi.fn()
    const host = mount(<StartingWeights routineIds={ids} close={close} />)
    type(field(host, '0047'), '60')
    const before = JSON.stringify(S().routines)
    act(() => { button(host, 'Skip for now').click() })
    expect(JSON.stringify(S().routines)).toBe(before)
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('Save with nothing typed writes nothing and just closes', () => {
    const close = vi.fn()
    const host = mount(<StartingWeights routineIds={ids} close={close} />)
    const before = JSON.stringify(S().routines)
    act(() => { button(host, 'Save weights').click() })
    expect(JSON.stringify(S().routines)).toBe(before)
    expect(close).toHaveBeenCalledTimes(1)
  })
})
