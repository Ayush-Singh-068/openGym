// @vitest-environment happy-dom
// S.loadSetup is a stamped map on both sides of the sync, kept per exercise: the choice made last
// survives and the other exercises' choices are kept.
import { describe, expect, it } from 'vitest'
import { mergeStates, STAMPED_MAPS } from './sync-merge.js'
import { STAMPED_MAPS as API_STAMPED_MAPS } from '../../../api/sync-stamps.js'
import { DEF } from '../store/useStore.js'
import { withLoadSetup } from './load-setup.js'

const BENCH = '0025'
const LEG_PRESS = '2267'
const state = (over = {}) => ({ ...JSON.parse(JSON.stringify(DEF)), unit: 'kg', workouts: [], routines: [], ...over })

describe('loadSetup in the state and the sync', () => {
  it('starts as an empty map on a new profile', () => {
    expect(DEF.loadSetup).toEqual({})
  })

  it('is a stamped map on both sides of the sync', () => {
    expect(STAMPED_MAPS).toContain('loadSetup')
    expect(API_STAMPED_MAPS).toContain('loadSetup')
  })

  it('keeps the entry set last for an exercise, and the entries of the others', () => {
    const phone = state({ _ts: 100, loadSetup: withLoadSetup({}, LEG_PRESS, 'sled', { base: 30, unit: 'kg', now: 90 }) })
    const desk = state({ _ts: 200, loadSetup: { ...withLoadSetup({}, LEG_PRESS, 'stack', { unit: 'kg', now: 20 }), ...withLoadSetup({}, BENCH, 'total', { unit: 'kg', now: 30 }) } })
    for (const m of [mergeStates(phone, desk), mergeStates(desk, phone)]) {
      expect(m.loadSetup[LEG_PRESS]).toMatchObject({ kind: 'sled', base: 30, _ts: 90 })
      expect(m.loadSetup[BENCH]).toMatchObject({ kind: 'total', _ts: 30 })
    }
  })
})
