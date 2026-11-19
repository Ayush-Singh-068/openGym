// @vitest-environment happy-dom
// The calm List card's two new lines and what went with them: one "Last time" line under the name
// (every set of the last session, from the history only), and ONE sentence about the weight under
// the current set ("100 kg total = bar 20 + 40 on each side"), live, tappable ("About this weight"),
// with the sled's own weight asked once. The old plate lines, Last time and progression line are no
// longer in Details, and a finished folded card says "Done · best set 62.5 kg × 6".
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
const plain = s => (s || '').replace(/[⁦-⁩‎‏‪-‮]/g, '')

const BENCH = '0025'       // barbell bench press
const CURL = '0313'        // dumbbell hammer curl
const LEG_PRESS = '2267'   // lever seated leg press
const w = (weight, done = false) => ({ w: weight, r: 6, done })
const warm = weight => ({ w: weight, r: 6, done: false, phase: 'warmup' })
const entry = (sets, target = {}, id = BENCH, extra = {}) => ({ id, target: { mode: 'reps', sets: sets.length, reps: 6, repsMin: 5, weight: sets[0]?.w || 0, ...target }, sets, ...extra })
const past = (id, sets) => ({ id: 'w-past', d: '2026-10-01', start: 1, end: 2, name: 'Push', entries: [{ id, target: { mode: 'reps', reps: 6 }, sets }] })

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
  S.active = { id: 'sentence-test', d: '2026-10-09', start: Date.now(), routineId: null, name: 'Sentence', bw: null, cur, entries, workoutView: S.workoutView }
  useStore.setState({ S, user: null })
  return render(<MemoryRouter><Workout /></MemoryRouter>)
}
const units = el => [...el.querySelectorAll('.wl-unit')]
const sentences = el => [...el.querySelectorAll('.calm-load')]
const sentence = el => plain(sentences(el)[0]?.textContent)
// The index of the set row a sentence sits under.
const rowOf = (el, s) => [...el.querySelectorAll('.setrow')].indexOf(s.parentElement.querySelector('.setrow'))
const buttonText = (root, text) => [...root.querySelectorAll('button')].find(b => b.textContent.trim() === text)
const sheetTop = () => render(useUI.getState().sheets.at(-1).render(() => {}))
function type(input, text) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
const tick = (el, n) => act(() => el.querySelector(`[aria-label^="Set ${n} done"]`).click())
const details = el => act(() => [...el.querySelectorAll('.calm-fold')].find(b => b.textContent.trim() === 'Details').click())

describe('one sentence about the weight, under the current set only', () => {
  it('says the total as bar plus plates on each side, under the first set to do', () => {
    const el = mount([entry([w(60), w(60), w(60)])])
    expect(sentences(el)).toHaveLength(1)
    expect(sentence(el)).toBe('60 kg total = bar 20 + 20 on each side')
    expect(rowOf(el, sentences(el)[0])).toBe(0)
  })

  it('moves down to the next set as one is ticked, and never shows twice', () => {
    const el = mount([entry([w(60), w(60), w(60)])])
    tick(el, 1)
    expect(sentences(el)).toHaveLength(1)
    expect(rowOf(el, sentences(el)[0])).toBe(1)
    tick(el, 2)
    expect(rowOf(el, sentences(el)[0])).toBe(2)
    tick(el, 3)
    expect(sentences(el)).toHaveLength(0)
  })

  it('follows the weight box as it changes', () => {
    const el = mount([entry([w(60), w(60)])])
    type(el.querySelector('.setrow .stp input'), '100')
    expect(sentence(el)).toBe('100 kg total = bar 20 + 40 on each side')
    type(el.querySelector('.setrow .stp input'), '65')
    expect(sentence(el)).toBe('65 kg total = bar 20 + 22.5 on each side')
  })

  it('a warm-up row never carries it: the first work set does', () => {
    const el = mount([entry([warm(40), w(60), w(60)])])
    expect(sentences(el)).toHaveLength(1)
    expect(sentence(el)).toBe('60 kg total = bar 20 + 20 on each side')
  })

  it('only the current exercise has one', () => {
    const el = mount([entry([w(60)]), entry([w(24)], {}, CURL)], { cur: 0 })
    expect(sentences(el)).toHaveLength(1)
    expect(units(el)[0].querySelector('.calm-load')).not.toBeNull()
    expect(units(el)[1].querySelector('.calm-load')).toBeNull()
    act(() => useStore.setState(st => ({ S: { ...st.S, active: { ...st.S.active, cur: 1 } } })))
    expect(units(el)[0].querySelector('.calm-load')).toBeNull()
    expect(plain(units(el)[1].querySelector('.calm-load').textContent)).toBe('24 kg per dumbbell')
  })

  it('says nothing for a plain body weight at 0, and for no weight', () => {
    expect(sentences(mount([entry([w(0), w(0)], { bodyweight: true }, '0260')]))).toHaveLength(0)
    expect(sentences(mount([entry([w(0), w(0)])]))).toHaveLength(0)
  })

  it('a weight the plates cannot make says so, in words', () => {
    const el = mount([entry([w(70)])], { plates: { kg: { 20: 1, 10: 1, _ts: 1 } } })
    expect(sentence(el)).toBe('Not possible with your plates: closest 60 kg')
  })

  it('is 13 px accent text with a 44 px tap height (the class carries both)', () => {
    const el = mount([entry([w(60)])])
    const b = sentences(el)[0]
    expect(b.tagName).toBe('BUTTON')
    expect(b.getAttribute('title')).toBe('About this weight')
  })

  it('the Cards layout keeps its own plate lines and shows no sentence', () => {
    const el = mount([entry([w(60), w(60)])], { workoutView: 'cards' })
    expect(sentences(el)).toHaveLength(0)
    expect(el.querySelectorAll('.plateline').length).toBeGreaterThan(0)
  })

  it('a saved workout being corrected has none', () => {
    const el = mount([entry([w(60)])])
    act(() => useStore.setState(st => ({ S: { ...st.S, active: { ...st.S.active, editingWorkoutId: 'saved' } } })))
    expect(sentences(el)).toHaveLength(0)
  })
})

describe('tapping it: About this weight', () => {
  it('lists the plates for each side and the way to change the counting', () => {
    const el = mount([entry([w(100)])])
    act(() => sentences(el)[0].click())
    const sheet = sheetTop()
    expect(sheet.querySelector('h3').textContent).toBe('About this weight')
    expect(sheet.textContent).toContain('100 kg total = bar 20 + 40 on each side')
    expect(sheet.textContent).toContain('Each side: 25 + 15')
    expect(sheet.textContent).toContain('Change how this exercise is counted')
    expect(sheet.textContent).not.toContain('Why this weight')
  })

  it('carries the progression reason, and the card does not show it twice', () => {
    const plan = { policy: 'linear', kind: 'up', weight: 62.5, why: ['Every set hit {0}. Same weight, {1} reps this time.', 6, 7] }
    const el = mount([entry([w(60), w(60)], {}, BENCH, { plan })])
    expect(el.querySelectorAll('.progline')).toHaveLength(0)
    details(el)
    expect(el.querySelectorAll('.progline')).toHaveLength(0)
    act(() => sentences(el)[0].click())
    expect(sheetTop().textContent).toContain('Why this weight: Every set hit 6. Same weight, 7 reps this time.')
  })

  it('"nothing logged yet" is not a reason for a weight', () => {
    const plan = { policy: 'linear', kind: 'first', why: ['Nothing logged yet, so this session sets the baseline.'] }
    const el = mount([entry([w(60)], {}, BENCH, { plan })])
    act(() => sentences(el)[0].click())
    expect(sheetTop().textContent).not.toContain('Why this weight')
  })

  it('a pick under "Change how this exercise is counted" is stored for that exercise and the sentence follows', () => {
    const el = mount([entry([w(60)])])
    act(() => sentences(el)[0].click())
    const sheet = sheetTop()
    act(() => [...sheet.querySelectorAll('button.lrow')].find(b => b.textContent.includes('Change how this exercise is counted')).click())
    act(() => [...sheet.querySelectorAll('button.lrow')].find(b => b.textContent.includes('Total load only')).click())
    const kept = useStore.getState().S.loadSetup[BENCH]
    expect(kept).toMatchObject({ kind: 'total', base: null, u: 'kg' })
    expect(typeof kept._ts).toBe('number')
    expect(sentence(el)).toBe('60 kg total')
  })
})

describe('a sled: its own weight, asked once', () => {
  it('asks in the sentence, keeps the answer for that exercise, and counts with it from then on', () => {
    const el = mount([entry([w(130), w(130)], { sets: 2, reps: 10, repsMin: 0 }, LEG_PRESS)])
    expect(sentence(el)).toBe('130 kg total · tap to set the sled weight')
    act(() => sentences(el)[0].click())
    const sheet = sheetTop()
    expect(sheet.querySelector('h3').textContent).toBe('Sled weight')
    expect(buttonText(sheet, 'Save').disabled).toBe(true)
    type(sheet.querySelector('input'), '30')
    act(() => buttonText(sheet, 'Save').click())
    expect(useStore.getState().S.loadSetup[LEG_PRESS]).toMatchObject({ kind: 'sled', base: 30, u: 'kg' })
    expect(sentence(el)).toBe('130 kg total = sled 30 + 50 on each side')
    // Asked once: the next tap is About this weight.
    act(() => sentences(el)[0].click())
    expect(sheetTop().querySelector('h3').textContent).toBe('About this weight')
  })
})

describe('Last time: one line under the name', () => {
  const hist = [past(BENCH, [w(57.5, true), w(57.5, true), { w: 57.5, r: 5, done: true }])]

  it('lists every set of the last session, weight × reps', () => {
    const el = mount([entry([w(60), w(60)])], { workouts: hist })
    expect(plain(el.querySelector('.calm-last').textContent)).toBe('Last time: 57.5 × 6 · 57.5 × 6 · 57.5 × 5')
  })

  it('is left out when there is no history', () => {
    expect(mount([entry([w(60)])]).querySelector('.calm-last')).toBeNull()
  })

  it('does not change when the rows of the running workout change', () => {
    const el = mount([entry([w(60), w(60)])], { workouts: hist })
    const before = el.querySelector('.calm-last').textContent
    type(el.querySelector('.setrow .stp input'), '100')
    tick(el, 1)
    expect(el.querySelector('.calm-last').textContent).toBe(before)
  })

  it('is not in Details any more, and Details keeps no plate lines', () => {
    const el = mount([entry([w(60), w(60)])], { workouts: hist })
    details(el)
    expect(el.querySelector('.refline')).toBeNull()
    expect(el.querySelector('.plateline')).toBeNull()
    expect(el.querySelector('.calm-details')).not.toBeNull()
  })
})

describe('the words on a finished, folded card', () => {
  it('"Done · best set 62.5 kg × 6" in place of the set count', () => {
    const done = entry([{ w: 60, r: 8, done: true }, { w: 62.5, r: 6, done: true }, { w: 62.5, r: 5, done: true }])
    const el = mount([done, entry([w(24)], {}, CURL)], { cur: 1, collapseCompleted: true })
    const summary = el.querySelector('button.wl-summary')
    expect(summary).not.toBeNull()
    expect(plain(summary.textContent)).toContain('Done · best set 62.5 kg × 6')
    expect(summary.textContent).not.toContain('3 sets')
  })
})

describe('an exercise that was given a loading before the sentence existed (S.loadKind)', () => {
  it('"no plates" reads as the total, the way Cards and Focus count it', () => {
    const el = mount([entry([w(100)])], { loadKind: { [BENCH]: { kind: 'none', _ts: 1 } } })
    expect(sentence(el)).toBe('100 kg total')
  })

  it('"one stack" reads as a sled, so its own weight is asked once', () => {
    const el = mount([entry([w(100)])], { loadKind: { [BENCH]: { kind: 'single', _ts: 1 } } })
    expect(sentence(el)).toBe('100 kg total · tap to set the sled weight')
  })

  it('a choice made under "Change how this exercise is counted" wins over it', () => {
    const el = mount([entry([w(100)])], {
      loadKind: { [BENCH]: { kind: 'none', _ts: 1 } },
      loadSetup: { [BENCH]: { kind: 'bar', base: null, u: 'kg', _ts: 2 } },
    })
    expect(sentence(el)).toBe('100 kg total = bar 20 + 40 on each side')
  })
})

describe('the progression reason stays reachable in Details when no sentence carries it', () => {
  const plan = { policy: 'linear', kind: 'up', weight: 62.5, why: ['Every set hit {0}. Same weight, {1} reps this time.', 6, 7] }
  const reason = 'Every set hit 6. Same weight, 7 reps this time.'

  it('a body-weight exercise has no sentence, so Details (closed until tapped) holds the reason and the link', () => {
    const el = mount([entry([w(0), w(0)], { bodyweight: true }, '0260', { plan })])
    expect(sentences(el)).toHaveLength(0)
    expect(el.querySelectorAll('.progline')).toHaveLength(0)
    details(el)
    expect(el.querySelectorAll('.progline')).toHaveLength(1)
    expect(el.querySelector('.progline').tagName).toBe('BUTTON')
    expect(plain(el.querySelector('.progline').textContent)).toContain(reason)
  })

  it('an exercise that is not the current one has no sentence, so its Details holds the reason', () => {
    const el = mount([entry([w(60), w(60)], {}, BENCH, { plan }), entry([w(24)], {}, CURL)], { cur: 1 })
    expect(units(el)[0].querySelector('.calm-load')).toBeNull()
    details(el)
    expect(units(el)[0].querySelectorAll('.progline')).toHaveLength(1)
    expect(plain(units(el)[0].querySelector('.progline').textContent)).toContain(reason)
  })

  it('with the Plates module off there is no sentence either, so Details holds the reason', () => {
    const el = mount([entry([w(60), w(60)], {}, BENCH, { plan })], { modules: { plates: false } })
    expect(sentences(el)).toHaveLength(0)
    details(el)
    expect(el.querySelectorAll('.progline')).toHaveLength(1)
    expect(plain(el.querySelector('.progline').textContent)).toContain(reason)
  })

  it('"nothing logged yet" is not carried by the sheet, so Details keeps it next to the sentence', () => {
    const first = { policy: 'linear', kind: 'first', why: ['Nothing logged yet, so this session sets the baseline.'] }
    const el = mount([entry([w(60)], {}, BENCH, { plan: first })])
    expect(sentences(el)).toHaveLength(1)
    details(el)
    expect(el.querySelectorAll('.progline')).toHaveLength(1)
    expect(plain(el.querySelector('.progline').textContent)).toContain('Nothing logged yet')
    act(() => sentences(el)[0].click())
    expect(sheetTop().textContent).not.toContain('Why this weight')
  })
})

describe('changing how an exercise is counted and changing it back keeps the sled weight', () => {
  const pick = (el, title) => {
    act(() => sentences(el)[0].click())
    const sheet = sheetTop()
    act(() => [...sheet.querySelectorAll('button.lrow')].find(b => b.textContent.includes('Change how this exercise is counted')).click())
    act(() => [...sheet.querySelectorAll('button.lrow')].find(b => b.textContent.includes(title)).click())
    return sheet
  }

  it('sled, then machine stack, then sled again counts with the same 30 and asks nothing', () => {
    const el = mount([entry([w(130), w(130)], { sets: 2, reps: 10, repsMin: 0 }, LEG_PRESS)])
    act(() => sentences(el)[0].click())
    const ask = sheetTop()
    type(ask.querySelector('input'), '30')
    act(() => buttonText(ask, 'Save').click())
    expect(sentence(el)).toBe('130 kg total = sled 30 + 50 on each side')
    pick(el, 'Machine stack')
    expect(sentence(el)).toBe('130 kg total (machine stack)')
    expect(useStore.getState().S.loadSetup[LEG_PRESS]).toMatchObject({ kind: 'stack', base: 30, u: 'kg' })
    const back = pick(el, 'Sled and plates')
    expect(back.querySelector('h3').textContent).not.toBe('Sled weight')
    expect(useStore.getState().S.loadSetup[LEG_PRESS]).toMatchObject({ kind: 'sled', base: 30, u: 'kg' })
    expect(sentence(el)).toBe('130 kg total = sled 30 + 50 on each side')
  })
})

describe('a sled of unknown weight: where the progression reason is', () => {
  const plan = { policy: 'linear', kind: 'up', weight: 140, why: ['Every set hit {0}. Same weight, {1} reps this time.', 10, 11] }
  const reason = 'Every set hit 10. Same weight, 11 reps this time.'
  const legs = () => mount([entry([w(130), w(130)], { sets: 2, reps: 10, repsMin: 0 }, LEG_PRESS, { plan })])

  it('while the sentence only asks for the sled weight the sheet cannot show the reason, so Details keeps it', () => {
    const el = legs()
    expect(sentence(el)).toBe('130 kg total · tap to set the sled weight')
    expect(el.querySelectorAll('.progline')).toHaveLength(0)
    details(el)
    expect(el.querySelectorAll('.progline')).toHaveLength(1)
    expect(plain(el.querySelector('.progline').textContent)).toContain(reason)
  })

  it('once the sled weight is saved the sheet carries the reason and Details drops it', () => {
    const el = legs()
    details(el)
    expect(el.querySelectorAll('.progline')).toHaveLength(1)
    act(() => sentences(el)[0].click())
    const ask = sheetTop()
    expect(ask.textContent).not.toContain('Why this weight')
    type(ask.querySelector('input'), '30')
    act(() => buttonText(ask, 'Save').click())
    expect(sentence(el)).toBe('130 kg total = sled 30 + 50 on each side')
    expect(el.querySelectorAll('.progline')).toHaveLength(0)
    act(() => sentences(el)[0].click())
    expect(sheetTop().textContent).toContain('Why this weight: ' + reason)
  })
})
