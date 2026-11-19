import { describe, expect, it } from 'vitest'
import { aimFromRpe, aimKind, aimLine } from './effort-aim.js'

// The Aim in plain words (Phase 1b N5): four phrases, chosen from what the app already knows.
const BENCH = '0025'   // barbell bench press
const CURL = '0313'    // dumbbell hammer curl

describe('the Aim of a set', () => {
  it('a heavy big lift (5 reps or fewer): a couple of reps to spare', () => {
    expect(aimKind({ id: BENCH, reps: 5 })).toBe('couple')
    expect(aimLine({ id: BENCH, reps: 3 })).toBe('Aim: a couple of reps to spare')
  })
  it('normal work: one or two reps to spare', () => {
    expect(aimKind({ id: BENCH, reps: 8 })).toBe('oneOrTwo')
    expect(aimLine({ id: BENCH, reps: 12 })).toBe('Aim: one or two reps to spare')
    expect(aimKind({ id: 'my-own-lift', reps: 3 })).toBe('oneOrTwo')
    expect(aimKind({ id: BENCH })).toBe('oneOrTwo')
  })
  it('light work, 13 reps or more or a small muscle: close to the limit, one rep to spare', () => {
    expect(aimKind({ id: BENCH, reps: 15 })).toBe('limit')
    expect(aimKind({ id: CURL, reps: 10 })).toBe('limit')
    expect(aimLine({ id: CURL, reps: 10 })).toBe('Aim: close to the limit, one rep to spare')
  })
  it('the first time with an exercise, or a deload: keep it easy', () => {
    expect(aimKind({ id: BENCH, reps: 5, plan: { kind: 'first' } })).toBe('easy')
    expect(aimKind({ id: BENCH, reps: 5, plan: { kind: 'deload' } })).toBe('easy')
    expect(aimKind({ id: BENCH, reps: 5, plan: { kind: 'deloadweek' } })).toBe('easy')
    expect(aimKind({ id: BENCH, reps: 5, plan: { kind: 'programme', prog: { deload: true, rpe: 9 } } })).toBe('easy')
    expect(aimKind({ id: BENCH, reps: 5, deload: true })).toBe('easy')
    expect(aimLine({ id: BENCH, reps: 5, plan: { kind: 'first' } })).toBe('Aim: keep it easy')
  })
  it('a programme week that carries an RPE: its RPE in words, before the lift decides', () => {
    expect(aimKind({ id: BENCH, reps: 5, plan: { kind: 'programme', prog: { rpe: 8 } } })).toBe('couple')
    expect(aimKind({ id: CURL, reps: 12, plan: { kind: 'programme', prog: { rpe: 8.5 } } })).toBe('oneOrTwo')
    expect(aimKind({ id: BENCH, reps: 8, plan: { kind: 'programme', prog: { rpe: 9.5 } } })).toBe('limit')
  })
  it('a plan with no RPE falls back to the lift', () => {
    expect(aimKind({ id: BENCH, reps: 5, plan: { kind: 'up', weight: 100 } })).toBe('couple')
  })
})

describe('an RPE in words', () => {
  it('10 and 9 close to the limit, 8.5 one or two, 8 down to 7 a couple, under 7 easy', () => {
    expect([10, 9.5, 9].map(aimFromRpe)).toEqual(['limit', 'limit', 'limit'])
    expect(aimFromRpe(8.5)).toBe('oneOrTwo')
    expect([8, 7.5, 7].map(aimFromRpe)).toEqual(['couple', 'couple', 'couple'])
    expect([6.5, 6, 5].map(aimFromRpe)).toEqual(['easy', 'easy', 'easy'])
  })
  it('no RPE, or one that is not a number, is nothing', () => {
    expect(aimFromRpe(null)).toBeNull()
    expect(aimFromRpe(undefined)).toBeNull()
    expect(aimFromRpe('')).toBeNull()
    expect(aimFromRpe('x')).toBeNull()
  })
})
