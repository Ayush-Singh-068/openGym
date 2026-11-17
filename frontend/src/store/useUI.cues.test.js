// @vitest-environment happy-dom
// The rest timer's sound cues (lib/cue-sounds.js): a soft tick once at 10 seconds left, and at the
// end of a rest that knows what comes next that cue instead of the rest's own sound.
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), chime: vi.fn(), vibrate: vi.fn(), alertBuzz: vi.fn(), playTones: vi.fn() }))
vi.mock('../lib/api.js', () => ({ api: vi.fn(() => Promise.resolve({ ok: true })) }))

import { useUI, REST_KEY } from './useUI.js'
import { useStore } from './useStore.js'
import { CUES } from '../lib/cue-sounds.js'
import { chime, playTones } from '../lib/sound.js'

const notesOf = id => CUES.find(c => c.id === id).notes
let original
const withSettings = over => useStore.setState({ S: { ...original, sound: true, timerFlash: false, spokenCues: false, soundCues: {}, ...over }, user: null })

beforeEach(() => {
  vi.useFakeTimers()
  original = useStore.getState().S
  withSettings({})
  useUI.setState({ timer: null })
  chime.mockClear()
  playTones.mockClear()
})
afterEach(() => {
  useUI.getState().stopRest()
  useStore.setState({ S: original, user: null })
  vi.useRealTimers()
})

describe('10 seconds left', () => {
  it('ticks once, when 10 seconds are left', async () => {
    useUI.getState().startRest(30, 0)
    await vi.advanceTimersByTimeAsync(19000)
    expect(playTones).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1000)
    expect(playTones).toHaveBeenCalledTimes(1)
    expect(playTones.mock.calls[0][0]).toEqual(notesOf('tenLeft'))
    await vi.advanceTimersByTimeAsync(5000)
    expect(playTones).toHaveBeenCalledTimes(1)
  })
  it('stays quiet when the cue is switched off', async () => {
    withSettings({ soundCues: { tenLeft: false } })
    useUI.getState().startRest(30, 0)
    await vi.advanceTimersByTimeAsync(25000)
    expect(playTones).not.toHaveBeenCalled()
  })
  it('stays quiet with Sounds off', async () => {
    withSettings({ sound: false })
    useUI.getState().startRest(30, 0)
    await vi.advanceTimersByTimeAsync(25000)
    expect(playTones).not.toHaveBeenCalled()
  })
  it('stays quiet in a rest of 10 seconds or less', async () => {
    useUI.getState().startRest(10, 0)
    await vi.advanceTimersByTimeAsync(11000)
    expect(playTones).not.toHaveBeenCalled()
  })
  it('does not tick a second time when +15 s carries the rest past 10 seconds again', async () => {
    useUI.getState().startRest(30, 0)
    await vi.advanceTimersByTimeAsync(20000)
    expect(playTones).toHaveBeenCalledTimes(1)
    useUI.getState().addRest(15)
    await vi.advanceTimersByTimeAsync(16000)
    expect(playTones).toHaveBeenCalledTimes(1)
  })
})

describe('the end of a rest', () => {
  it('plays the cue for what comes next instead of the rest’s own sound', async () => {
    useUI.getState().startRest(3, 0, { nextKind: 'exercise' })
    expect(useUI.getState().timer.nextKind).toBe('exercise')
    await vi.advanceTimersByTimeAsync(4000)
    expect(playTones).toHaveBeenCalledWith(notesOf('nextExercise'), { volume: 1 })
    expect(chime).not.toHaveBeenCalled()
  })
  it('plays the last set cue for "last" and the superset tick for "superset"', async () => {
    useUI.getState().startRest(2, 0, { nextKind: 'last' })
    await vi.advanceTimersByTimeAsync(3000)
    expect(playTones).toHaveBeenLastCalledWith(notesOf('lastSet'), { volume: 1 })
    useUI.setState({ timer: null })
    useUI.getState().startRest(2, 0, { nextKind: 'superset' })
    await vi.advanceTimersByTimeAsync(3000)
    expect(playTones).toHaveBeenLastCalledWith(notesOf('supersetSwitch'), { volume: 1 })
  })
  it('plays the rest’s own sound when the next set is not known', async () => {
    useUI.getState().startRest(3, 0)
    await vi.advanceTimersByTimeAsync(4000)
    expect(chime).toHaveBeenCalledTimes(1)
    expect(playTones).not.toHaveBeenCalled()
  })
  it('plays the rest’s own sound when that cue is switched off', async () => {
    withSettings({ soundCues: { nextExercise: false } })
    useUI.getState().startRest(3, 0, { nextKind: 'exercise' })
    await vi.advanceTimersByTimeAsync(4000)
    expect(chime).toHaveBeenCalledTimes(1)
    expect(playTones).not.toHaveBeenCalled()
  })
  it('is silent with Sounds off', async () => {
    withSettings({ sound: false })
    useUI.getState().startRest(3, 0, { nextKind: 'exercise' })
    await vi.advanceTimersByTimeAsync(4000)
    expect(chime).not.toHaveBeenCalled()
    expect(playTones).not.toHaveBeenCalled()
  })
  it('does not keep an unknown kind, nor one on a switch-sides pause', () => {
    useUI.getState().startRest(5, 0, { nextKind: 'nap' })
    expect(useUI.getState().timer.nextKind).toBeUndefined()
    useUI.getState().startRest(5, 0, { kind: 'switch', nextKind: 'exercise' })
    expect(useUI.getState().timer.nextKind).toBeUndefined()
  })
  it('keeps the kind through +15 s from Ready and in the saved copy', async () => {
    useUI.getState().startRest(2, 0, { nextKind: 'last' })
    await vi.advanceTimersByTimeAsync(3000)
    expect(useUI.getState().timer.ready).toBe(true)
    useUI.getState().addRest(15)
    expect(useUI.getState().timer.nextKind).toBe('last')
    expect(JSON.parse(localStorage.getItem(REST_KEY)).nextKind).toBe('last')
  })
})
