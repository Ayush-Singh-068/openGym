import { describe, it, expect } from 'vitest'
import { markerAfterDone } from './list-marker.js'

const done = n => Array.from({ length: n }, () => ({ w: 60, r: 5, done: true }))
const open = n => Array.from({ length: n }, () => ({ w: 60, r: 5, done: false }))
const ex = (id, sets) => ({ id, sets })

describe('markerAfterDone', () => {
  it('stays put while the marked exercise still has an open set', () => {
    const entries = [ex('a', [...done(1), ...open(1)]), ex('b', open(2))]
    expect(markerAfterDone(entries, 0)).toBeNull()
  })

  it('moves to the next open exercise once the marked one is finished', () => {
    const entries = [ex('a', done(2)), ex('b', open(2)), ex('c', open(2))]
    expect(markerAfterDone(entries, 0)).toBe(1)
  })

  it('skips finished exercises after it', () => {
    const entries = [ex('a', done(2)), ex('b', done(2)), ex('c', open(2))]
    expect(markerAfterDone(entries, 0)).toBe(2)
  })

  it('wraps back to an open exercise before it when the marked one is the last', () => {
    const entries = [ex('a', open(2)), ex('b', done(2))]
    expect(markerAfterDone(entries, 1)).toBe(0)
  })

  it('returns null when nothing open is left', () => {
    const entries = [ex('a', done(2)), ex('b', done(2))]
    expect(markerAfterDone(entries, 0)).toBeNull()
  })

  it('keeps an exercise with no sets yet as the marked one', () => {
    const entries = [ex('a', []), ex('b', open(2))]
    expect(markerAfterDone(entries, 0)).toBeNull()
  })

  it('tolerates no workout', () => {
    expect(markerAfterDone(undefined, 0)).toBeNull()
    expect(markerAfterDone([], 0)).toBeNull()
  })
})
