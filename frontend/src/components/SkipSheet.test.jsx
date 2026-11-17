// @vitest-environment happy-dom
// The Skip sheet: a reason is required, the note is kept, away mode writes a run of days, and Undo
// clears only the skip (leaving a stamped clear behind, so the removal syncs).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import SkipSheet from './SkipSheet.jsx'

// The real DateField opens a picker sheet; a plain input keeps these tests on the sheet's own logic.
vi.mock('./DateField.jsx', () => ({
  default: ({ value, onChange, label }) => <input aria-label={label} value={value} onChange={e => onChange(e.target.value)} />,
}))

const clone = v => JSON.parse(JSON.stringify(v))
const S = () => useStore.getState().S
const mounted = []

function mount(el) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const button = (host, text) => [...host.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const click = el => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) })

function install(extra = {}) {
  const st = clone(DEF)
  Object.assign(st, {
    routines: [{ id: 'A', name: 'Push', emoji: 'dumbbell', ex: [] }],
    week: { 1: ['A'], 3: ['A'], 5: ['A'] }, dayPlan: {}, active: null, workouts: [], weighIn: false, dayNotes: {},
  }, extra)
  useStore.setState({ S: st, user: null })
}

beforeEach(() => {
  // Wednesday 16 September 2026, midday.
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-09-16T12:00:00'))
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  localStorage.clear()
  useUI.setState({ sheets: [], toasts: [] })
  document.body.innerHTML = ''
  install()
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.useRealTimers()
})

describe('SkipSheet', () => {
  it('needs a reason before Skip today saves, then writes a travel note for today', () => {
    const host = mount(<SkipSheet iso="2026-09-16" close={() => {}} />)
    expect(button(host, 'Skip today').disabled).toBe(true)
    click(button(host, 'Travel'))
    click(button(host, 'Skip today'))
    const note = S().dayNotes['2026-09-16']
    expect(note.tag).toBe('travel')
    expect(typeof note._ts).toBe('number')
  })

  it('stores the optional note as text', () => {
    const host = mount(<SkipSheet iso="2026-09-16" close={() => {}} />)
    click(button(host, 'Sick'))
    const area = host.querySelector('textarea')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, '  Flu  ')
      area.dispatchEvent(new Event('input', { bubbles: true }))
    })
    click(button(host, 'Skip today'))
    expect(S().dayNotes['2026-09-16']).toMatchObject({ tag: 'sick', text: 'Flu' })
  })

  it('away mode over three days writes three tagged notes', () => {
    const host = mount(<SkipSheet iso="2026-09-16" close={() => {}} />)
    click(button(host, 'Travel'))
    click(button(host, 'Away for several days'))
    click(button(host, 'Save away days'))
    const keys = Object.keys(S().dayNotes).sort()
    expect(keys).toEqual(['2026-09-16', '2026-09-17', '2026-09-18'])
    expect(S().dayNotes['2026-09-18'].tag).toBe('travel')
  })

  it('a range over 31 days toasts and writes nothing', () => {
    const host = mount(<SkipSheet iso="2026-09-01" close={() => {}} />)
    click(button(host, 'Travel'))
    click(button(host, 'Away for several days'))
    const setDate = (el, value) => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value)
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    setDate(host.querySelector('input[aria-label="To"]'), '2026-10-15')
    click(button(host, 'Save away days'))
    expect(useUI.getState().toastMsg).toMatch(/31 days/)
    expect(S().dayNotes).toEqual({})
  })

  it('Undo skip appears only when a skip exists and leaves a stamped clear behind', () => {
    const plain = mount(<SkipSheet iso="2026-09-16" close={() => {}} />)
    expect(button(plain, 'Undo skip')).toBeUndefined()
    install({ dayNotes: { '2026-09-16': { tag: 'busy', _ts: 1 } } })
    const host = mount(<SkipSheet iso="2026-09-16" close={() => {}} />)
    click(button(host, 'Undo skip'))
    expect(S().dayNotes['2026-09-16']).toEqual({ _ts: expect.any(Number) })
  })

  it('Busy writes the busy tag', () => {
    const host = mount(<SkipSheet iso="2026-09-16" close={() => {}} />)
    click(button(host, 'Busy'))
    click(button(host, 'Skip today'))
    expect(S().dayNotes['2026-09-16'].tag).toBe('busy')
  })
})
