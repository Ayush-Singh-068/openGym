// @vitest-environment happy-dom
import { describe, expect, it, vi } from 'vitest'

// Adaptive rest (Phase 1b N6): heavy 2x (cap 5:00), normal 1x, light 2/3 of the Rest timer, rounded to 15 s,
// only for a plain work set of a reps exercise; and the workout screen, the Lock Screen activity and the
// auto holds all read the one helper (restPlan), so they agree.
const h = vi.hoisted(() => { vi.stubEnv('VITE_MOBILE', '1'); return { platform: 'ios' } })
vi.mock('./mobile.js', () => ({ MOBILE: true, nativePlatform: async () => h.platform }))
vi.mock('@capacitor/core', () => ({ registerPlugin: name => h.registered?.(name) }))

const R = await import('./rest-adapt.js')
const L = await import('./live-activity.js')
const H = await import('./auto-holds.js')

const BENCH = '0025'   // barbell bench press: a big lift
const CURL = '0313'    // dumbbell hammer curl: a small muscle
const row = (r, extra = {}) => ({ w: 60, r, done: false, ...extra })
const ex = (id, rows, target = {}) => ({ id, target: { mode: 'reps', ...target }, sets: rows })
const S = (entries, extra = {}) => ({ unit: 'kg', restSec: 90, active: { id: 'w', cur: 0, entries }, ...extra })
const plan = (s, i = 0, idx = 0, unit = [idx], setRest = null) => R.restPlan(s, s.active.entries, unit, idx, i, setRest)

describe('which sets are heavy and light', () => {
  it('a big lift for 5 reps or fewer is heavy; 13 reps or more is light; the rest is normal', () => {
    expect(R.setClass(BENCH, 3)).toBe('heavy')
    expect(R.setClass(BENCH, 5)).toBe('heavy')
    expect(R.setClass(BENCH, 6)).toBe('normal')
    expect(R.setClass(BENCH, 12)).toBe('normal')
    expect(R.setClass(BENCH, 13)).toBe('light')
    expect(R.setClass(CURL, 5)).toBe('normal')
    expect(R.setClass(CURL, 15)).toBe('light')
  })
  it('a small muscle is light for the Aim only, never for the rest', () => {
    expect(R.setClass(CURL, 10)).toBe('normal')
    expect(R.setClass(CURL, 10, { small: true })).toBe('light')
    expect(R.setClass(BENCH, 10, { small: true })).toBe('normal')
  })
  it('no reps, or an exercise the catalogue does not know, is normal', () => {
    expect(R.setClass(BENCH, 0)).toBe('normal')
    expect(R.setClass(BENCH, undefined)).toBe('normal')
    expect(R.setClass('my-own-lift', 3)).toBe('normal')
  })
})

describe('the adapted length', () => {
  it('is twice for a heavy set, two thirds for a light one, rounded to 15 s', () => {
    expect([R.adaptedRest(90, 'heavy'), R.adaptedRest(90, 'normal'), R.adaptedRest(90, 'light')]).toEqual([180, 90, 60])
    expect([R.adaptedRest(120, 'heavy'), R.adaptedRest(120, 'light')]).toEqual([240, 75])
    expect([R.adaptedRest(45, 'heavy'), R.adaptedRest(45, 'light')]).toEqual([90, 30])
    expect([R.adaptedRest(60, 'light'), R.adaptedRest(75, 'heavy')]).toEqual([45, 150])
  })
  it('a heavy rest stops at 5:00 and a Rest timer already longer is not shortened', () => {
    expect(R.REST_ADAPT_MAX).toBe(300)
    expect(R.adaptedRest(180, 'heavy')).toBe(300)
    expect(R.adaptedRest(240, 'heavy')).toBe(300)
    expect(R.adaptedRest(400, 'heavy')).toBe(400)
    expect(R.adaptedRest(400, 'light')).toBe(270)
  })
  it('never goes under 15 s, and a timer that is off stays off', () => {
    expect(R.adaptedRest(30, 'light')).toBe(15)
    expect(R.adaptedRest(10, 'light')).toBe(10)
    expect(R.adaptedRest(0, 'heavy')).toBe(0)
  })
})

describe('restPlan: the rest after one set', () => {
  it('heavy, normal and light sets of the same lift', () => {
    const s = S([ex(BENCH, [row(5), row(8), row(15)])])
    expect(plan(s, 0)).toEqual({ sec: 180, tag: 'heavy' })
    expect(plan(s, 1)).toEqual({ sec: 90, tag: null })
    expect(plan(s, 2)).toEqual({ sec: 60, tag: 'light' })
  })
  it('follows the user\'s own Rest timer', () => {
    const s = S([ex(BENCH, [row(5), row(15)])], { restSec: 120 })
    expect(plan(s, 0)).toEqual({ sec: 240, tag: 'heavy' })
    expect(plan(s, 1)).toEqual({ sec: 75, tag: 'light' })
  })
  it('reads the reps of the exercise when the row has none', () => {
    const s = S([ex(BENCH, [{ w: 60, done: false }], { reps: 3 })])
    expect(plan(s, 0)).toEqual({ sec: 180, tag: 'heavy' })
  })
  it('does nothing with the switch off, an older profile reads as on', () => {
    expect(R.restAdaptOn({})).toBe(true)
    expect(R.restAdaptOn({ restAdapt: true })).toBe(true)
    expect(R.restAdaptOn({ restAdapt: false })).toBe(false)
    expect(plan(S([ex(BENCH, [row(5)])], { restAdapt: false }))).toEqual({ sec: 90, tag: null })
  })
  it('leaves the Rest timer off alone', () => {
    expect(plan(S([ex(BENCH, [row(5)])], { restSec: 0 }))).toEqual({ sec: 0, tag: null })
  })
  it('leaves an exercise\'s own rest and its "No timer" alone', () => {
    expect(plan(S([ex(BENCH, [row(5)], { restSec: 100 })]))).toEqual({ sec: 100, tag: null })
    expect(plan(S([ex(BENCH, [row(5)], { restOff: true })]))).toEqual({ sec: 0, tag: null })
  })
  it('leaves a set\'s own rest alone (a pyramid set)', () => {
    const s = S([ex(BENCH, [row(5)])])
    expect(plan(s, 0, 0, [0], { idx: 0, sec: 45 })).toEqual({ sec: 45, tag: null })
  })
  it('leaves a pyramid, a warm-up row, a hold and a superset alone', () => {
    expect(plan(S([ex(BENCH, [row(5)], { pyramid: [10, 8, 6] })]))).toEqual({ sec: 90, tag: null })
    expect(plan(S([ex(BENCH, [row(5, { phase: 'warmup' })])]))).toEqual({ sec: 90, tag: null })
    expect(plan(S([{ id: 'plank', target: { mode: 'time' }, sets: [{ sec: 30, done: false }] }]))).toEqual({ sec: 90, tag: null })
    const pair = S([{ ...ex(BENCH, [row(5)]), sg: 'g' }, { ...ex(CURL, [row(5)]), sg: 'g' }])
    expect(plan(pair, 0, 0, [0, 1])).toEqual({ sec: 90, tag: null })
  })
  it('a Rest timer of 5:00 or more has nothing to lengthen, so the bar says nothing', () => {
    expect(plan(S([ex(BENCH, [row(5)])], { restSec: 300 }))).toEqual({ sec: 300, tag: null })
  })
})

describe('the workout screen, the Lock Screen and the auto holds read one helper', () => {
  it('the Lock Screen forecast gives each set the rest restPlan gives it', () => {
    const s = S([ex(BENCH, [row(5), row(8), row(15)])])
    const want = [0, 1, 2].map(i => plan(s, i).sec)
    expect(want).toEqual([180, 90, 60])
    expect(L.upcomingSets(s).map(x => x.restAfter)).toEqual(want)
  })
  it('with the switch off every set rests the plain Rest timer in both', () => {
    const s = S([ex(BENCH, [row(5), row(15)])], { restAdapt: false })
    expect([0, 1].map(i => plan(s, i).sec)).toEqual([90, 90])
    expect(L.upcomingSets(s).map(x => x.restAfter)).toEqual([90, 90])
  })
  it('a set\'s own rest in the exercise is the same number in both', () => {
    const s = S([ex(BENCH, [row(5), row(5)], { restSec: 100 })])
    expect(plan(s, 0).sec).toBe(100)
    expect(L.upcomingSets(s).map(x => x.restAfter)).toEqual([100, 100])
  })
  it('a superset rests one round after another the same in both, never adapted', () => {
    const s = S([{ ...ex(BENCH, [row(5), row(5)]), sg: 'g' }, { ...ex(CURL, [row(5), row(5)]), sg: 'g' }])
    expect(L.upcomingSets(s).map(x => x.restAfter)).toEqual([0, 90, 0, 90])
    expect(plan(s, 0, 0, [0, 1]).sec).toBe(90)
  })
  it('a timed hold waits the same in the auto holds as restPlan says (never adapted)', () => {
    const e = { id: 'plank', target: { mode: 'time' }, sets: [{ sec: 30, done: false }, { sec: 30, done: false }, { sec: 30, done: false }] }
    const s = S([e], { autoHolds: true })
    const f = H.forecastHolds(s, { idx: 0, i: 0 }, { isTimed: () => true })
    expect(f.map(x => x.restBefore)).toEqual([plan(s, 0).sec, plan(s, 1).sec])
    expect(plan(s, 0)).toEqual({ sec: 90, tag: null })
  })
})
