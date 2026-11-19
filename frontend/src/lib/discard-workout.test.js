// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { DEF, useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { discardActiveWorkout } from './discard-workout.js'
import { discardedFor } from './watch-sync.js'

const clone = v => JSON.parse(JSON.stringify(v))

describe('discardActiveWorkout', () => {
  beforeEach(() => {
    localStorage.clear()
    const st = clone(DEF)
    Object.assign(st, { active: { id: 'run-1', d: '2026-11-06', start: 1, entries: [], staged: { form: { sleep: 4 }, bw: { w: 71, at: '12:00' } } }, dayForm: {}, bodyweight: [] })
    useStore.setState({ S: st, user: null })
  })

  it('ends the running workout with what it staged, names it for the watch, and stops the timers', () => {
    const stopRest = vi.spyOn(useUI.getState(), 'stopRest')
    const stopWork = vi.spyOn(useUI.getState(), 'stopWork')
    discardActiveWorkout()
    expect(useStore.getState().S.active).toBeNull()
    expect(discardedFor(Date.now())).toContain('run-1')
    expect(stopRest).toHaveBeenCalled()
    expect(stopWork).toHaveBeenCalled()
    expect(useStore.getState().S.dayForm).toEqual({})
    expect(useStore.getState().S.bodyweight).toEqual([])
  })

  it('is the one discard: the workout screen, the forgotten-workout card and the crash screen all use it', () => {
    for (const f of ['../views/Workout.jsx', '../App.jsx', '../components/ErrorBoundary.jsx']) {
      const src = readFileSync(new URL(f, import.meta.url), 'utf8')
      expect(src, f).toContain('discardActiveWorkout()')
      expect(src, f).not.toMatch(/s\.active = null/)
    }
  })
})
