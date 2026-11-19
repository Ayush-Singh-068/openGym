import { describe, expect, it } from 'vitest'
import { commitStaged, weightOn } from './day-answers.js'
import { formOf } from './daily-form.js'
import { readingsOf } from './weigh-ins.js'

const D = '2026-11-06'
const base = (extra = {}) => ({ unit: 'kg', bodyweight: [], dayForm: {}, ...extra })
const saved = staged => ({ id: 'w1', d: D, ...(staged ? { staged } : {}) })

describe('weightOn', () => {
  it('is the weight of that day, and null for a day without one', () => {
    const S = base({ bodyweight: [{ d: D, w: 80.2, t: 5 }] })
    expect(weightOn(S, D)).toBe(80.2)
    expect(weightOn(S, '2026-11-05')).toBeNull()
    expect(weightOn(base(), D)).toBeNull()
    expect(weightOn(null, D)).toBeNull()
  })

  it('reads a day with readings as the day\'s value', () => {
    const S = base({ bodyweight: [{ d: D, w: 79, t: 9, ins: [{ id: 'a', at: '07:00', w: 79, t: 9 }, { id: 'b', at: '20:00', w: 81, t: 8 }] }] })
    expect(weightOn(S, D)).toBe(79)
  })
})

describe('commitStaged: what a saved workout wrote down at Start reaches its day', () => {
  it('writes the check-in with its lighter choice and the weight with its time, stamped now', () => {
    const S = base()
    const out = commitStaged(S, saved({ form: { sleep: 4, energy: null, sore: 2, stress: null }, lighter: 'sets', bw: { w: 80.24, at: '07:12' } }), 1234)
    expect(out).toEqual({ form: true, bw: true })
    expect(formOf(S, D)).toEqual({ sleep: 4, energy: null, sore: 2, stress: null, lighter: 'sets' })
    expect(S.dayForm[D]._ts).toBe(1234)
    expect(readingsOf(S.bodyweight[0])).toMatchObject([{ at: '07:12', w: 80.2, t: 1234 }])
    expect(S.bodyweight[0]).toMatchObject({ d: D, w: 80.2 })
  })

  it('writes nothing for a workout that staged nothing, and no empty check-in for an unanswered form', () => {
    const S = base()
    expect(commitStaged(S, saved(null), 1)).toEqual({ form: false, bw: false })
    expect(commitStaged(S, saved({ form: { sleep: null, energy: null, sore: null, stress: null } }), 1)).toEqual({ form: false, bw: false })
    expect(commitStaged(S, saved({ bw: { w: 0, at: '07:00' } }), 1)).toEqual({ form: false, bw: false })
    expect(S.dayForm).toEqual({})
    expect(S.bodyweight).toEqual([])
  })

  it('a day that already has a check-in or a weight keeps its own', () => {
    const S = base({ dayForm: { [D]: { sleep: 1, _ts: 7 } }, bodyweight: [{ d: D, w: 82, t: 7 }] })
    const out = commitStaged(S, saved({ form: { sleep: 5 }, bw: { w: 70, at: '07:00' } }), 99)
    expect(out).toEqual({ form: false, bw: false })
    expect(formOf(S, D).sleep).toBe(1)
    expect(S.bodyweight).toEqual([{ d: D, w: 82, t: 7 }])
  })

  it('files them under the workout\'s own day, not under the day of saving', () => {
    const S = base()
    commitStaged(S, { id: 'late', d: '2026-11-05', staged: { form: { sleep: 3 }, bw: { w: 75, at: '23:50' } } }, new Date('2026-11-06T00:20:00').getTime())
    expect(formOf(S, '2026-11-05').sleep).toBe(3)
    expect(formOf(S, D)).toBeNull()
    expect(S.bodyweight.map(b => b.d)).toEqual(['2026-11-05'])
  })
})
