// Skip reasons from the trainer's Skip sheet, as the streak sees them. Travel and sick excuse a
// missed week like the older notes do; busy and other do not, so they follow the normal rules.
import { describe, expect, it } from 'vitest'
import { streakInfo } from './streak.js'

const mondays = list => list.map(d => ({ d }))
// Trained on the Mondays of three weeks, a week with nothing logged (its Wednesday carries the
// skip), then trained again. The streak rule is 'off', so a missed week with no excuse breaks it.
const withSkip = tag => ({
  weekStart: 1,
  streakRule: { rule: 'off', since: null, history: [] },
  workouts: mondays(['2026-09-07', '2026-09-14', '2026-09-21', '2026-10-05']),
  dayNotes: tag ? { '2026-09-30': { tag, text: '', _ts: 1 } } : {},
})

describe('skip reasons and the streak', () => {
  it('a travel skip excuses the missed week and the streak carries on', () => {
    const info = streakInfo(withSkip('travel'), '2026-10-12')
    expect(info.excused).toEqual(['2026-09-28'])
    expect(info.current).toBe(4)
  })

  it('a busy skip does not excuse the week, so the streak breaks there', () => {
    const info = streakInfo(withSkip('busy'), '2026-10-12')
    expect(info.excused).toEqual([])
    expect(info.current).toBe(1)
  })

  it('an other skip does not excuse the week either', () => {
    const info = streakInfo(withSkip('other'), '2026-10-12')
    expect(info.excused).toEqual([])
    expect(info.current).toBe(1)
  })
})
