import { describe, expect, it, vi } from 'vitest'
import { isLocked, setLocked, subscribeLock } from './lock-state.js'

describe('lock state', () => {
  it('starts unlocked in a test build and tells listeners only when it changes', () => {
    expect(isLocked()).toBe(false)
    const heard = vi.fn()
    const off = subscribeLock(heard)
    setLocked(true)
    expect(isLocked()).toBe(true)
    expect(heard).toHaveBeenCalledTimes(1)
    setLocked(true)
    expect(heard).toHaveBeenCalledTimes(1)
    setLocked(false)
    expect(isLocked()).toBe(false)
    expect(heard).toHaveBeenCalledTimes(2)
    off()
    setLocked(true)
    expect(heard).toHaveBeenCalledTimes(2)
    setLocked(false)
  })
})
