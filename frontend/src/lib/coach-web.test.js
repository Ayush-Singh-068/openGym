// @vitest-environment happy-dom
// The browser local build's Coach switch: which provider list it shows, and whether the Coach
// counts as on for each combination of build flags.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const flags = vi.hoisted(() => ({ web: false, mobile: false }))
vi.mock('./coach-web.js', async () => {
  const real = await vi.importActual('./coach-web.js')
  // A getter, so each test's flag is read live rather than frozen at import.
  return { ...real, get WEB_COACH() { return flags.web } }
})
vi.mock('./demo.js', () => ({ DEMO: false, LOCAL_BUILD: false, DEMO_SEEDED: 'gym_demo_seeded_v1', REPO: '' }))
vi.mock('./mobile.js', async importOriginal => ({ ...(await importOriginal()), get MOBILE() { return flags.mobile } }))
vi.mock('./coach-local.js', () => ({ setNotifier: vi.fn() }))

const { WEB_PROVIDERS, webProviderOk } = await vi.importActual('./coach-web.js')
const { setOfflineBuild } = await import('./build-caps.js')
const { coachAvailable } = await import('./coach.js')
const { useStore } = await import('../store/useStore.js')
const { coachVia } = await import('./coach-api.js')

beforeEach(() => { useStore.setState({ coachLocal: null }) })
afterEach(() => { setOfflineBuild(false); flags.web = false; flags.mobile = false })

describe('coachVia', () => {
  it('is the server when nothing is configured in the browser build', () => {
    flags.web = true
    expect(coachVia()).toBe('server')
  })

  it('is the device once a key was configured through setup', () => {
    flags.web = true
    useStore.setState({ coachLocal: { mode: 'byok', provider: 'openai' } })
    expect(coachVia()).toBe('device')
  })

  it('stays the server on a plain server build, even with byok saved', () => {
    flags.web = false; flags.mobile = false
    useStore.setState({ coachLocal: { mode: 'byok', provider: 'openai' } })
    expect(coachVia()).toBe('server')
  })

  it('keeps the phone rule: device for byok on a phone', () => {
    flags.mobile = true
    useStore.setState({ coachLocal: { mode: 'byok', provider: 'openai' } })
    expect(coachVia()).toBe('device')
  })
})

describe('web provider list', () => {
  it('starts with OpenAI and leaves out the providers a browser cannot call', () => {
    expect(WEB_PROVIDERS[0]).toBe('openai')
    expect(WEB_PROVIDERS).not.toContain('minimax')
    expect(WEB_PROVIDERS).not.toContain('compatible')
    expect(webProviderOk('minimax')).toBe(false)
    expect(webProviderOk('openai')).toBe(true)
  })
})

describe('coachAvailable in the browser build', () => {
  it('is on only with the byok mode, with the web coach kept on', () => {
    flags.web = true
    setOfflineBuild(true, { coach: true })
    expect(coachAvailable(null, null, { coachMode: 'byok' })).toBe(true)
    expect(coachAvailable(null, null, {})).toBe(false)
    expect(coachAvailable(null, null, { coachMode: 'server' })).toBe(false)
  })
})
