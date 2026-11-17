// @vitest-environment happy-dom
// Package A: in the local build the workout opens in the List layout. A profile saved before this
// is moved once (lib/next-targets.js); the migration itself is tested in next-targets.test.js.
import { describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ api: vi.fn() }))
vi.mock('../lib/demo.js', async o => ({ ...(await o()), LOCAL_BUILD: true }))

import { DEF } from './useStore.js'

describe('default workout layout in the local build', () => {
  it('is list', () => {
    expect(DEF.workoutView).toBe('list')
  })
})
