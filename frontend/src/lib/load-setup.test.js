// How an exercise's weight is counted (S.loadSetup) and the one sentence the workout card says about it.
import { describe, expect, it } from 'vitest'
import { EXIDX } from './exercises.js'
import { LOAD_KINDS, defaultLoadKind, loadSetupFor, loadModel, withLoadSetup, sledBaseFor } from './load-setup.js'

const BENCH = '0025'      // barbell bench press
const DB_BENCH = '0289'   // dumbbell bench press
const COCOONS = '0260'    // body weight
const PULLUP = '0841'     // weighted pull-up (equipment: weighted)
const LEG_PRESS = '2267'  // lever seated leg press (a plate-loaded machine, filed as a leverage machine)
const HACK = '5516'       // lever hack squat
const CABLE = '0201'      // cable pushdown
const BAND = '0993'       // band pull-apart
const S = (patch = {}) => ({ unit: 'kg', plates: {}, barWeights: {}, loadSetup: {}, ...patch })

describe('the exercises used here are what the tests assume', () => {
  it('equipment tags', () => {
    expect(EXIDX[BENCH].eq).toBe('barbell')
    expect(EXIDX[DB_BENCH].eq).toBe('dumbbell')
    expect(EXIDX[COCOONS].eq).toBe('body weight')
    expect(EXIDX[PULLUP].eq).toBe('weighted')
    expect(EXIDX[LEG_PRESS].eq).toBe('leverage machine')
    expect(EXIDX[LEG_PRESS].n).toMatch(/leg press/)
    expect(EXIDX[HACK].n).toMatch(/hack squat/)
    expect(EXIDX[CABLE].eq).toBe('cable')
    expect(EXIDX[BAND].eq).toBe('band')
  })
})

describe('defaultLoadKind', () => {
  it('follows the catalogue equipment', () => {
    expect(defaultLoadKind({ id: BENCH })).toBe('bar')
    expect(defaultLoadKind({ id: DB_BENCH })).toBe('dumbbell')
    expect(defaultLoadKind({ id: COCOONS })).toBe('bodyweight')
    expect(defaultLoadKind({ id: PULLUP })).toBe('bodyweight')
    expect(defaultLoadKind({ id: LEG_PRESS })).toBe('sled')
    expect(defaultLoadKind({ id: HACK })).toBe('sled')
    expect(defaultLoadKind({ id: CABLE })).toBe('stack')
    expect(defaultLoadKind({ id: BAND })).toBe('total')
    expect(defaultLoadKind({ id: 'no-such-exercise' })).toBe('total')
  })

  it('a leverage machine that is not plate-loaded is a stack', () => {
    const stack = Object.values(EXIDX).find(e => e.eq === 'leverage machine' && !/leg press|hack squat|belt squat|pendulum squat|plate loaded/i.test(e.n))
    expect(defaultLoadKind({ id: stack.id })).toBe('stack')
  })

  it('the exercise\'s own bodyweight switch counts', () => {
    expect(defaultLoadKind({ id: COCOONS, bodyweight: false })).toBe('total')
  })
})

describe('loadSetupFor', () => {
  it('a bar exercise starts from the profile\'s bar: 20 kg, 45 lb, or your own', () => {
    expect(loadSetupFor(S(), { id: BENCH })).toEqual({ kind: 'bar', base: 20, custom: false })
    expect(loadSetupFor(S({ unit: 'lb' }), { id: BENCH }).base).toBe(45)
    expect(loadSetupFor(S({ barDefaults: { kg: { barbell: 15 } } }), { id: BENCH }).base).toBe(15)
    expect(loadSetupFor(S({ barWeights: { [BENCH]: 0 } }), { id: BENCH }).base).toBe(0)
  })

  it('a sled is unknown until it is set, here or in Settings', () => {
    expect(loadSetupFor(S(), { id: LEG_PRESS })).toEqual({ kind: 'sled', base: null, custom: false })
    expect(loadSetupFor(S({ barWeights: { [LEG_PRESS]: 45 } }), { id: LEG_PRESS }).base).toBe(45)
    const own = { [LEG_PRESS]: { kind: 'sled', base: 30, u: 'kg', _ts: 1 } }
    expect(loadSetupFor(S({ loadSetup: own }), { id: LEG_PRESS })).toEqual({ kind: 'sled', base: 30, custom: true })
  })

  it('a sled weight kept in kg is not read as lb', () => {
    const own = { [LEG_PRESS]: { kind: 'sled', base: 30, u: 'kg', _ts: 1 } }
    expect(loadSetupFor(S({ unit: 'lb', loadSetup: own }), { id: LEG_PRESS }).base).toBe(null)
  })

  it('a chosen kind wins over the equipment', () => {
    const own = { [BENCH]: { kind: 'total', base: null, u: 'kg', _ts: 1 } }
    expect(loadSetupFor(S({ loadSetup: own }), { id: BENCH })).toEqual({ kind: 'total', base: null, custom: true })
  })

  it('every kind the sheet offers is known', () => {
    expect(LOAD_KINDS).toEqual(['bar', 'sled', 'stack', 'dumbbell', 'bodyweight', 'total'])
  })
})

describe('loadModel: the sentence', () => {
  const say = (state, id, w, opts) => loadModel(state, { id }, w, opts).text

  it('a barbell: bar plus plates on each side', () => {
    expect(say(S(), BENCH, 100)).toBe('100 kg total = bar 20 + 40 on each side')
    expect(say(S(), BENCH, 60)).toBe('60 kg total = bar 20 + 20 on each side')
    expect(loadModel(S(), { id: BENCH }, 100).plates).toEqual([25, 15])
    expect(loadModel(S(), { id: BENCH }, 60).plates).toEqual([20])
  })

  it('lb profiles say lb and use lb plates', () => {
    const lb = S({ unit: 'lb' })
    expect(say(lb, BENCH, 225)).toBe('225 lb total = bar 45 + 90 on each side')
    expect(loadModel(lb, { id: BENCH }, 225).plates).toEqual([45, 45])
  })

  it('just the bar, and lighter than the bar', () => {
    expect(say(S(), BENCH, 20)).toBe('20 kg total = just the bar')
    expect(say(S(), BENCH, 15)).toBe('15 kg is lighter than the bar (20 kg)')
  })

  it('no bar (an explicit 0): everything is on the sides', () => {
    expect(say(S({ barWeights: { [BENCH]: 0 } }), BENCH, 60)).toBe('60 kg total = 30 on each side')
  })

  it('a weight the plates you own cannot make says so, with the closest one', () => {
    const own = S({ plates: { kg: { 20: 1, 10: 1, _ts: 1 } } })
    const m = loadModel(own, { id: BENCH }, 70)
    expect(m.text).toBe('Not possible with your plates: closest 60 kg')
    expect(m.closest).toBe(60)
    expect(say(own, BENCH, 80)).toBe('80 kg total = bar 20 + 30 on each side')
  })

  it('a plate-loaded machine: the sled, then plates on each side', () => {
    const state = S({ loadSetup: { [LEG_PRESS]: { kind: 'sled', base: 30, u: 'kg', _ts: 1 } } })
    expect(say(state, LEG_PRESS, 130)).toBe('130 kg total = sled 30 + 50 on each side')
    expect(say(state, LEG_PRESS, 30)).toBe('30 kg total = just the sled')
    expect(say(state, LEG_PRESS, 20)).toBe('20 kg is lighter than the sled (30 kg)')
  })

  it('a sled nobody has weighed asks for its weight', () => {
    const m = loadModel(S(), { id: LEG_PRESS }, 130)
    expect(m.text).toBe('130 kg total · tap to set the sled weight')
    expect(m.needsBase).toBe(true)
    expect(loadModel(S(), { id: BENCH }, 100).needsBase).toBe(false)
  })

  it('a machine stack or a cable', () => {
    expect(say(S(), CABLE, 45)).toBe('45 kg total (machine stack)')
  })

  it('dumbbells: per dumbbell, or both together when the exercise logs the total', () => {
    expect(say(S(), DB_BENCH, 24)).toBe('24 kg per dumbbell')
    expect(say(S(), DB_BENCH, 48, { bells: 'total' })).toBe('48 kg total = 24 kg per dumbbell')
    expect(say(S(), DB_BENCH, 24, { bells: 'each' })).toBe('24 kg per dumbbell')
  })

  it('weighted body weight reads as bodyweight plus the load; plain body weight says nothing', () => {
    expect(say(S(), PULLUP, 10)).toBe('bodyweight + 10 kg')
    expect(say(S(), COCOONS, 0)).toBe('')
    expect(say(S(), BENCH, 0)).toBe('')
  })

  it('a chosen kind changes the words', () => {
    const state = S({ loadSetup: { [BENCH]: { kind: 'total', base: null, u: 'kg', _ts: 1 } } })
    expect(say(state, BENCH, 60)).toBe('60 kg total')
    expect(loadModel(state, { id: BENCH }, 60).plates).toBe(null)
  })

  it('a half kilo reads as it is', () => {
    expect(say(S(), BENCH, 62.5)).toBe('62.5 kg total = bar 20 + 21.25 on each side')
  })
})

describe('withLoadSetup', () => {
  it('stamps the entry and keeps the others', () => {
    const before = { [BENCH]: { kind: 'total', base: null, u: 'kg', _ts: 1 } }
    const after = withLoadSetup(before, LEG_PRESS, 'sled', { base: 30, unit: 'kg', now: 99 })
    expect(after[LEG_PRESS]).toEqual({ kind: 'sled', base: 30, u: 'kg', _ts: 99 })
    expect(after[BENCH]).toBe(before[BENCH])
    expect(before[LEG_PRESS]).toBeUndefined()
  })

  it('a base of 0 or nothing is stored as unknown; a missing map starts one', () => {
    expect(withLoadSetup(undefined, HACK, 'bar', { unit: 'lb', now: 5 })[HACK]).toEqual({ kind: 'bar', base: null, u: 'lb', _ts: 5 })
    expect(withLoadSetup({}, HACK, 'sled', { base: 0, now: 5 })[HACK].base).toBe(null)
  })
})

describe('an exercise that already has a loading in S.loadKind (chosen before loadSetup existed)', () => {
  const old = (id, value) => S({ loadKind: { [id]: value } })

  it('"no plates" counts as the total on a bar exercise, a sled and a body-weight exercise', () => {
    for (const id of [BENCH, LEG_PRESS, PULLUP]) {
      const st = old(id, { kind: 'none', _ts: 1 })
      expect(defaultLoadKind({ id }, st)).toBe('total')
      expect(loadSetupFor(st, { id })).toEqual({ kind: 'total', base: null, custom: false })
    }
    expect(loadModel(old(BENCH, { kind: 'none', _ts: 1 }), { id: BENCH }, 100).text).toBe('100 kg total')
  })

  it('"no plates" keeps the dumbbell and the stack wording (the bare string is how the first builds stored it)', () => {
    expect(defaultLoadKind({ id: DB_BENCH }, old(DB_BENCH, { kind: 'none', _ts: 1 }))).toBe('dumbbell')
    expect(defaultLoadKind({ id: CABLE }, old(CABLE, 'none'))).toBe('stack')
  })

  it('"one stack" is a sled, or bodyweight for a body-weight exercise', () => {
    const one = id => old(id, { kind: 'single', _ts: 1 })
    expect(defaultLoadKind({ id: BENCH }, one(BENCH))).toBe('sled')
    expect(defaultLoadKind({ id: CABLE }, one(CABLE))).toBe('sled')
    expect(defaultLoadKind({ id: LEG_PRESS }, one(LEG_PRESS))).toBe('sled')
    expect(defaultLoadKind({ id: PULLUP }, one(PULLUP))).toBe('bodyweight')
    expect(loadModel(one(BENCH), { id: BENCH }, 100).needsBase).toBe(true)
  })

  it('"pairs" is the bar on a bar exercise and a sled anywhere else', () => {
    const pairs = id => old(id, { kind: 'pairs', _ts: 1 })
    expect(defaultLoadKind({ id: BENCH }, pairs(BENCH))).toBe('bar')
    expect(defaultLoadKind({ id: LEG_PRESS }, pairs(LEG_PRESS))).toBe('sled')
    expect(defaultLoadKind({ id: CABLE }, pairs(CABLE))).toBe('sled')
  })

  it('a loadSetup entry wins over the old choice', () => {
    const st = S({ loadKind: { [BENCH]: { kind: 'none', _ts: 1 } }, loadSetup: { [BENCH]: { kind: 'bar', base: null, u: 'kg', _ts: 2 } } })
    expect(loadSetupFor(st, { id: BENCH })).toEqual({ kind: 'bar', base: 20, custom: true })
  })

  it('with no old choice, or no state given, the equipment decides', () => {
    expect(defaultLoadKind({ id: BENCH }, S())).toBe('bar')
    expect(defaultLoadKind({ id: BENCH })).toBe('bar')
    expect(defaultLoadKind({ id: LEG_PRESS }, undefined)).toBe('sled')
  })
})

describe('the sled weight is kept whatever the counting is changed to', () => {
  it('sled, then machine stack, then sled again counts with the same weight and asks nothing', () => {
    let map = withLoadSetup({}, LEG_PRESS, 'sled', { base: 30, unit: 'kg', now: 1 })
    map = withLoadSetup(map, LEG_PRESS, 'stack', { unit: 'kg', now: 2 })
    expect(map[LEG_PRESS]).toEqual({ kind: 'stack', base: 30, u: 'kg', _ts: 2 })
    expect(loadSetupFor(S({ loadSetup: map }), { id: LEG_PRESS })).toEqual({ kind: 'stack', base: null, custom: true })
    map = withLoadSetup(map, LEG_PRESS, 'sled', { unit: 'kg', now: 3 })
    expect(loadSetupFor(S({ loadSetup: map }), { id: LEG_PRESS })).toEqual({ kind: 'sled', base: 30, custom: true })
    expect(loadModel(S({ loadSetup: map }), { id: LEG_PRESS }, 130).text).toBe('130 kg total = sled 30 + 50 on each side')
  })

  it('an answer given in the other unit is not carried over', () => {
    const map = withLoadSetup(withLoadSetup({}, LEG_PRESS, 'sled', { base: 30, unit: 'kg', now: 1 }), LEG_PRESS, 'stack', { unit: 'lb', now: 2 })
    expect(map[LEG_PRESS].base).toBe(null)
  })

  it('a new answer replaces the kept one', () => {
    const first = withLoadSetup({}, LEG_PRESS, 'sled', { base: 30, unit: 'kg', now: 1 })
    expect(withLoadSetup(first, LEG_PRESS, 'sled', { base: 35, unit: 'kg', now: 2 })[LEG_PRESS].base).toBe(35)
  })

  it('a bar never reads the kept sled weight as its own', () => {
    const map = withLoadSetup(withLoadSetup({}, BENCH, 'sled', { base: 30, unit: 'kg', now: 1 }), BENCH, 'bar', { unit: 'kg', now: 2 })
    expect(map[BENCH].base).toBe(30)
    expect(loadSetupFor(S({ loadSetup: map }), { id: BENCH }).base).toBe(20)
  })

  it('sledBaseFor: the kept answer, a weight kept in Settings for a plate-loaded machine, else 0', () => {
    const map = withLoadSetup({}, LEG_PRESS, 'stack', { base: 30, unit: 'kg', now: 1 })
    expect(sledBaseFor(S({ loadSetup: map }), { id: LEG_PRESS })).toBe(30)
    expect(sledBaseFor(S({ unit: 'lb', loadSetup: map }), { id: LEG_PRESS })).toBe(0)
    expect(sledBaseFor(S({ barWeights: { [LEG_PRESS]: 45 } }), { id: LEG_PRESS })).toBe(45)
    expect(sledBaseFor(S({ barWeights: { [BENCH]: 15 } }), { id: BENCH })).toBe(0)
    expect(sledBaseFor(S(), { id: LEG_PRESS })).toBe(0)
  })

  it('a sled counted on a barbell never takes the bar weight kept in Settings: the sentence and the sheet agree', () => {
    const st = S({ barWeights: { [BENCH]: 15 }, loadSetup: { [BENCH]: { kind: 'sled', base: null, u: 'kg', _ts: 1 } } })
    expect(sledBaseFor(st, { id: BENCH })).toBe(0)
    expect(loadSetupFor(st, { id: BENCH })).toEqual({ kind: 'sled', base: null, custom: true })
    const m = loadModel(st, { id: BENCH }, 100)
    expect(m.needsBase).toBe(true)
    expect(m.text).toBe('100 kg total · tap to set the sled weight')
  })

  it('on a plate-loaded machine a weight kept in Settings is still the sled weight', () => {
    expect(loadSetupFor(S({ barWeights: { [LEG_PRESS]: 45 } }), { id: LEG_PRESS })).toEqual({ kind: 'sled', base: 45, custom: false })
  })
})
