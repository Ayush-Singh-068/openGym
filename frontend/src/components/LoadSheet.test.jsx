// @vitest-environment happy-dom
// "About this weight": the sentence, the plates for each side, the reason for the weight, and the way
// to change how the exercise is counted; a sled of unknown weight asks for it once.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import LoadSheet from './LoadSheet.jsx'
import { loadModel } from '../lib/load-setup.js'

const BENCH = '0025'
const LEG_PRESS = '2267'
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
const rowWith = (host, text) => [...host.querySelectorAll('button.lrow')].find(b => b.textContent.includes(text))
function type(input, text) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}
const S = (patch = {}) => ({ unit: 'kg', plates: {}, barWeights: {}, loadSetup: {}, ...patch })
const props = (model, extra = {}) => ({ model, name: 'Incline Bench', step: 2.5, why: '', onSaveBase: vi.fn(), onPickKind: vi.fn(), close: vi.fn(), ...extra })

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('About this weight', () => {
  it('shows the sentence, the plates for each side, the reason and the change row', () => {
    const model = loadModel(S(), { id: BENCH }, 100)
    const host = mount(<LoadSheet {...props(model, { why: 'Every set hit 8. Same weight, 9 reps this time.' })} />)
    expect(host.querySelector('h3').textContent).toBe('About this weight')
    expect(host.textContent).toContain('Incline Bench')
    expect(host.textContent).toContain('100 kg total = bar 20 + 40 on each side')
    expect(host.textContent).toContain('Each side: 25 + 15')
    expect(host.textContent).toContain('Why this weight: Every set hit 8. Same weight, 9 reps this time.')
    expect(rowWith(host, 'Change how this exercise is counted')).toBeTruthy()
  })

  it('leaves the reason out when there is none, and the plates for a kind without any', () => {
    const model = loadModel(S({ loadSetup: { [BENCH]: { kind: 'stack', base: null, u: 'kg', _ts: 1 } } }), { id: BENCH }, 45)
    const host = mount(<LoadSheet {...props(model)} />)
    expect(host.textContent).toContain('45 kg total (machine stack)')
    expect(host.textContent).not.toContain('Each side')
    expect(host.textContent).not.toContain('Why this weight')
  })

  it('changing how it is counted lists the six ways, marks the current one, and a pick is stored and closes', () => {
    const p = props(loadModel(S(), { id: BENCH }, 100))
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    expect(host.querySelector('h3').textContent).toBe('How is this exercise counted?')
    const rows = [...host.querySelectorAll('button.lrow')]
    expect(rows.map(r => r.querySelector('.lrow-t').textContent)).toEqual(['Bar and plates', 'Sled and plates', 'Machine stack', 'Dumbbells', 'Bodyweight plus added weight', 'Total load only'])
    expect(rows.map(r => !!r.querySelector('.lrow-k'))).toEqual([true, false, false, false, false, false])
    act(() => rowWith(host, 'Machine stack').click())
    expect(p.onPickKind).toHaveBeenCalledWith('stack')
    expect(p.close).toHaveBeenCalled()
  })

  it('picking the way it is already counted changes nothing', () => {
    const p = props(loadModel(S(), { id: BENCH }, 100))
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    act(() => rowWith(host, 'Bar and plates').click())
    expect(p.onPickKind).not.toHaveBeenCalled()
    expect(p.close).toHaveBeenCalled()
  })

  it('picking Sled and plates for an exercise that is not a sled goes on to ask for the sled weight', () => {
    const p = props(loadModel(S(), { id: BENCH }, 100))
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    act(() => rowWith(host, 'Sled and plates').click())
    expect(p.onPickKind).toHaveBeenCalledWith('sled')
    expect(p.close).not.toHaveBeenCalled()
    expect(host.querySelector('h3').textContent).toBe('Sled weight')
  })
})

describe('the sled weight, asked once', () => {
  it('a sled of unknown weight opens on one number field; Save waits for a weight and hands it back', () => {
    const p = props(loadModel(S(), { id: LEG_PRESS }, 130))
    const host = mount(<LoadSheet {...p} />)
    expect(host.querySelector('h3').textContent).toBe('Sled weight')
    expect(host.textContent).toContain('What does the empty sled weigh?')
    expect(host.querySelectorAll('input')).toHaveLength(1)
    expect(button(host, 'Save').disabled).toBe(true)
    type(host.querySelector('input'), '30')
    act(() => button(host, 'Save').click())
    expect(p.onSaveBase).toHaveBeenCalledWith(30)
    expect(p.close).toHaveBeenCalled()
  })

  it('a known sled opens on the sentence, with its weight on a row that opens the same question', () => {
    const state = S({ loadSetup: { [LEG_PRESS]: { kind: 'sled', base: 30, u: 'kg', _ts: 1 } } })
    const host = mount(<LoadSheet {...props(loadModel(state, { id: LEG_PRESS }, 130))} />)
    expect(host.querySelector('h3').textContent).toBe('About this weight')
    expect(host.textContent).toContain('130 kg total = sled 30 + 50 on each side')
    expect(host.textContent).toContain('Each side: 25 + 25')
    act(() => rowWith(host, 'Sled weight').click())
    expect(host.querySelector('h3').textContent).toBe('Sled weight')
    expect(host.querySelector('input').value).toBe('30')
  })

  it('the question has the way out to the other kinds, for a machine that is really a stack', () => {
    const p = props(loadModel(S(), { id: LEG_PRESS }, 130))
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    act(() => rowWith(host, 'Machine stack').click())
    expect(p.onPickKind).toHaveBeenCalledWith('stack')
    expect(p.close).toHaveBeenCalled()
  })
})

describe('what was picked is what the sheet says', () => {
  it('after Sled and plates is picked, the change row names it and not the way the sheet opened with', () => {
    const p = props(loadModel(S(), { id: BENCH }, 100))
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    act(() => rowWith(host, 'Sled and plates').click())
    expect(host.querySelector('h3').textContent).toBe('Sled weight')
    const row = rowWith(host, 'Change how this exercise is counted')
    expect(row.textContent).toContain('Sled and plates')
    expect(row.textContent).not.toContain('Bar and plates')
  })

  it('picking the way it was counted at first, after changing it, is a change back (stored)', () => {
    const p = props(loadModel(S(), { id: BENCH }, 100))
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    act(() => rowWith(host, 'Sled and plates').click())
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    expect(rowWith(host, 'Sled and plates').querySelector('.lrow-k')).not.toBeNull()
    expect(rowWith(host, 'Bar and plates').querySelector('.lrow-k')).toBeNull()
    act(() => rowWith(host, 'Bar and plates').click())
    expect(p.onPickKind).toHaveBeenNthCalledWith(1, 'sled')
    expect(p.onPickKind).toHaveBeenNthCalledWith(2, 'bar')
    expect(p.close).toHaveBeenCalled()
  })

  it('a sled weight that is already known is not asked for again', () => {
    const p = props(loadModel(S(), { id: BENCH }, 100), { sledBase: 30 })
    const host = mount(<LoadSheet {...p} />)
    act(() => rowWith(host, 'Change how this exercise is counted').click())
    act(() => rowWith(host, 'Sled and plates').click())
    expect(p.onPickKind).toHaveBeenCalledWith('sled')
    expect(p.close).toHaveBeenCalled()
    expect(host.querySelector('h3').textContent).not.toBe('Sled weight')
  })
})

describe('the Aim and the way back to the suggested weight', () => {
  it('shows the Aim between the plates and the reason, and nothing when there is none', () => {
    const model = loadModel(S(), { id: BENCH }, 100)
    const host = mount(<LoadSheet {...props(model, { why: 'Every set hit 8. Same weight, 9 reps this time.', aim: 'Aim: a couple of reps to spare' })} />)
    const text = host.textContent
    expect(text).toContain('Aim: a couple of reps to spare')
    expect(text.indexOf('Each side: 25 + 15')).toBeLessThan(text.indexOf('Aim:'))
    expect(text.indexOf('Aim:')).toBeLessThan(text.indexOf('Why this weight'))
    const none = mount(<LoadSheet {...props(model)} />)
    expect(none.textContent).not.toContain('Aim')
  })

  it('shows one row for the suggested weight; a tap applies it and closes the sheet', () => {
    const onApply = vi.fn()
    const p = props(loadModel(S(), { id: BENCH }, 100), { back: { label: '105 kg', onApply } })
    const host = mount(<LoadSheet {...p} />)
    const row = rowWith(host, 'Back to the suggested weight: 105 kg')
    expect(row).toBeTruthy()
    expect(host.querySelectorAll('button.lrow')).toHaveLength(2)
    act(() => row.click())
    expect(onApply).toHaveBeenCalledTimes(1)
    expect(p.close).toHaveBeenCalled()
  })

  it('has no such row without one, and the sled question never shows it', () => {
    const host = mount(<LoadSheet {...props(loadModel(S(), { id: BENCH }, 100))} />)
    expect(rowWith(host, 'Back to the suggested')).toBeUndefined()
    const sled = loadModel(S(), { id: LEG_PRESS }, 130)
    expect(sled.needsBase).toBe(true)
    const ask = mount(<LoadSheet {...props(sled, { aim: 'Aim: keep it easy', back: { label: '140 kg', onApply: vi.fn() } })} />)
    expect(ask.querySelector('h3').textContent).toBe('Sled weight')
    expect(ask.textContent).not.toContain('Aim:')
    expect(rowWith(ask, 'Back to the suggested')).toBeUndefined()
  })
})
