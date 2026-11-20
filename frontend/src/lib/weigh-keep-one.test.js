import { describe, expect, it } from 'vitest'
import { addWeighIn, readingsOf } from './weigh-ins.js'
import { keepOneWeighIn, readingToKeep, undoKeepOne } from './weigh-keep-one.js'

const D = '2026-11-18'
const dayWithThree = () => {
  const S = { bodyweight: [] }
  addWeighIn(S, { d: D, at: '07:00', w: 72, t: 1000, id: 'a' })
  addWeighIn(S, { d: D, at: '12:30', w: 73.4, t: 2000, id: 'b' })
  addWeighIn(S, { d: D, at: '21:00', w: 72.6, t: 3000, id: 'c' })
  return S
}
const idsOf = S => readingsOf(S.bodyweight.find(b => b.d === D)).map(r => r.id)

describe('readingToKeep', () => {
  const rs = [{ id: 'a', w: 72 }, { id: 'b', w: 73.4 }, { id: 'c', w: 72.6 }]
  it('the morning value is the first reading, the last value the last', () => {
    expect(readingToKeep(rs, 'first').id).toBe('a')
    expect(readingToKeep(rs, 'last').id).toBe('c')
  })
  it('for the average, the reading nearest to it, the earlier one on a tie', () => {
    expect(readingToKeep(rs, 'avg').id).toBe('c')
    expect(readingToKeep([{ id: 'x', w: 70 }, { id: 'y', w: 72 }], 'avg').id).toBe('x')
  })
  it('keeps nothing when there are no readings', () => {
    expect(readingToKeep([], 'first')).toBeNull()
  })
})

describe('keepOneWeighIn', () => {
  it('leaves the morning reading and removes the others', () => {
    const S = dayWithThree()
    const undos = keepOneWeighIn(S, D, 5000, 'first')
    expect(idsOf(S)).toEqual(['a'])
    expect(undos).toHaveLength(2)
    expect(S.bodyweight.find(b => b.d === D).w).toBe(72)
  })
  it('follows the last-value setting', () => {
    const S = dayWithThree()
    keepOneWeighIn(S, D, 5000, 'last')
    expect(idsOf(S)).toEqual(['c'])
  })
  it('Undo brings every reading back', () => {
    const S = dayWithThree()
    const undos = keepOneWeighIn(S, D, 5000, 'first')
    undoKeepOne(S, undos, 6000, 'first')
    expect(idsOf(S).sort()).toEqual(['a', 'b', 'c'])
  })
  it('does nothing on a day with one reading, or on a day that is not there', () => {
    const S = { bodyweight: [] }
    addWeighIn(S, { d: D, at: '07:00', w: 72, t: 1, id: 'a' })
    expect(keepOneWeighIn(S, D)).toEqual([])
    expect(keepOneWeighIn(S, '2026-01-01')).toEqual([])
    expect(idsOf(S)).toEqual(['a'])
  })
})
