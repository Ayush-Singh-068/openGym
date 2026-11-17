// @vitest-environment happy-dom
// The built-in six-day plan goes through the same import sheet as a file, but its own apply step
// (the exercise names, the custom alternatives and the deload week) runs in the same update.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { parsePlan } from './lib/plan-share.js'
import { PPL_SHOWN_NAMES } from './lib/plans/six-day-ppl.js'
import { SIX_DAY_PPL } from './lib/plans/six-day-ppl.js'
import { planImportSheet, starterPlanSheet } from './sheets.jsx'

const mounted = []
const S = () => useStore.getState().S

// Renders whatever sheet is on top and returns its host element.
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const buttonFor = (host, label) => [...host.querySelectorAll('button')].find(b => b.textContent === label)

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({
    S: { ...s.S, routines: [{ id: 'mine', name: 'My routine', emoji: 'star', ex: [] }], week: {}, active: null, equipProfiles: [], activeEquipId: null, equipFilterOn: false },
  }))
  document.body.innerHTML = ''
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('planImportSheet options', () => {
  it('calls opts.apply instead of the plain merge', () => {
    const bundle = parsePlan(SIX_DAY_PPL, 'kg')
    const apply = vi.fn()
    planImportSheet(bundle, { apply, schedule: true })
    const host = renderTop()
    act(() => { buttonFor(host, 'Add to my plan').click() })
    expect(apply).toHaveBeenCalledTimes(1)
    expect(apply.mock.calls[0][1]).toBe(bundle)
    expect(apply.mock.calls[0][2]).toEqual({ schedule: true })   // the switch starts from opts.schedule
    expect(S().routines).toHaveLength(1)                          // mergePlan did not run
  })

  it('starts the schedule switch off without opts, and shows extra lines under the explanation', () => {
    planImportSheet(parsePlan(SIX_DAY_PPL, 'kg'), { apply: vi.fn(), extra: ['First extra line.', 'Second extra line.'] })
    const host = renderTop()
    expect(host.textContent).toContain('First extra line.')
    expect(host.textContent).toContain('Second extra line.')
    const apply = vi.fn()
    useUI.setState({ sheets: [] })
    planImportSheet(parsePlan(SIX_DAY_PPL, 'kg'), { apply })
    const second = renderTop()   // rendered outside act(), so the sheet is in the DOM before the click
    act(() => { buttonFor(second, 'Add to my plan').click() })
    expect(apply.mock.calls[0][2]).toEqual({ schedule: false })
  })
})

describe('the built-in six-day plan from the starter chooser', () => {
  it('adds the routines, names, custom alternatives and deload week in one go', () => {
    starterPlanSheet()
    const chooser = renderTop()
    act(() => { chooser.querySelector('[data-plan="six-day-ppl"]').click() })
    const sheet = renderTop()
    expect(sheet.textContent).toContain('Deload every 6th week')
    act(() => { buttonFor(sheet, 'Add to my plan').click() })

    expect(S().routines).toHaveLength(13)                       // the one you had, plus the plan's 12
    const main = S().routines.filter(r => r.folder === '6-Day Push Pull Legs')
    expect(main).toHaveLength(6)
    expect(Object.keys(S().week).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(Object.keys(S().exShownName)).toHaveLength(122)
    expect(PPL_SHOWN_NAMES).toHaveLength(122)
    expect(S().exShownName[PPL_SHOWN_NAMES[0].id]).toBe(PPL_SHOWN_NAMES[0].name)
    expect(S().deloadCycle).toMatchObject({ every: 6, sets: 2, drop: 50, cardio: 'skip' })
  })
})
