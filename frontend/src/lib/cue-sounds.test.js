// @vitest-environment happy-dom
// lib/cue-sounds.js: the cue data, which cue a rest end gets, what comes next (nextKindOf), and
// that the master volume and a cue's switch really decide what reaches the audio context. The
// fake context records the gain peaks the real one would be asked for.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { CUES, CUE_IDS, NEXT_KINDS, cueForRestEnd, cueEnabled, volumeOf, nextKindOf } from './cue-sounds.js'

describe('the cue data', () => {
  it('has the six cues, in order', () => {
    expect(CUE_IDS).toEqual(['nextSet', 'nextExercise', 'lastSet', 'supersetSwitch', 'tenLeft', 'workoutDone'])
  })
  it('names each one and says what it is', () => {
    for (const c of CUES) {
      expect(c.label.trim(), c.id).not.toBe('')
      expect(c.description.trim(), c.id).not.toBe('')
      expect(`${c.label}${c.description}`, c.id).not.toContain('—')
    }
  })
  it('has the planned number of notes', () => {
    const counts = Object.fromEntries(CUES.map(c => [c.id, c.notes.length]))
    expect(counts).toEqual({ nextSet: 2, nextExercise: 3, lastSet: 3, supersetSwitch: 1, tenLeft: 1, workoutDone: 5 })
  })
  it('keeps every note in range and every cue under 1.2 seconds', () => {
    for (const c of CUES) {
      let end = 0
      for (const n of c.notes) {
        expect(n.freq, c.id).toBeGreaterThanOrEqual(400)
        expect(n.freq, c.id).toBeLessThanOrEqual(3000)
        expect(n.peak, c.id).toBeGreaterThan(0)
        expect(n.peak, c.id).toBeLessThanOrEqual(1)
        expect(n.dur, c.id).toBeGreaterThanOrEqual(60)
        expect(n.at, c.id).toBeGreaterThanOrEqual(0)
        expect(['sine', 'bright'], c.id).toContain(n.wave)
        end = Math.max(end, n.at + n.dur)
      }
      expect(end, c.id).toBeLessThan(1200)
    }
  })
  it('never overlaps two notes of one cue, so the peaks never add up', () => {
    for (const c of CUES) {
      const notes = [...c.notes].sort((a, b) => a.at - b.at)
      for (let i = 1; i < notes.length; i++) expect(notes[i].at, c.id).toBeGreaterThanOrEqual(notes[i - 1].at + notes[i - 1].dur)
    }
  })
  it('gives every cue a tune of its own', () => {
    const tunes = CUES.map(c => c.notes.map(n => n.freq).join('-'))
    expect(new Set(tunes).size).toBe(CUES.length)
  })
  it('rises for next set, next exercise and the fanfare, and goes low, high, low for the last set', () => {
    const f = id => CUES.find(c => c.id === id).notes.map(n => n.freq)
    for (const id of ['nextSet', 'nextExercise', 'workoutDone']) {
      const hz = f(id)
      expect(hz, id).toEqual([...hz].sort((a, b) => a - b))
    }
    const [a, b, c] = f('lastSet')
    expect(a).toBeLessThan(b)
    expect(c).toBeLessThan(b)
    expect(a).toBe(c)
  })
})

describe('cueForRestEnd', () => {
  it('maps what follows to a cue', () => {
    expect(cueForRestEnd({ nextKind: 'set' })).toBe('nextSet')
    expect(cueForRestEnd({ nextKind: 'exercise' })).toBe('nextExercise')
    expect(cueForRestEnd({ nextKind: 'last' })).toBe('lastSet')
    expect(cueForRestEnd({ nextKind: 'superset' })).toBe('supersetSwitch')
  })
  it('knows every kind nextKindOf can answer', () => {
    for (const k of NEXT_KINDS) expect(cueForRestEnd({ nextKind: k }), k).toBeTruthy()
  })
  it('answers null when the next set is not known', () => {
    expect(cueForRestEnd({})).toBe(null)
    expect(cueForRestEnd()).toBe(null)
    expect(cueForRestEnd({ nextKind: undefined })).toBe(null)
    expect(cueForRestEnd({ nextKind: null })).toBe(null)
    expect(cueForRestEnd({ nextKind: 'nap' })).toBe(null)
    expect(cueForRestEnd({ nextKind: '__proto__' })).toBe(null)
  })
})

describe('cueEnabled and volumeOf', () => {
  it('is on unless that cue was switched off', () => {
    expect(cueEnabled(undefined, 'lastSet')).toBe(true)
    expect(cueEnabled({}, 'lastSet')).toBe(true)
    expect(cueEnabled({ soundCues: {} }, 'lastSet')).toBe(true)
    expect(cueEnabled({ soundCues: null }, 'lastSet')).toBe(true)
    expect(cueEnabled({ soundCues: { lastSet: true } }, 'lastSet')).toBe(true)
    expect(cueEnabled({ soundCues: { lastSet: false } }, 'lastSet')).toBe(false)
    expect(cueEnabled({ soundCues: { lastSet: false } }, 'nextSet')).toBe(true)
  })
  it('reads the volume, full when missing or broken, clamped to 0 to 1', () => {
    expect(volumeOf(undefined)).toBe(1)
    expect(volumeOf({})).toBe(1)
    expect(volumeOf({ soundVolume: 0.4 })).toBe(0.4)
    expect(volumeOf({ soundVolume: 0 })).toBe(0)
    expect(volumeOf({ soundVolume: 5 })).toBe(1)
    expect(volumeOf({ soundVolume: -2 })).toBe(0)
    expect(volumeOf({ soundVolume: 'loud' })).toBe(1)
    expect(volumeOf({ soundVolume: NaN })).toBe(1)
  })
})

// Entries as the workout holds them after a set was ticked: { sets: [{ done }], sg: superset id }.
const set = (done, extra = {}) => ({ done, w: 20, r: 8, ...extra })
const ex = (dones, sg) => ({ id: 'x', ...(sg ? { sg } : {}), sets: dones.map(d => set(d)) })

describe('nextKindOf', () => {
  it('is "set" between the sets of one exercise', () => {
    expect(nextKindOf([ex([true, false, false])], 0, 0)).toBe('set')
  })
  it('is "last" when the next set is the exercise’s final one', () => {
    expect(nextKindOf([ex([true, true, false])], 0, 1)).toBe('last')
  })
  it('is "exercise" after the last set of an exercise when another follows', () => {
    expect(nextKindOf([ex([true, true, true]), ex([false, false])], 0, 2)).toBe('exercise')
  })
  it('is "exercise" even when the next exercise has a single set', () => {
    expect(nextKindOf([ex([true]), ex([false])], 0, 0)).toBe('exercise')
  })
  it('is undefined when nothing is left, the workout is over', () => {
    expect(nextKindOf([ex([true, true])], 0, 1)).toBeUndefined()
  })
  it('counts the ticked set as done even when the entries still show it open', () => {
    expect(nextKindOf([ex([false, false, false])], 0, 0)).toBe('set')
    expect(nextKindOf([ex([false, false])], 0, 1)).toBe('last')
  })
  it('is "superset" between the members of a superset', () => {
    expect(nextKindOf([ex([true, false, false], 's'), ex([false, false, false], 's')], 0, 0)).toBe('superset')
    expect(nextKindOf([ex([true, false, false], 's'), ex([true, false, false], 's')], 1, 0)).toBe('superset')
  })
  it('is "last" when a superset member’s final set is next', () => {
    expect(nextKindOf([ex([true, true, false], 's'), ex([true, true, false], 's')], 1, 1)).toBe('last')
  })
  it('stays on the one member that still has sets left', () => {
    expect(nextKindOf([ex([true], 's'), ex([true, false], 's')], 1, 0)).toBe('last')
    expect(nextKindOf([ex([true], 's'), ex([true, false, false], 's')], 1, 0)).toBe('set')
  })
  it('leaves a finished superset for the next exercise', () => {
    expect(nextKindOf([ex([true], 's'), ex([true], 's'), ex([false, false])], 1, 0)).toBe('exercise')
  })
  it('keeps two neighbouring supersets with different ids apart', () => {
    expect(nextKindOf([ex([true], 's'), ex([false, false], 't')], 0, 0)).toBe('exercise')
  })
  it('treats a warm-up that follows in the same exercise as just the next set, never the last', () => {
    const warm = { id: 'x', sets: [set(true, { phase: 'warmup' }), set(false, { phase: 'warmup' }), set(false), set(false)] }
    expect(nextKindOf([warm], 0, 0)).toBe('set')
    const warmLast = { id: 'x', sets: [set(true), set(false, { phase: 'warmup' })] }
    expect(nextKindOf([warmLast], 0, 0)).toBe('set')
  })
  it('counts a per-side set as open until both sides are done', () => {
    const side = (l, r) => ({ done: l && r, sides: { L: { done: l }, R: { done: r } } })
    expect(nextKindOf([{ id: 'x', sets: [side(true, true), side(true, false)] }], 0, 0)).toBe('last')
  })
  it('answers undefined for input it cannot use', () => {
    expect(nextKindOf(null, 0, 0)).toBeUndefined()
    expect(nextKindOf([], 0, 0)).toBeUndefined()
    expect(nextKindOf([ex([false])], 5, 0)).toBeUndefined()
    expect(nextKindOf([ex([false])], '0', 0)).toBeUndefined()
    expect(nextKindOf([ex([false])], -1, 0)).toBeUndefined()
  })
})

// The master volume and the switches, through a fake AudioContext that records every gain ramp.
class FakeCtx {
  constructor() {
    this.state = 'running'
    this.currentTime = 0
    this.destination = {}
    this.ramps = []
    this.starts = []
    FakeCtx.last = this
  }
  resume() { return Promise.resolve() }
  suspend() { return Promise.resolve() }
  createGain() {
    const ctx = this
    return { connect() {}, gain: { setValueAtTime() {}, exponentialRampToValueAtTime(v) { ctx.ramps.push(v) } } }
  }
  createOscillator() {
    const ctx = this
    return { frequency: { value: 0, setValueAtTime() {}, linearRampToValueAtTime() {} }, type: '', connect() {}, setPeriodicWave() {}, start(at) { ctx.starts.push(at) }, stop() {} }
  }
  createPeriodicWave() { return {} }
}
FakeCtx.last = null

describe('the audio path', () => {
  let sound
  let cues
  const peak = () => Math.max(...FakeCtx.last.ramps)
  beforeEach(async () => {
    vi.useFakeTimers()
    FakeCtx.last = null
    window.AudioContext = FakeCtx
    vi.resetModules()
    sound = await import('./sound.js')
    cues = await import('./cue-sounds.js')
  })
  afterEach(() => {
    vi.useRealTimers()
    delete window.AudioContext
  })

  it('plays every note of a cue at full volume, at its own time and peak', () => {
    expect(cues.playCue('nextExercise')).toBe(true)
    expect(FakeCtx.last.starts).toHaveLength(3)
    expect(FakeCtx.last.starts[0]).toBeCloseTo(0, 6)
    expect(FakeCtx.last.starts[1]).toBeCloseTo(0.17, 6)
    expect(FakeCtx.last.starts[2]).toBeCloseTo(0.34, 6)
    expect(peak()).toBeCloseTo(0.9, 6)
  })
  it('scales every peak by the master volume', () => {
    sound.setMasterVolume(0.5)
    cues.playCue('nextExercise')
    expect(peak()).toBeCloseTo(0.45, 6)
  })
  it('scales by the call’s own volume on top of the master volume', () => {
    sound.setMasterVolume(0.5)
    cues.playCue('nextExercise', { volume: 0.5 })
    expect(peak()).toBeCloseTo(0.225, 6)
  })
  it('goes down to the silent floor at volume 0 without throwing', () => {
    sound.setMasterVolume(0)
    expect(() => cues.playCue('workoutDone')).not.toThrow()
    expect(FakeCtx.last.starts).toHaveLength(5)
    expect(peak()).toBeCloseTo(0.001, 6)
  })
  it('scales the older beeps too, they share the one place', () => {
    sound.setMasterVolume(0.5)
    sound.beep(true, 880, 0.1)
    expect(peak()).toBeCloseTo(0.175, 6)
  })
  it('clamps the master volume and treats a non-number as full', () => {
    sound.setMasterVolume(7)
    expect(sound.getMasterVolume()).toBe(1)
    sound.setMasterVolume(-1)
    expect(sound.getMasterVolume()).toBe(0)
    sound.setMasterVolume('loud')
    expect(sound.getMasterVolume()).toBe(1)
    sound.setMasterVolume(undefined)
    expect(sound.getMasterVolume()).toBe(1)
    sound.setMasterVolume(null)
    expect(sound.getMasterVolume()).toBe(1)
  })
  it('does not play an unknown cue', () => {
    expect(cues.playCue('nope')).toBe(false)
    expect(FakeCtx.last).toBe(null)
  })
  it('playCueIf needs Sounds on and the cue’s switch on', () => {
    expect(cues.playCueIf({ sound: false }, 'nextSet')).toBe(false)
    expect(cues.playCueIf({ sound: true, soundCues: { nextSet: false } }, 'nextSet')).toBe(false)
    expect(cues.playCueIf(undefined, 'nextSet')).toBe(false)
    expect(FakeCtx.last).toBe(null)
    expect(cues.playCueIf({ sound: true }, 'nextSet')).toBe(true)
    expect(FakeCtx.last.starts).toHaveLength(2)
  })
})
