// @vitest-environment happy-dom
// The calendar (views/CalendarView.jsx): month grid, week list, year picker, Today, and the cell marks.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CalendarView from './CalendarView.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { workoutDetailSheet } from '../sheets.jsx'

vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ workoutDetailSheet: vi.fn() }))
globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))

// Today is Tuesday 17 November 2026. Monday is the first day of the week unless a test says otherwise.
const TODAY = new Date(2026, 10, 17, 12)

let root, container
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
  vi.mocked(workoutDetailSheet).mockClear()
})
afterEach(() => {
  if (root) act(() => root.unmount())
  container?.remove()
  root = container = null
  vi.useRealTimers()
})

// One routine on every weekday, a workout in March 2025 (the first workout, so the picker reaches back
// that far) and one on Tuesday 10 November 2026.
function mount(patch = {}) {
  const S = clone(DEF)
  Object.assign(S, {
    weekStart: 1,
    routines: [{ id: 'r1', name: 'Push', exercises: [] }],
    week: [['r1'], ['r1'], ['r1'], ['r1'], ['r1'], ['r1'], ['r1']],
    workouts: [
      { id: 'old', d: '2025-03-05', start: new Date(2025, 2, 5, 17).getTime(), end: new Date(2025, 2, 5, 18).getTime(), name: 'Old', routineId: 'r1', vol: 0, prs: [], entries: [] },
      { id: 'w1', d: '2026-11-10', start: new Date(2026, 10, 10, 17).getTime(), end: new Date(2026, 10, 10, 18).getTime(), name: 'Push', routineId: 'r1', vol: 0, prs: [], routineIds: ['r1'],
        entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 60, r: 8, done: true, type: 'normal' }] }] },
    ],
    ...patch,
  })
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(<MemoryRouter><CalendarView /></MemoryRouter>))
}

const title = () => container.querySelector('.cv-title').textContent
const button = (label, scope = container) => [...scope.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === label || b.textContent.trim() === label)
const click = el => act(() => { el.click() })
// The in-month cell for a day of the month.
const cell = day => [...container.querySelectorAll('.cv-day:not(.out)')].find(b => b.querySelector('span').textContent === String(day))
const selectedRow = () => container.querySelector('.cv-row.sel')

describe('CalendarView', () => {
  it('renders the current month title and a Today button; previous and next move by a month', () => {
    mount()
    expect(title()).toBe('November 2026')
    expect(container.querySelector('.cv-today').textContent).toBe('Today')
    click(button('Previous month'))
    expect(title()).toBe('October 2026')
    click(button('Next month'))
    click(button('Next month'))
    expect(title()).toBe('December 2026')
  })

  it('rolls the year over from December to January', () => {
    mount()
    click(button('Next month'))
    click(button('Next month'))
    expect(title()).toBe('January 2027')
    click(button('Previous month'))
    expect(title()).toBe('December 2026')
  })

  it('the title opens the picker; choosing 2025 and April shows April 2025', () => {
    mount()
    click(container.querySelector('.cv-title'))
    const select = container.querySelector('#cv-year')
    expect(select).not.toBeNull()
    expect(select.value).toBe('2026')
    act(() => {
      select.value = '2025'
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
    click([...container.querySelectorAll('.cv-months button')].find(b => b.textContent === 'Apr'))
    expect(title()).toBe('April 2025')
  })

  it('the year list runs from next year down to the first workout\'s year and no lower', () => {
    mount()
    click(container.querySelector('.cv-title'))
    const years = [...container.querySelectorAll('#cv-year option')].map(o => o.value)
    expect(years).toEqual(['2027', '2026', '2025'])
  })

  it('shows week numbers in the first column', () => {
    mount()
    const headWeek = container.querySelector('.cv-head .cv-wk')
    expect(headWeek.textContent).toBe('Wk')
    const weekNos = [...container.querySelectorAll('.cv-grid .cv-row:not(.cv-head) > .cv-wk')].map(b => b.textContent)
    expect(weekNos.length).toBeGreaterThanOrEqual(4)
    weekNos.forEach(n => expect(n).toMatch(/^\d+$/))
  })

  it('starts the header on Sunday when the week starts on Sunday, and on Monday otherwise', () => {
    mount({ weekStart: 0 })
    const sunday = [...container.querySelectorAll('.cv-head .cv-h')].map(h => h.textContent)
    expect(sunday[0]).toBe('Su')
    act(() => root.unmount())
    container.remove()
    mount({ weekStart: 1 })
    const monday = [...container.querySelectorAll('.cv-head .cv-h')].map(h => h.textContent)
    expect(monday[0]).toBe('Mo')
  })

  it('clicking a day selects its week row and lists seven day cards', () => {
    mount()
    click(cell(4))
    expect(selectedRow().contains(cell(4))).toBe(true)
    expect(selectedRow().querySelector('.cv-wk').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelectorAll('.cv-daycard')).toHaveLength(7)
  })

  it('lists a seeded workout with routine name, duration and volume, and opens it on click', () => {
    mount()
    click(cell(10))
    const row = container.querySelector('.cv-days .item')
    expect(row.querySelector('.tt').textContent).toBe('Push')
    const detail = row.querySelector('.ss').textContent
    expect(detail).toContain('1h')
    expect(detail).toContain('480')
    click(row)
    expect(workoutDetailSheet).toHaveBeenCalledTimes(1)
    expect(workoutDetailSheet.mock.calls[0][0]).toMatchObject({ id: 'w1', name: 'Push' })
  })

  it('marks cells: a trained day done, a past planned day with no workout missed, today today', () => {
    mount()
    expect(cell(10).classList.contains('done')).toBe(true)
    expect(cell(4).classList.contains('missed')).toBe(true)
    expect(cell(17).classList.contains('today')).toBe(true)
    expect(cell(17).getAttribute('aria-current')).toBe('date')
  })

  it('Today returns to the current month and selects its week', () => {
    mount()
    click(button('Previous month'))
    click(button('Previous month'))
    expect(title()).toBe('September 2026')
    click(container.querySelector('.cv-today'))
    expect(title()).toBe('November 2026')
    expect(selectedRow().contains(cell(17))).toBe(true)
  })
})
