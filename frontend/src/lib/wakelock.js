// Screen Wake Lock — keeps the display on while a workout is running, so nobody has to
// unlock their phone between sets.
//
// The browser drops the lock on its own whenever the document stops being visible (tab
// switch, app backgrounded, screen locked by hand). A one-shot request therefore works
// exactly once and then silently dies, which is why `wanted` is kept as our own intent
// and the lock is re-acquired on every visibilitychange for as long as it holds.
import { useEffect, useSyncExternalStore } from 'react'

export const wakeLockSupported = () => 'wakeLock' in navigator

let sentinel = null       // the live WakeLockSentinel, null when we hold nothing
let wanted = false        // do we currently want the screen to stay on?
let pending = false       // a request() is in flight — don't stack a second one
let problem = false       // the lock was refused or unsupported, or dropped while the page was on screen
const listeners = new Set()
const notify = () => listeners.forEach(fn => { try { fn() } catch { /* a listener must not break the lock */ } })

/** Whether the screen is being kept on right now. */
export const wakeLockHeld = () => !!sentinel
/** Whether the lock is wanted but could not be had (refused, unsupported, or lost with the page on screen). */
export const wakeLockProblem = () => wanted && problem
/** 'held', 'problem' or 'idle', one value a component can subscribe to (useWakeLockStatus). */
export const wakeLockStatus = () => (wanted && problem ? 'problem' : sentinel ? 'held' : 'idle')
/** Calls `fn` whenever the lock is taken, lost or refused. Returns the function that stops it. */
export function onWakeLockChange(fn) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

async function acquire() {
  if (!wanted || sentinel || pending || !wakeLockSupported()) return
  if (document.visibilityState !== 'visible') return   // request() rejects on a hidden document
  pending = true
  try {
    const s = await navigator.wakeLock.request('screen')
    if (!wanted) { s.release().catch(() => {}); return }   // released while we were awaiting
    sentinel = s
    problem = false
    notify()
    s.addEventListener('release', () => {
      if (sentinel !== s) return
      sentinel = null
      // Dropped while the page is on screen (not the browser's own drop when the page hides): worth a word.
      if (wanted && document.visibilityState === 'visible') problem = true
      notify()
    })
  } catch (e) {
    // iOS refuses in Low Power Mode, and some browsers refuse on low battery. Nothing to
    // do about it and nothing the user could act on — stay quiet and try again next time
    // the document becomes visible.
    sentinel = null
    problem = true
    notify()
  } finally { pending = false }
}

const onVisible = () => { if (document.visibilityState === 'visible') acquire() }

export function requestWakeLock() {
  if (wanted) return
  wanted = true
  problem = !wakeLockSupported()
  document.addEventListener('visibilitychange', onVisible)
  acquire()
  if (problem) notify()
}

export function releaseWakeLock() {
  wanted = false
  document.removeEventListener('visibilitychange', onVisible)
  const s = sentinel
  sentinel = null
  if (s) s.release().catch(() => {})
  problem = false
  notify()
}

/** The lock's status for a component: 'held', 'problem' or 'idle'. */
export function useWakeLockStatus() {
  return useSyncExternalStore(onWakeLockChange, wakeLockStatus, () => 'idle')
}

// Holds the lock for as long as `enabled` stays true.
export function useWakeLock(enabled) {
  useEffect(() => {
    if (!enabled) return
    requestWakeLock()
    return releaseWakeLock
  }, [enabled])
}

/**
 * Whether this profile wants the screen kept on right now: a workout is running (not the editor of
 * a saved one), the setting is on, and the workout is not paused. A paused workout waits for you,
 * possibly for hours, and used to hold the screen awake the whole time (QA 1.4.5).
 */
export const wantsWakeLock = S => !!S?.active && !S.active.editingWorkoutId && !S.active.pausedAt && S.keepAwake !== false
