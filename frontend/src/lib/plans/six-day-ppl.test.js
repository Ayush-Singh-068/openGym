import { describe, expect, it } from 'vitest'
import { SIX_DAY_PPL } from './six-day-ppl.js'
import { parsePlan } from '../plan-share.js'
import { EXIDX } from '../exercises.js'

const slotsOf = routine => routine.ex
const allSlots = () => SIX_DAY_PPL.routines.flatMap(r => r.ex.map(e => ({ routine: r.id, e })))

describe('six-day PPL built-in plan', () => {
  it('imports through parsePlan with every slot kept', () => {
    const bundle = parsePlan(SIX_DAY_PPL, 'kg')
    expect(bundle.routines).toHaveLength(6)
    expect(bundle.dropped).toBe(0)
    bundle.routines.forEach((r, i) => {
      expect(r.ex).toHaveLength(SIX_DAY_PPL.routines[i].ex.length)
    })
  })

  it('maps Monday to Saturday onto the six routines, Sunday is rest', () => {
    const ids = SIX_DAY_PPL.routines.map(r => r.id)
    expect(new Set(ids).size).toBe(6)
    expect(Object.keys(SIX_DAY_PPL.week).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(SIX_DAY_PPL.week).not.toHaveProperty('0')
    const scheduled = ['1', '2', '3', '4', '5', '6'].map(d => SIX_DAY_PPL.week[d][0])
    expect(scheduled.sort()).toEqual([...ids].sort())
  })

  it('uses only catalogue exercise ids for slots and subs', () => {
    for (const { e } of allSlots()) {
      expect(EXIDX[e.id], `unknown id ${e.id}`).toBeTruthy()
      for (const s of e.subs || []) {
        expect(EXIDX[s], `unknown sub ${s}`).toBeTruthy()
        expect(s).not.toBe(e.id)
      }
      if (e.subs) expect(new Set(e.subs).size).toBe(e.subs.length)
    }
  })

  it('keeps notes within 280 characters and numbers in range', () => {
    for (const { e } of allSlots()) {
      if (e.note != null) expect(e.note.length).toBeLessThanOrEqual(280)
      expect(e.sets).toBeGreaterThanOrEqual(1)
      expect(e.sets).toBeLessThanOrEqual(20)
      if (e.reps != null) expect(e.reps).toBeLessThanOrEqual(100)
      if (e.repsMin != null) {
        expect(e.repsMin).toBeLessThan(e.reps)
      }
      if (e.restSec != null) expect(e.restSec).toBeLessThanOrEqual(900)
    }
  })

  it('gives time slots a duration and the time progression', () => {
    const timed = allSlots().filter(({ e }) => e.mode === 'time')
    expect(timed.length).toBeGreaterThan(0)
    for (const { e } of timed) {
      expect(e.sec).toBeGreaterThan(0)
      expect(e.sec).toBeLessThanOrEqual(3600)
      expect(e.prog).toBe('time')
    }
  })

  it('gives cardio slots minutes, speed and incline', () => {
    const cardio = allSlots().filter(({ e }) => e.mode === 'cardio')
    expect(cardio).toHaveLength(6)
    for (const { e } of cardio) {
      expect(e.min).toBeGreaterThan(0)
      expect(e.speed).toBeGreaterThan(0)
      expect(e.incline).toBeGreaterThanOrEqual(0)
    }
  })

  it('has exactly one own warm-up block per routine, at most five valid rows', () => {
    for (const r of SIX_DAY_PPL.routines) {
      const withRows = slotsOf(r).filter(e => e.warmupRows)
      expect(withRows, `${r.id} warm-up slots`).toHaveLength(1)
      const [slot] = withRows
      expect(slot.warmup).toBe('own')
      expect(slot.warmupRows.length).toBeGreaterThan(0)
      expect(slot.warmupRows.length).toBeLessThanOrEqual(5)
      for (const row of slot.warmupRows) {
        expect(row.r).toBeGreaterThanOrEqual(1)
        expect(row.r).toBeLessThanOrEqual(30)
        expect(row.wb === true || typeof row.wp === 'number').toBe(true)
      }
    }
  })
})
