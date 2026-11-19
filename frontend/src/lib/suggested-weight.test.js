import { describe, expect, it } from 'vitest'
import { backToPlan, suggestedWeight, withSuggestedWeight } from './suggested-weight.js'

// "Back to the suggested weight" (Phase 1b N3): the plan's weight, and the open work rows that are not at it.
const row = (w, extra = {}) => ({ w, r: 6, done: false, ...extra })
const warm = w => row(w, { phase: 'warmup' })
const plan = (weight, extra = {}) => ({ policy: 'linear', kind: 'up', weight, why: ['x'], ...extra })
const ent = (rows, w = 105, extra = {}) => ({ id: '0025', target: { mode: 'reps', weight: w, reps: 6 }, plan: plan(w), sets: rows, ...extra })
const sideRow = (lw, rw, ld = false, rd = false) => ({ w: Math.max(lw, rw), r: 12, done: ld && rd, sides: { L: { w: lw, r: 6, done: ld }, R: { w: rw, r: 6, done: rd } } })

describe('the suggested weight', () => {
  it('is the plan\'s weight', () => {
    expect(suggestedWeight(ent([row(100)]))).toBe(105)
  })
  it('is none without a plan, on a first session, with progression off, or for a session target', () => {
    expect(suggestedWeight({ ...ent([row(100)]), plan: undefined })).toBe(0)
    expect(suggestedWeight(ent([row(100)], 105, { plan: plan(105, { kind: 'first' }) }))).toBe(0)
    expect(suggestedWeight(ent([row(100)], 105, { plan: plan(105, { kind: 'off' }) }))).toBe(0)
    expect(suggestedWeight(ent([row(100)], 105, { plan: plan(105, { policy: 'off' }) }))).toBe(0)
    expect(suggestedWeight(ent([row(100)], 105, { sessionTarget: { by: 'coach' } }))).toBe(0)
  })
  it('is none for a bodyweight plan (weight 0)', () => {
    expect(suggestedWeight(ent([row(0)], 0))).toBe(0)
    expect(suggestedWeight(ent([row(0)], 0, { plan: plan(0) }))).toBe(0)
  })
  it('is none for a pyramid or back-off sets: there is no one weight', () => {
    const e = ent([row(100)])
    expect(suggestedWeight({ ...e, target: { ...e.target, pyramid: [10, 8, 6] } })).toBe(0)
    expect(suggestedWeight({ ...e, target: { ...e.target, backoffStep: 5 } })).toBe(0)
  })
  it('is none when the plan\'s number is no longer the exercise\'s target (edited, or another unit)', () => {
    const e = ent([row(100)])
    expect(suggestedWeight({ ...e, target: { ...e.target, weight: 110 } })).toBe(0)
    expect(suggestedWeight({ ...e, target: { ...e.target, weight: 105.04 } })).toBe(105)
  })
})

describe('the rows that are not at it', () => {
  it('lists every open work row that differs', () => {
    expect(backToPlan(ent([row(100), row(100), row(100)]))).toEqual({ w: 105, rows: [0, 1, 2] })
  })
  it('skips warm-ups, done rows and rows already at the weight', () => {
    expect(backToPlan(ent([warm(40), row(100, { done: true }), row(100), row(105), row(102.5)]))).toEqual({ w: 105, rows: [2, 4] })
  })
  it('is null when nothing differs, or nothing is open', () => {
    expect(backToPlan(ent([row(105), row(105)]))).toBeNull()
    expect(backToPlan(ent([row(100, { done: true }), row(100, { done: true })]))).toBeNull()
    expect(backToPlan(ent([row(104.995), row(105)]))).toBeNull()
  })
  it('is null with no suggestion', () => {
    expect(backToPlan({ ...ent([row(100)]), plan: undefined })).toBeNull()
  })
  it('a per-side row counts when a side still to do differs', () => {
    expect(backToPlan(ent([sideRow(100, 100)]))).toEqual({ w: 105, rows: [0] })
    expect(backToPlan(ent([sideRow(100, 105, true, false)]))).toBeNull()
    expect(backToPlan(ent([sideRow(100, 100, true, false)]))).toEqual({ w: 105, rows: [0] })
    expect(backToPlan(ent([sideRow(105, 105)]))).toBeNull()
  })
})

describe('putting the weight back', () => {
  it('sets the listed rows and nothing else, and drops the typed-by-hand mark', () => {
    const sets = [warm(40), row(100, { done: true }), row(100, { weightOrigin: 'manual' }), row(105), row(102.5)]
    const out = withSuggestedWeight(sets, 105, [2, 4])
    expect(out.map(s => s.w)).toEqual([40, 100, 105, 105, 105])
    expect(out[2]).not.toHaveProperty('weightOrigin')
    expect(out[1]).toBe(sets[1])
    expect(out[3]).toBe(sets[3])
    expect(sets[2].w).toBe(100)
  })
  it('a per-side row changes the sides still to do and keeps a side already done', () => {
    const out = withSuggestedWeight([sideRow(100, 100, true, false)], 105, [0])
    expect(out[0].sides.L).toMatchObject({ w: 100, done: true })
    expect(out[0].sides.R).toMatchObject({ w: 105, done: false })
    expect(out[0].w).toBe(105)
  })
  it('a row that is not listed, or is done, stays as it is', () => {
    const sets = [row(100, { done: true }), row(100)]
    expect(withSuggestedWeight(sets, 105, [0]).map(s => s.w)).toEqual([100, 100])
    expect(withSuggestedWeight(sets, 105, [])).toEqual(sets)
  })
})
