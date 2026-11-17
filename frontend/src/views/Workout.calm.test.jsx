// @vitest-environment happy-dom
// The calm List card: one header line, a folded Warm-up row, big set rows, a small Add set and one
// folded Details row; Complete as planned and Set current live in the exercise's ⋯ menu; Complete as
// planned never logs a weighted lift at 0 kg; and the rows of an exercise are the plan's, always.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../lib/wakelock.js', () => ({ useWakeLockStatus: () => 'held', useWakeLock: () => {}, wakeLockSupported: () => false }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
// Strips the invisible direction marks the app puts around numbers, so text can be compared plainly.
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')

const BENCH = '0025'
const CURL = '0313'
const w = (weight, done = false) => ({ w: weight, r: 6, done })
const entry = (sets, target = {}, id = BENCH) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 6, repsMin: 5, weight: sets[0]?.w || 0, ...target }, sets })

let roots = []
beforeEach(() => {
  useUI.setState({ sheets: [], toastMsg: '', toastAction: null, timer: null, work: null })
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
function mount(entries, { view = 'list', cur = 0 } = {}) {
  const S = clone(DEF)
  S.unit = 'kg'
  S.workoutView = view
  Object.assign(S, { gymMode: true, gymOpts: { big: true, asPlanned: true, next: true, awake: true } })
  S.active = { id: 'calm-test', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Calm', bw: null, cur, entries, workoutView: view }
  useStore.setState({ S, user: null })
  return render(<MemoryRouter><Workout /></MemoryRouter>)
}
const units = el => [...el.querySelectorAll('.wl-unit')]
const sets = () => useStore.getState().S.active.entries[0].sets
const buttonText = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const sheetTop = () => render(useUI.getState().sheets.at(-1).render(() => {}))
// Types into a field the way a keyboard does, so the field's own change handler runs.
function type(input, text) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
// The exercise's ⋯ menu of unit `k`: its items' labels, and a way to tap one.
function openMenu(el, k = 0) {
  act(() => units(el)[k].querySelector('.calm-acts button[title="More"]').click())
  const menu = sheetTop()
  const items = [...menu.querySelectorAll('.menu-item')]
  return { labels: items.map(i => i.querySelector('.tt')?.textContent), tap: label => act(() => items.find(i => i.querySelector('.tt')?.textContent === label).click()) }
}
const tick = (el, n) => act(() => el.querySelector(`[aria-label^="Set ${n} done"]`).click())

describe('the calm card header', () => {
  it('has the name and one muted line: sets × reps and the working weight', () => {
    const el = mount([entry([w(60), w(60), w(60), w(60)])])
    expect(plain(el.querySelector('.calm-name').textContent)).toBe('barbell bench press')
    expect(plain(el.querySelector('.calm-sub').textContent)).toBe('4 × 5–6 · 60 kg')
  })

  it('leaves the weight out while it is 0', () => {
    const el = mount([entry([w(0), w(0), w(0)])])
    expect(plain(el.querySelector('.calm-sub').textContent)).toBe('3 × 5–6')
  })

  it('shows none of the old extras: no tags, plan line, progression line or last time above the sets', () => {
    const el = mount([entry([w(60), w(60)])])
    expect(el.querySelectorAll('.tag, .planline, .progline, .refline, .exnote')).toHaveLength(0)
  })

  it('has no Exercise n / m text, no Current badge and no Set current button; the current exercise is outlined', () => {
    const el = mount([entry([w(60)]), entry([w(60)], {}, CURL)], { cur: 0 })
    expect(el.querySelectorAll('.wl-hd')).toHaveLength(0)
    expect(el.textContent).not.toMatch(/Exercise \d \/ \d/)
    expect(el.textContent).not.toContain('Current')
    expect(buttonText(el, 'Set current')).toBeUndefined()
    expect(units(el).map(u => u.classList.contains('cur'))).toEqual([true, false])
  })

  it('the Cards layout keeps its old header', () => {
    const el = mount([entry([w(60), w(60)])], { view: 'cards' })
    expect(el.querySelector('.calm-hd')).toBeNull()
    expect(el.querySelector('.exhd')).not.toBeNull()
    expect(el.querySelector('.card-calm')).toBeNull()
  })
})

describe('the Details row', () => {
  const noted = () => mount([entry([w(60), w(60)], { note: 'Keep your elbows tucked.' })])

  it('is closed at first: the plan note is not on screen', () => {
    const el = noted()
    const row = buttonText(el, 'Details')
    expect(row.getAttribute('aria-expanded')).toBe('false')
    expect(el.textContent).not.toContain('Keep your elbows tucked.')
  })

  it('opens on a tap with the note and the muscle and equipment tags, and folds again', () => {
    const el = noted()
    act(() => buttonText(el, 'Details').click())
    expect(buttonText(el, 'Details').getAttribute('aria-expanded')).toBe('true')
    expect(el.textContent).toContain('Keep your elbows tucked.')
    expect(el.querySelectorAll('.calm-details .tag').length).toBeGreaterThan(0)
    act(() => buttonText(el, 'Details').click())
    expect(el.textContent).not.toContain('Keep your elbows tucked.')
  })
})

describe('Add set and the ⋯ menu', () => {
  it('Add set is a small text button at the end of the sets, and there is no Complete as planned button', () => {
    const el = mount([entry([w(60), w(60)])])
    expect(el.querySelector('.calm-foot').textContent).toBe('Add set')
    expect(buttonText(el, 'Complete as planned')).toBeUndefined()
    act(() => buttonText(el, 'Add set').click())
    expect(sets()).toHaveLength(3)
  })

  it('Complete as planned is in the exercise\'s ⋯ menu, and Set current for an exercise that is not the current one', () => {
    const el = mount([entry([w(60), w(60)]), entry([w(60)], {}, CURL)], { cur: 0 })
    expect(openMenu(el, 0).labels).toContain('Complete as planned')
    expect(openMenu(el, 0).labels).not.toContain('Set current')
    useUI.setState({ sheets: [] })
    expect(openMenu(el, 1).labels).toContain('Set current')
  })

  it('Set current in the menu moves the outline', () => {
    const el = mount([entry([w(60)]), entry([w(60)], {}, CURL)], { cur: 0 })
    openMenu(el, 1).tap('Set current')
    expect(useStore.getState().S.active.cur).toBe(1)
    expect(units(el).map(u => u.classList.contains('cur'))).toEqual([false, true])
  })

  it('Complete as planned from the menu ticks every set still to do, with its Undo', () => {
    const el = mount([entry([w(60), w(60), w(60)]), entry([w(40)], {}, CURL)])
    openMenu(el, 0).tap('Complete as planned')
    expect(sets().map(s => s.done)).toEqual([true, true, true])
    expect(useUI.getState().toastMsg).toBe('Sets done as planned: 3')
    act(() => useUI.getState().runToastAction())
    expect(sets().map(s => s.done)).toEqual([false, false, false])
  })
})

describe('Complete as planned never logs a weighted lift at 0 kg', () => {
  const zero = () => mount([entry([w(0), w(0), w(0)], { weight: 0 }), entry([w(40)], {}, CURL)])

  it('opens the Working weight sheet first and ticks nothing', () => {
    const el = zero()
    openMenu(el, 0).tap('Complete as planned')
    const sheet = sheetTop()
    expect(sheet.querySelector('h3').textContent).toBe('Working weight')
    expect(sheet.querySelectorAll('input')).toHaveLength(1)
    expect(sets().map(s => s.done)).toEqual([false, false, false])
    expect(useUI.getState().toastMsg).toBe('')
  })

  it('Save and complete waits for a weight above 0', () => {
    const el = zero()
    openMenu(el, 0).tap('Complete as planned')
    const sheet = sheetTop()
    expect(buttonText(sheet, 'Save and complete').disabled).toBe(true)
    expect(sets().map(s => s.done)).toEqual([false, false, false])
  })

  it('saving puts the weight on every set still to do, with the planned reps, and ticks them', () => {
    const el = zero()
    openMenu(el, 0).tap('Complete as planned')
    const sheet = sheetTop()
    type(sheet.querySelector('input'), '60')
    act(() => buttonText(sheet, 'Save and complete').click())
    expect(sets().map(s => [s.w, s.r, s.done])).toEqual([[60, 6, true], [60, 6, true], [60, 6, true]])
    expect(useUI.getState().toastMsg).toBe('Sets done as planned: 3')
    expect(useUI.getState().toastAction.label).toBe('Undo')
    expect(plain(el.querySelector('.calm-sub').textContent)).toBe('3 × 5–6 · 60 kg')
  })

  it('a set that already has a weight is not asked about', () => {
    const el = mount([entry([w(60), w(60)])])
    openMenu(el, 0).tap('Complete as planned')
    expect(sets().map(s => s.done)).toEqual([true, true])
    expect(useUI.getState().toastMsg).toBe('Sets done as planned: 2')
  })

  it('body weight and a hold are not asked', () => {
    let el = mount([entry([w(0), w(0)], { bodyweight: true })])
    openMenu(el, 0).tap('Complete as planned')
    expect(sets().map(s => s.done)).toEqual([true, true])
    useUI.setState({ sheets: [] })
    el = mount([{ id: '0841', target: { mode: 'time', sets: 2, sec: 30 }, sets: [{ sec: 30, w: 0, done: false }, { sec: 30, w: 0, done: false }] }])
    openMenu(el, 0).tap('Complete as planned')
    expect(sets().map(s => s.done)).toEqual([true, true])
  })

  it('Cards has the button too, and asks the same way', () => {
    const el = mount([entry([w(0), w(0)], { weight: 0 })], { view: 'cards' })
    act(() => buttonText(el, 'Complete as planned').click())
    expect(sheetTop().querySelector('h3').textContent).toBe('Working weight')
    expect(sets().map(s => s.done)).toEqual([false, false])
  })
})

describe('an exercise never gets a set it was not asked for', () => {
  const four = () => [w(60), w(60), w(60), w(60)]

  it('ticking all four sets of a four-set exercise leaves four rows, and the foot of the card as it was', () => {
    const el = mount([entry(four()), entry([w(40)], {}, CURL)])
    const foot = () => [...units(el)[0].querySelector('.calm-foot').children].map(c => c.textContent)
    const rows = () => units(el)[0].querySelectorAll('.setrow').length
    expect(rows()).toBe(4)
    const before = foot()
    for (const n of [1, 2, 3, 4]) tick(units(el)[0], n)
    expect(sets().map(s => s.done)).toEqual([true, true, true, true])
    expect(sets()).toHaveLength(4)
    expect(rows()).toBe(4)
    // Nothing in the foot appears or goes away as the last set is ticked, so Add set never moves
    // under a finger that was aiming at something else (it used to take the place of Complete as planned).
    expect(foot()).toEqual(before)
    expect(foot()).toEqual(['Add set'])
  })

  it('nor after Complete as planned from the menu', () => {
    const el = mount([entry(four()), entry([w(40)], {}, CURL)])
    openMenu(el, 0).tap('Complete as planned')
    expect(sets()).toHaveLength(4)
    expect(units(el)[0].querySelectorAll('.setrow')).toHaveLength(4)
    expect(units(el)[0].querySelector('.calm-foot').textContent).toBe('Add set')
  })

  it('Add set is still the only way to get a fifth row, and it adds exactly one', () => {
    const el = mount([entry(four()), entry([w(40)], {}, CURL)])
    for (const n of [1, 2, 3, 4]) tick(units(el)[0], n)
    act(() => buttonText(units(el)[0], 'Add set').click())
    expect(sets()).toHaveLength(5)
    expect(sets()[4].done).toBe(false)
  })
})

describe('the Warm-up row and the rest of the card', () => {
  it('a ticked set takes the done look, with its tick still the 56 px circle of Gym mode', () => {
    const el = mount([entry([w(60), w(60)])])
    expect(el.querySelector('.narrow').classList.contains('gym')).toBe(true)
    tick(el, 1)
    expect(el.querySelector('.setrow.done .chk.on')).not.toBeNull()
  })

  it('a superset member gets the calm header too', () => {
    const el = mount([{ ...entry([w(60)]), sg: 'g1' }, { ...entry([w(40)], {}, CURL), sg: 'g1' }])
    expect(el.querySelectorAll('.ss-card .calm-hd')).toHaveLength(2)
    expect(el.querySelectorAll('.wl-hd')).toHaveLength(0)
  })
})
