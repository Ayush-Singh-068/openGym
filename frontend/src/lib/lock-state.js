/* Whether the PIN lock is showing, kept outside React so that App can leave the whole app out of
 * the page while it does: components/PinLock.jsx sets it, App.jsx reads it. A locked page holds
 * the lock screen and nothing else, so there is nothing behind it to read, tab to or tap. */
import { useSyncExternalStore } from 'react'
import { LOCAL_BUILD } from './demo.js'
import { hasPin } from './pin-lock.js'

let locked = LOCAL_BUILD && hasPin()
const listeners = new Set()

export const isLocked = () => locked

export function setLocked(next) {
  const value = !!next
  if (value === locked) return
  locked = value
  for (const fn of [...listeners]) fn()
}

export const subscribeLock = fn => { listeners.add(fn); return () => { listeners.delete(fn) } }

/** True while the lock screen is showing. */
export const useLocked = () => useSyncExternalStore(subscribeLock, isLocked, isLocked)
