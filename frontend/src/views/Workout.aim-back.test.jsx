// @vitest-environment happy-dom
// The Aim line and "Back to the suggested weight" inside "About this weight" (Phase 1b N5 and N3): the card
// itself does not change. One row, only when the open sets are not at the plan's weight, in the unit the
// exercise is shown in (lb, a sled), never for a bodyweight or unplanned exercise.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Workout from './Workout.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { withExUnit, storedWeight } from '../lib/ex-unit.js'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), unlock: vi.fn(), restOver: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../lib/wakelock.js', () => ({ useWakeLockStatus: () => 'held', useWakeLock: () => {}, wakeLockSupported: () => false }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')

const BENCH = '0025'       // barbell bench press
const CURL = '0313'        // dumbbell hammer curl
const LEG_PRESS = '2267'   // lever seated leg press
const COCOONS = '0260'     // cocoons: bodyweight
const w = (weight, r = 6, done = false) => ({ w: weight, r, done })
const warm = weight => ({ w: weight, r: 6, done: false, phase: 'warmup' })
const entry = (sets, target = {}, id = BENCH, extra = {}) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 6, repsMin: 5, weight: sets[0]?.w || 0, ...target }, sets, ...extra })
const up = weight => ({ policy: 'linear', kind: 'up', weight, why: ['Every set hit {0}. Same weight, {1} reps this time.', 6, 7] })

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
function mount(entries, { cur = 0, ...patch } = {}) {
  const S = clone(DEF)
  S.unit = 'kg'
  S.workoutView = 'list'
  Object.assign(S, { gymMode: true, gymOpts: { big: true, asPlanned: true, next: true, awake: true } }, patch)
  S.active = { id: 'aim-back-test', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Aim', bw: null, cur, entries, workoutView: S.workoutView }
  useStore.setState({ S, user: null })
  return render(<MemoryRouter><Workout /></MemoryRouter>)
}
const sentences = el => [...el.querySelectorAll('.calm-load')]
const sheetTop = () => render(useUI.getState().sheets.at(-1).render(() => {}))
// Not inside another act(): the sheet renders when its own act ends.
const openSheet = el => {
  act(() => sentences(el)[0].click())
  const sheet = sheetTop()
  expect(sheet.querySelector('h3').textContent).toBe('About this weight')
  return sheet
}
const backRow = sheet => [...sheet.querySelectorAll('button.lrow')].find(b => b.textContent.includes('Back to the suggested weight'))
const weights = (i = 0) => useStore.getState().S.active.entries[i].sets.map(s => s.w)
const details = el => act(() => [...el.querySelectorAll('.calm-fold')].find(b => b.textContent.trim() === 'Details').click())

describe('the Aim line in "About this weight"', () => {
  it('a heavy big lift: a couple of reps to spare, between the plates and the reason', () => {
    const el = mount([entry([w(100, 5), w(100, 5)], {}, BENCH, { plan: up(100) })])
    const t = plain(openSheet(el).textContent)
    expect(t).toContain('Each side: 25 + 15')
    expect(t).toContain('Aim: a couple of reps to spare')
    expect(t.indexOf('Aim:')).toBeLessThan(t.indexOf('Why this weight'))
  })

  it('normal work, light work, a small muscle and a first time', () => {
    expect(plain(openSheet(mount([entry([w(100, 8)], {}, BENCH, { plan: up(100) })])).textContent)).toContain('Aim: one or two reps to spare')
    expect(plain(openSheet(mount([entry([w(60, 15)], {}, BENCH, { plan: up(60) })])).textContent)).toContain('Aim: close to the limit, one rep to spare')
    expect(plain(openSheet(mount([entry([w(24, 10)], {}, CURL, { plan: up(24) })])).textContent)).toContain('Aim: close to the limit, one rep to spare')
    expect(plain(openSheet(mount([entry([w(60, 5)], {}, BENCH, { plan: { policy: 'linear', kind: 'first', why: ['No weight logged last time. Enter what you lift and progression takes it from there.'] } })])).textContent)).toContain('Aim: keep it easy')
  })

  it('a programme week\'s RPE is said in words, not as a number', () => {
    const plan = { policy: 'linear', kind: 'programme', weight: 100, why: ['Week {0} of {1}', 3, 8], prog: { rpe: 8 } }
    const text = plain(openSheet(mount([entry([w(100, 8)], {}, BENCH, { plan })])).textContent)
    expect(text).toContain('Aim: a couple of reps to spare')
    expect(text).not.toContain('RPE')
  })

  it('the progression line of a card with no sentence says the programme\'s RPE in words too', () => {
    const plan = { policy: 'linear', kind: 'programme', weight: 0, why: ['Week {0} of {1}', 3, 8], prog: { rpe: 9 } }
    const el = mount([entry([{ w: 0, r: 10, done: false }], { mode: 'reps', bodyweight: true, weight: 0 }, COCOONS, { plan })])
    details(el)
    const line = plain(el.querySelector('.progline').textContent)
    expect(line).toContain('Aim: close to the limit, one rep to spare')
    expect(line).not.toContain('RPE')
    expect(line).not.toContain('aim for')
  })
})

describe('Back to the suggested weight', () => {
  it('shows one row with the plan\'s weight when the open sets are not at it, and one tap puts them back', () => {
    const el = mount([entry([w(100), w(100), w(100)], { weight: 105 }, BENCH, { plan: up(105) })])
    const sheet = openSheet(el)
    expect(sheet.querySelectorAll('button.lrow')).toHaveLength(2)
    expect(plain(backRow(sheet).textContent)).toBe('Back to the suggested weight: 105 kg')
    act(() => backRow(sheet).click())
    expect(weights()).toEqual([105, 105, 105])
    expect(plain(sentences(el)[0].textContent)).toContain('105 kg total')
    expect(backRow(openSheet(el))).toBeUndefined()
  })

  it('leaves a done set and a warm-up alone, and the weight of the sets after the first follows', () => {
    const el = mount([entry([warm(40), w(100, 6, true), w(100), w(100)], { weight: 105 }, BENCH, { plan: up(105) })])
    const sheet = openSheet(el)
    act(() => backRow(sheet).click())
    expect(weights()).toEqual([40, 100, 105, 105])
    expect(useStore.getState().S.active.entries[0].sets[1].done).toBe(true)
  })

  it('a set typed by hand is put back too, and the sets keep following the first one afterwards', () => {
    const el = mount([entry([w(100), w(100), w(90)], { weight: 105 }, BENCH, { plan: up(105) })])
    const sheet = openSheet(el)
    act(() => backRow(sheet).click())
    expect(weights()).toEqual([105, 105, 105])
    const first = el.querySelector('.setrow .stp input')
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    act(() => { set.call(first, '110'); first.dispatchEvent(new Event('input', { bubbles: true })) })
    expect(weights()).toEqual([110, 110, 110])
  })

  it('no row when the open sets are already at the plan\'s weight', () => {
    const el = mount([entry([w(105), w(105)], { weight: 105 }, BENCH, { plan: up(105) })])
    expect(backRow(openSheet(el))).toBeUndefined()
  })

  it('no row without a suggestion: no plan, a first time, a plan with no weight', () => {
    expect(backRow(openSheet(mount([entry([w(100), w(100)], {}, BENCH)])))).toBeUndefined()
    expect(backRow(openSheet(mount([entry([w(100)], { weight: 105 }, BENCH, { plan: { policy: 'linear', kind: 'first', weight: 105, why: ['x'] } })])))).toBeUndefined()
    expect(backRow(openSheet(mount([entry([w(100)], { weight: 0 }, BENCH, { plan: up(0) })])))).toBeUndefined()
  })

  it('no row for a bodyweight exercise (plan weight 0), which has no weight sentence either', () => {
    const el = mount([entry([{ w: 0, r: 10, done: false }], { bodyweight: true, weight: 0 }, COCOONS, { plan: up(0) })])
    expect(sentences(el)).toHaveLength(0)
  })

  it('a pinned lb exercise compares and sets in lb, and stores the profile\'s kg', () => {
    const LB = { exUnit: withExUnit({}, BENCH, 'lb', 1) }
    const kg = v => storedWeight({ unit: 'kg', ...LB }, BENCH, v)
    const el = mount([entry([w(kg(215)), w(kg(215))], { weight: kg(225) }, BENCH, { plan: up(225) })], LB)
    const sheet = openSheet(el)
    expect(plain(backRow(sheet).textContent)).toBe('Back to the suggested weight: 225 lb')
    act(() => backRow(sheet).click())
    const stored = weights()
    expect(stored[0]).toBeCloseTo(kg(225), 3)
    expect(stored[1]).toBeCloseTo(kg(225), 3)
    expect(backRow(openSheet(el))).toBeUndefined()
  })

  it('a sled is put back as the total load, the sled\'s own weight untouched', () => {
    const SLED = { loadSetup: { [LEG_PRESS]: { kind: 'sled', base: 30, u: 'kg', _ts: 1 } } }
    const el = mount([entry([w(130, 10), w(130, 10)], { weight: 140 }, LEG_PRESS, { plan: up(140) })], SLED)
    expect(plain(sentences(el)[0].textContent)).toBe('130 kg total = sled 30 + 50 on each side')
    const sheet = openSheet(el)
    expect(plain(backRow(sheet).textContent)).toBe('Back to the suggested weight: 140 kg')
    act(() => backRow(sheet).click())
    expect(weights()).toEqual([140, 140])
    expect(plain(sentences(el)[0].textContent)).toBe('140 kg total = sled 30 + 55 on each side')
    expect(useStore.getState().S.loadSetup[LEG_PRESS].base).toBe(30)
  })

  it('a plan whose number is no longer the exercise\'s target shows no row', () => {
    const el = mount([entry([w(100), w(100)], { weight: 110 }, BENCH, { plan: up(105) })])
    expect(backRow(openSheet(el))).toBeUndefined()
  })
})
