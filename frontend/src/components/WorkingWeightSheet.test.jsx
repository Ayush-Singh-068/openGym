// @vitest-environment happy-dom
// The Working weight sheet: one number, Save and complete only once it is above 0.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import WorkingWeightSheet from './WorkingWeightSheet.jsx'

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
// Types into a field the way a keyboard does, so the field's own change handler runs.
function type(input, text) {
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  act(() => { set.call(input, text); input.dispatchEvent(new Event('input', { bubbles: true })) })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('WorkingWeightSheet', () => {
  it('has the title, the exercise, one number field with the unit, and Save and complete', () => {
    const host = mount(<WorkingWeightSheet name="Incline Bench" unit="kg" step={2.5} onSave={() => {}} />)
    expect(host.querySelector('h3').textContent).toBe('Working weight')
    expect(host.textContent).toContain('Incline Bench')
    expect(host.textContent).toContain('kg')
    expect(host.querySelectorAll('input')).toHaveLength(1)
    expect(button(host, 'Save and complete')).toBeTruthy()
  })

  it('Save and complete waits until there is a weight', () => {
    const onSave = vi.fn()
    const host = mount(<WorkingWeightSheet name="Incline Bench" unit="kg" step={2.5} onSave={onSave} />)
    expect(button(host, 'Save and complete').disabled).toBe(true)
    act(() => button(host, 'Save and complete').click())
    expect(onSave).not.toHaveBeenCalled()
  })

  it('hands back what was typed', () => {
    const onSave = vi.fn()
    const host = mount(<WorkingWeightSheet name="Incline Bench" unit="kg" step={2.5} onSave={onSave} />)
    type(host.querySelector('input'), '62.5')
    expect(button(host, 'Save and complete').disabled).toBe(false)
    act(() => button(host, 'Save and complete').click())
    expect(onSave).toHaveBeenCalledWith(62.5)
  })

  it('the + button steps by the exercise\'s step', () => {
    const onSave = vi.fn()
    const host = mount(<WorkingWeightSheet name="Curl" unit="lb" step={5} onSave={onSave} />)
    act(() => host.querySelector('button[aria-label^="Increase"]').click())
    act(() => button(host, 'Save and complete').click())
    expect(onSave).toHaveBeenCalledWith(5)
  })
})
