import { describe, expect, it } from 'vitest'
import { SIX_DAY_PPL, PPL_SHOWN_NAMES, PPL_DELOAD } from './six-day-ppl.js'
import { applySixDayPpl } from './load-six-day-ppl.js'
import { parsePlan } from '../plan-share.js'
import { EXIDX } from '../exercises.js'
import { shownNameOf } from '../exercise-aliases.js'
import { weekKey, weekStartOf, todayISO } from '../format.js'

const MAIN = ['pull1', 'push1', 'legs1', 'pull2', 'push2', 'legs2']
const BAR = [{ wb: true, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }]
const PULLUP = [{ wp: 0, r: 10 }, { wp: 40, r: 8 }, { wp: 60, r: 5 }, { wp: 80, r: 3 }]
const routineById = (plan, id) => plan.routines.find(r => r.id === id)
const customIds = new Set(SIX_DAY_PPL.customEx.map(c => c.id))
const customIdOf = n => SIX_DAY_PPL.customEx.find(c => c.n === n).id
const draft = () => ({ unit: 'kg', routines: [], week: {}, customEx: [], exAliases: {}, exShownName: {} })

describe('six-day PPL built-in plan', () => {
  it('imports through parsePlan with 12 routines and no slot dropped', () => {
    const bundle = parsePlan(SIX_DAY_PPL, 'kg')
    expect(bundle.routines).toHaveLength(12)
    expect(bundle.dropped).toBe(0)
    bundle.routines.forEach((r, i) => expect(r.ex).toHaveLength(SIX_DAY_PPL.routines[i].ex.length))
  })

  it('keeps each routine folder through parsePlan', () => {
    const bundle = parsePlan(SIX_DAY_PPL, 'kg')
    bundle.routines.forEach((r, i) => expect(r.folder).toBe(SIX_DAY_PPL.routines[i].folder))
  })

  it('maps Monday to Saturday onto the six main routines, Sunday is rest', () => {
    expect(Object.keys(SIX_DAY_PPL.week).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(SIX_DAY_PPL.week).not.toHaveProperty('0')
    expect(['1', '2', '3', '4', '5', '6'].map(d => SIX_DAY_PPL.week[d][0])).toEqual(MAIN)
    expect(SIX_DAY_PPL.routines.map(r => r.id)).toEqual([...MAIN, ...MAIN.map(id => id + 'rv')])
  })

  it('uses only catalogue ids or listed custom ids, with valid, unique subs', () => {
    for (const r of SIX_DAY_PPL.routines) {
      for (const s of r.ex) {
        expect(EXIDX[s.id] || customIds.has(s.id), `slot ${s.id}`).toBeTruthy()
        for (const x of s.subs || []) {
          expect(EXIDX[x] || customIds.has(x), `sub ${x}`).toBeTruthy()
          expect(x).not.toBe(s.id)
        }
        if (s.subs) expect(new Set(s.subs).size).toBe(s.subs.length)
      }
    }
  })

  it('lists each catalogue exercise shown name once, with the catalogue id', () => {
    const ids = PPL_SHOWN_NAMES.map(x => x.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(EXIDX[id], id).toBeTruthy()
  })

  it('references every custom exercise from a slot or a sub', () => {
    const used = new Set(SIX_DAY_PPL.routines.flatMap(r => r.ex.flatMap(s => [s.id, ...(s.subs || [])])))
    for (const c of SIX_DAY_PPL.customEx) expect(used.has(c.id), c.id).toBe(true)
  })

  it('reduces every 3-set slot to 2 in the reduced routines, except core, warm-ups, treadmill and the listed ones', () => {
    const secondDose = customIdOf('Side Plank (second weekly dose for obliques)')
    const core = new Set(['0276', '0715', '0463', '9819', '0175', secondDose])
    const keep3 = new Set(['pull1|0313', 'pull2|0594', 'push2|2137'])
    const warm = new Set(['5055', '1503', '4580', '3905', customIdOf('Scapular Push-Up')])
    for (const id of MAIN) {
      const main = routineById(SIX_DAY_PPL, id)
      const rv = routineById(SIX_DAY_PPL, id + 'rv')
      expect(rv.folder).toBe('6-Day Push Pull Legs (Reduced Volume)')
      expect(rv.ex).toHaveLength(main.ex.length)
      main.ex.forEach((s, i) => {
        const exempt = core.has(s.id) || warm.has(s.id) || keep3.has(id + '|' + s.id) || s.mode === 'cardio'
        const expected = s.sets === 3 && !exempt ? 2 : s.sets
        expect(rv.ex[i].sets, id + 'rv ' + s.id).toBe(expected)
      })
    }
  })

  it('gives each day\'s first weighted lift the four ramp-up rows, Weighted Pull-Up with its bodyweight row', () => {
    const first = { pull1: '0841', push1: '0047', legs1: '0043', pull2: '1194', push2: '0025', legs2: '0032' }
    for (const id of MAIN) {
      for (const rid of [id, id + 'rv']) {
        const s = routineById(SIX_DAY_PPL, rid).ex.find(e => e.id === first[id])
        expect(s.warmup, rid).toBe('own')
        expect(s.warmupRows, rid).toEqual(id === 'pull1' ? PULLUP : BAR)
        expect(s.warmupRestSec, rid).toBe(60)
      }
    }
  })

  it('puts the RAMP-UP SETS section text verbatim on the ramp slots', () => {
    const pullUp = routineById(SIX_DAY_PPL, 'pull1').ex.find(s => s.id === '0841')
    expect(pullUp.note.startsWith('Ramp-Up Set 1: Use an empty bar or the lightest available weight. Perform 10 repetitions')).toBe(true)
    expect(pullUp.note).toContain('Ramp-Up Set 4: Use about 80 percent of your working weight. Perform 2 to 3 repetitions.')
    expect(pullUp.note).toContain('Rest 60 to 90 seconds between each of these four sets.')
    expect(pullUp.note).toContain('you may skip Ramp-Up Set 4, since these carry lower joint stress.')
    const tbar = routineById(SIX_DAY_PPL, 'pull2').ex.find(s => s.id === '1194')
    expect(tbar.note).toContain('you may skip Ramp-Up Set 4')
  })

  it('keeps the owner text verbatim in notes', () => {
    const pull1 = routineById(SIX_DAY_PPL, 'pull1')
    expect(pull1.ex.find(s => s.id === '0841').note).toContain('Pull your shoulder blades down and back first, then pull your elbows toward your hips')
    expect(pull1.ex.find(s => s.id === '0315').note).toContain('Note: This day runs slightly longer')
    const pull2 = routineById(SIX_DAY_PPL, 'pull2')
    expect(pull2.ex.find(s => s.id === '5656').note).toContain('— this is a shoulder health priority movement')
    expect(pull2.ex.find(s => s.id === '0594').note).toContain('Combined with Wednesday and Saturday')
    expect(routineById(SIX_DAY_PPL, 'legs2').ex.find(s => s.id === '0032').note).toContain('Note: The order here matters.')
    expect(routineById(SIX_DAY_PPL, 'legs1').ex.find(s => s.id === '1206').note).toContain('Note: Cable Pull-Through replaces')
  })

  it('gives the timed plank its Repetitions part, like Side Plank', () => {
    const plank = routineById(SIX_DAY_PPL, 'pull1').ex.find(s => s.id === '0463')
    expect(plank.note.startsWith('Repetitions: 30 to 45 seconds. ')).toBe(true)
    const side = routineById(SIX_DAY_PPL, 'pull1').ex.find(s => s.id === '0715')
    expect(side.note).toContain('Repetitions: 20 to 30 seconds per side.')
  })

  it('gives the push-day Band Pull-Apart the push-day text, after the Muscles line', () => {
    const band = routineById(SIX_DAY_PPL, 'push1').ex[0]
    expect(band.id).toBe('1503')
    expect(band.note.startsWith('Muscles targeted today: Upper chest, middle chest')).toBe(true)
    expect(band.note).toContain('Complete 2 rounds of 15 repetitions, performed the same way as described above.')
  })

  it('keeps every note within NOTE_MAX (2000 characters)', () => {
    for (const r of SIX_DAY_PPL.routines) for (const s of r.ex) expect((s.note || '').length, s.id).toBeLessThanOrEqual(2000)
  })

  it('applies to an empty store draft: 12 routines, shown names, deload cycle, restored custom subs', () => {
    const s = draft()
    const bundle = parsePlan(SIX_DAY_PPL, 'kg')
    const result = applySixDayPpl(s, bundle, { schedule: true })
    expect(result.ids).toHaveLength(12)
    expect(s.routines).toHaveLength(12)
    expect(s.customEx).toHaveLength(SIX_DAY_PPL.customEx.length)
    expect(Object.keys(s.week).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(shownNameOf({ id: '0841' }, s.exShownName, s.exAliases)).toBe('Weighted Pull-Up')
    expect(shownNameOf({ id: '5656' }, s.exShownName, s.exAliases)).toBe('Face Pull (cable rope, set at eye level)')
    expect(shownNameOf({ id: '3666' }, s.exShownName, s.exAliases)).toBe('Treadmill session')
    const wide = s.customEx.find(c => c.n === 'Wide-Grip Cable Lat Pulldown')
    const pullUp = s.routines.find(r => r.name === 'Pull Day 1').ex.find(e => e.id === '0841')
    expect(pullUp.subs).toContain(wide.id)
    expect(pullUp.subs).toContain('0017')
    expect(s.deloadCycle).toMatchObject({ every: PPL_DELOAD.every, sets: 2, drop: 50, cardio: 'skip' })
    expect(s.deloadCycle.from).toBe(weekKey(todayISO(), weekStartOf(s)))
  })

  it('applying twice adds no second copy: 12 plan routines, week still 1 to 6 on the same routines', () => {
    const s = draft()
    const bundle = parsePlan(SIX_DAY_PPL, 'kg')
    applySixDayPpl(s, bundle, { schedule: true })
    const weekOnce = JSON.stringify(s.week)
    const second = applySixDayPpl(s, parsePlan(SIX_DAY_PPL, 'kg'), { schedule: true })
    expect(s.routines).toHaveLength(12)
    expect(second.added).toBe(0)
    expect(Object.keys(s.week).sort()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(JSON.stringify(s.week)).toBe(weekOnce)
    expect(s.customEx).toHaveLength(SIX_DAY_PPL.customEx.length)
  })

  it('leaves a routine the user already has (same name and folder) untouched, and adds only the missing ones', () => {
    const s = draft()
    s.routines = [{ id: 'mine-pull', name: 'Pull Day 1', folder: '6-Day Push Pull Legs', emoji: 'pullup', ex: [] }]
    const result = applySixDayPpl(s, parsePlan(SIX_DAY_PPL, 'kg'), { schedule: true })
    expect(s.routines).toHaveLength(12)
    expect(s.routines.find(r => r.name === 'Pull Day 1' && r.folder === '6-Day Push Pull Legs')).toEqual({ id: 'mine-pull', name: 'Pull Day 1', folder: '6-Day Push Pull Legs', emoji: 'pullup', ex: [] })
    expect(result.added).toBe(11)
    expect(s.week['1']).toEqual(['mine-pull'])
  })
})
