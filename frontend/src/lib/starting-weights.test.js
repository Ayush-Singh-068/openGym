// @vitest-environment happy-dom
// Starting weights: which lifts of the built-in six-day plan are asked about, and how the typed
// weights land in the routines and in what the first session shows.
import { describe, expect, it } from 'vitest'
import { DEF } from '../store/useStore.js'
import { parsePlan } from './plan-share.js'
import { SIX_DAY_PPL } from './plans/six-day-ppl.js'
import { applySixDayPpl } from './plans/load-six-day-ppl.js'
import { nextTargetsFor } from './next-targets.js'
import { startingWeightRows, applyStartingWeights, mainRoutineIds, isStartingWeightSlot } from './starting-weights.js'

const clone = v => JSON.parse(JSON.stringify(v))

// An empty state with the six-day plan loaded the way the app loads it.
function loaded(extra = {}) {
  const S = clone(DEF)
  Object.assign(S, { routines: [], week: {}, workouts: [], active: null }, extra)
  const result = applySixDayPpl(S, parsePlan(SIX_DAY_PPL, S.unit || 'kg'), { schedule: true })
  const ids = mainRoutineIds(S, result.ids, SIX_DAY_PPL.name)
  return { S, ids }
}
const slotOf = (S, routineName, exId) =>
  S.routines.find(r => r.name === routineName && r.folder === SIX_DAY_PPL.name).ex.find(x => x.id === exId)

describe('mainRoutineIds', () => {
  it('keeps only the six routines of the plan folder, not the Reduced Volume copies', () => {
    const S = clone(DEF)
    S.routines = []
    const result = applySixDayPpl(S, parsePlan(SIX_DAY_PPL, 'kg'), { schedule: true })
    expect(result.ids).toHaveLength(12)
    const ids = mainRoutineIds(S, result.ids, SIX_DAY_PPL.name)
    expect(ids).toHaveLength(6)
    expect(ids.map(id => S.routines.find(r => r.id === id).name)).toEqual(
      ['Pull Day 1', 'Push Day 1', 'Leg Day 1', 'Pull Day 2', 'Push Day 2', 'Leg Day 2'])
  })
})

describe('startingWeightRows', () => {
  it('lists each weighted lift of the six days once, in the order it first appears', () => {
    const { S, ids } = loaded()
    const rows = startingWeightRows(S, ids)
    expect(rows).toHaveLength(42)
    expect(new Set(rows.map(r => r.id)).size).toBe(42)
    expect(rows[0].id).toBe('0841')                       // Pull Day 1: weighted pull-up first
    expect(rows[0].routineNames).toEqual(['Pull Day 1'])
    expect(rows.map(r => r.routineId).filter((id, i, a) => a.indexOf(id) === i)).toEqual(ids)   // grouped by day, in plan order
    const face = rows.find(r => r.id === '5656')          // face pull is in both pull days: listed once, under the first
    expect(face.routineNames).toEqual(['Pull Day 1', 'Pull Day 2'])
    expect(face.routineId).toBe(ids[0])
    expect(rows.find(r => r.id === '0047').routineNames).toEqual(['Push Day 1'])   // incline barbell bench press
    expect(rows.every(r => r.name && r.name !== 'Unknown exercise')).toBe(true)
    expect(rows.every(r => r.step > 0 && r.unit === 'kg' && r.currentWeight === 0)).toBe(true)
  })

  it('leaves out holds, cardio, body-weight moves and the short warm-up slots', () => {
    const { S, ids } = loaded()
    const rows = startingWeightRows(S, ids)
    const got = new Set(rows.map(r => r.id))
    for (const id of ['5055', '1503', '4580', '3905', '0921', '0276', '0715', '0463', '3666', '9819', '7746']) {
      expect(got.has(id)).toBe(false)   // dead hang, band pull-apart, cat-cow, arm circles, band rotation, dead bug, side plank, plank, treadmill, knee raise, nordic
    }
    for (const r of ids.flatMap(id => S.routines.find(x => x.id === id).ex)) {
      if (got.has(r.id)) expect(isStartingWeightSlot(r)).toBe(true)
    }
  })

  it('uses the lift own increment, and shows weights in the unit the lift is pinned to', () => {
    const { S, ids } = loaded()
    S.exUnit = { '0047': { unit: 'lb', _ts: 1 } }
    slotOf(S, 'Push Day 1', '0047').weight = 20.4117
    const row = startingWeightRows(S, ids).find(r => r.id === '0047')
    expect(row.unit).toBe('lb')
    expect(row.step).toBe(5)                               // the lb default for a chest lift, not the slot's 2.5 kg step
    expect(row.currentWeight).toBeCloseTo(45, 1)
    expect(startingWeightRows(S, ids).find(r => r.id === '0289').unit).toBe('kg')
    expect(slotOf(S, 'Pull Day 1', '0841').inc).toBe(2.5)
    expect(startingWeightRows(S, ids).find(r => r.id === '0841').step).toBe(2.5)   // a slot's own step wins
  })

  it('gives no rows for routines that do not exist', () => {
    const { S } = loaded()
    expect(startingWeightRows(S, ['nope'])).toEqual([])
    expect(startingWeightRows(S, [])).toEqual([])
  })
})

describe('applyStartingWeights', () => {
  it('sets the weight on every slot of that lift in those routines and nothing else', () => {
    const { S, ids } = loaded()
    const before = clone(S.routines)
    const set = applyStartingWeights(S, ids, { '0047': 60, '5656': 25, '0289': 0, '1503': 5 })
    expect(set).toBe(3)                                    // incline bench once, face pull in two days
    expect(slotOf(S, 'Push Day 1', '0047').weight).toBe(60)
    expect(slotOf(S, 'Pull Day 1', '5656').weight).toBe(25)
    expect(slotOf(S, 'Pull Day 2', '5656').weight).toBe(25)
    expect(slotOf(S, 'Push Day 1', '0289').weight).toBe(0)           // zero means leave it
    expect(slotOf(S, 'Pull Day 1', '1503').weight).toBe(0)           // a band slot is never asked, so never set
    // The slot's alternatives and its other fields are as they were.
    const after = slotOf(S, 'Push Day 1', '0047')
    const was = before.find(r => r.name === 'Push Day 1' && r.folder === SIX_DAY_PPL.name).ex.find(x => x.id === '0047')
    expect(after).toEqual({ ...was, weight: 60 })
    // The Reduced Volume copy of Push Day 1 was not in the list, so it is untouched.
    const copy = S.routines.find(r => r.name.startsWith('Push Day 1') && r.name.includes('Reduced'))
    expect(copy.ex.find(x => x.id === '0047').weight).toBe(0)
  })

  it('ignores empty, negative and unknown entries', () => {
    const { S, ids } = loaded()
    expect(applyStartingWeights(S, ids, {})).toBe(0)
    expect(applyStartingWeights(S, ids, null)).toBe(0)
    expect(applyStartingWeights(S, ids, { '0047': -5, '0289': 'abc', nope: 40 })).toBe(0)
    expect(slotOf(S, 'Push Day 1', '0047').weight).toBe(0)
  })

  it('stores a weight typed in the other unit in the profile unit', () => {
    const { S, ids } = loaded()
    S.exUnit = { '0047': { unit: 'lb', _ts: 1 } }
    applyStartingWeights(S, ids, { '0047': 45, '0289': 30 })
    expect(slotOf(S, 'Push Day 1', '0047').weight).toBeCloseTo(20.4117, 3)   // 45 lb stored in kg
    expect(slotOf(S, 'Push Day 1', '0289').weight).toBe(30)                  // an unpinned lift is stored as typed
  })

  it('stores as typed when the profile itself is in lb', () => {
    const { S, ids } = loaded({ unit: 'lb' })
    applyStartingWeights(S, ids, { '0047': 135 })
    expect(slotOf(S, 'Push Day 1', '0047').weight).toBe(135)
  })

  it('makes the first session show the typed weight', () => {
    const { S, ids } = loaded()
    applyStartingWeights(S, ids, { '0047': 60 })
    const push = ids.find(id => S.routines.find(r => r.id === id).name === 'Push Day 1')
    const rows = nextTargetsFor(S, [push])[0].rows
    const incline = rows.find(r => r.exId === '0047')
    expect(incline.weight).toBe(60)
    expect(rows.find(r => r.exId === '0289').weight).toBe(null)   // a lift with no weight typed still has none
  })
})
