// The browser local build is Offline's web twin, except the Coach stays on for the person's own key.
import { afterEach, describe, expect, it } from 'vitest'
import { setOfflineBuild, offCards, OFFLINE_OFF_CARDS, OFFLINE_OFF_MODULES, LOCAL_OFF_MODULES, LOCAL_OFF_CARDS } from './build-caps.js'
import { moduleBuilt } from './modules.js'

afterEach(() => setOfflineBuild(false))

describe('browser local build caps', () => {
  it('hides the Coach as Offline does when the web coach is not allowed', () => {
    setOfflineBuild(true)
    expect(offCards()).toEqual(OFFLINE_OFF_CARDS)
    expect(offCards()).toContain('coach')
    expect(moduleBuilt('coach')).toBe(false)
  })

  it('keeps the Coach on with the web coach, and the other network things off', () => {
    setOfflineBuild(true, { coach: true })
    expect(offCards()).not.toContain('coach')
    expect(offCards()).toEqual(LOCAL_OFF_CARDS)
    for (const c of ['hevy', 'webdav', 'mcp']) expect(offCards()).toContain(c)
    expect(moduleBuilt('coach')).toBe(true)
    expect(moduleBuilt('integrations')).toBe(false)
    expect(moduleBuilt('community')).toBe(false)
    expect(LOCAL_OFF_MODULES).toEqual(['integrations', 'community'])
  })

  it('goes back to the normal build on setOfflineBuild(false)', () => {
    setOfflineBuild(true, { coach: true })
    setOfflineBuild(false)
    expect(offCards()).toEqual(OFFLINE_OFF_CARDS)
    expect(moduleBuilt('coach')).toBe(true)
    expect(moduleBuilt('integrations')).toBe(true)
  })

  it('keeps the Android Offline lists exactly as they were', () => {
    expect(OFFLINE_OFF_MODULES).toEqual(['coach', 'integrations', 'community'])
    expect(OFFLINE_OFF_CARDS).toContain('coach')
  })
})
