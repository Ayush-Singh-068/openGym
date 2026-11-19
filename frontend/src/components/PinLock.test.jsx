// @vitest-environment happy-dom
// The lock screen and the App lock rows (components/PinLock.jsx): Forgot PIN asks inside the app and
// never with window.confirm, a failed erase keeps the lock, the digits are dots, a blank new PIN is
// answered, and the lock can be turned off with the current PIN.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { webcrypto } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.mock('../lib/demo.js', async o => ({ ...(await o()), LOCAL_BUILD: true }))

const { default: PinLock, PinSettings } = await import('./PinLock.jsx')
const { setPin, hasPin, PIN_KEY } = await import('../lib/pin-lock.js')
const { setLocked, isLocked } = await import('../lib/lock-state.js')
const { useUI } = await import('../store/useUI.js')

let root, host
const DOTS = '••••'
const wait = ms => act(async () => { await new Promise(r => setTimeout(r, ms)) })
const text = () => document.body.textContent
const button = label => [...document.body.querySelectorAll('button')].find(b => b.textContent.trim().startsWith(label))
const field = label => document.body.querySelector(`input[aria-label="${label}"]`)
const type = (el, value) => {
  act(() => {
    Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value').set.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

beforeEach(() => {
  if (!globalThis.crypto?.subtle) Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true })
  localStorage.clear()
  useUI.setState({ toastMsg: '' })
  document.body.innerHTML = ''
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  setLocked(false)
  delete globalThis.indexedDB
})

describe('the lock screen', () => {
  it('shows dots for the digits, and a right PIN unlocks', async () => {
    await setPin('2468')
    setLocked(true)
    act(() => root.render(<PinLock />))
    const pin = field('PIN')
    type(pin, '2468')
    expect(field('PIN').value).toBe(DOTS)
    expect(field('PIN').type).toBe('text')
    await act(async () => { document.body.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
    for (let i = 0; i < 80 && isLocked(); i++) await wait(50)
    expect(isLocked()).toBe(false)
    expect(text()).not.toContain('Enter your PIN')
  })

  it('Forgot PIN asks in the app, not with window.confirm, and Cancel goes back to the PIN', async () => {
    await setPin('2468')
    window.confirm = vi.fn(() => true)
    setLocked(true)
    act(() => root.render(<PinLock />))
    act(() => { button('Forgot PIN?').click() })
    expect(window.confirm).not.toHaveBeenCalled()
    expect(text()).toContain('Erase this device’s data?')
    expect(text()).toContain('backup file')
    expect(button('Erase everything')).toBeTruthy()
    act(() => { button('Cancel').click() })
    expect(text()).toContain('Enter your PIN')
    expect(hasPin()).toBe(true)
    expect(isLocked()).toBe(true)
  })

  it('a failed erase keeps the lock and says so', async () => {
    await setPin('2468')
    globalThis.indexedDB = { deleteDatabase: () => { const r = {}; setTimeout(() => r.onerror?.(), 0); return r } }
    setLocked(true)
    act(() => root.render(<PinLock />))
    act(() => { button('Forgot PIN?').click() })
    act(() => { button('Erase everything').click() })
    await wait(60)
    expect(text()).toContain('The data could not be erased, so the lock stays on.')
    expect(hasPin()).toBe(true)
    expect(isLocked()).toBe(true)
    expect(text()).toContain('Enter your PIN')
  })
})

describe('App lock rows', () => {
  const has = label => [...document.body.querySelectorAll('button.lrow')].some(b => b.textContent.includes(label))
  const row = label => [...document.body.querySelectorAll('button.lrow')].find(b => b.textContent.includes(label))

  it('offers Change PIN and Turn off the lock while a PIN is set', async () => {
    await setPin('2468')
    act(() => root.render(<PinSettings />))
    expect(has('Change PIN')).toBe(true)
    expect(has('Turn off the lock')).toBe(true)
    expect(text()).toContain('Asks for your current PIN.')
  })

  it('a blank new PIN is answered with a message and nothing changes', () => {
    localStorage.setItem(PIN_KEY, JSON.stringify({ salt: '00', hash: '00' }))
    act(() => root.render(<PinSettings />))
    act(() => { row('Change PIN').click() })
    type(field('Current PIN'), '2468')
    expect(field('Current PIN').value).toBe(DOTS)
    act(() => { button('Save PIN').click() })
    expect(document.body.querySelector('[role="alert"]').textContent).toContain('Type a new PIN.')
    expect(hasPin()).toBe(true)
  })

  it('turns the lock off with the current PIN, and refuses a wrong one', async () => {
    await setPin('2468')
    act(() => root.render(<PinSettings />))
    act(() => { row('Turn off the lock').click() })
    type(field('Current PIN'), '1357')
    await act(async () => { button('Turn off').click() })
    for (let i = 0; i < 80 && !document.body.querySelector('[role="alert"]'); i++) await wait(50)
    expect(document.body.querySelector('[role="alert"]').textContent).toContain('That PIN is not right.')
    expect(hasPin()).toBe(true)
    type(field('Current PIN'), '2468')
    await act(async () => { button('Turn off').click() })
    for (let i = 0; i < 80 && hasPin(); i++) await wait(50)
    expect(hasPin()).toBe(false)
    expect(useUI.getState().toastMsg).toBe('App lock is off')
    expect(has('Lock the app with a PIN')).toBe(true)
  })
})
