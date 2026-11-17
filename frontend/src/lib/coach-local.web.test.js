// The browser local build's Coach calls the provider straight from the page with fetch, and turns
// a failed test into a plain line. Every fake key here is 'sk-test-...'; no network is used.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./coach-web.js', () => ({ WEB_COACH: true, WEB_PROVIDERS: ['openai'], webProviderOk: () => true, WEB_DEFAULT_PROVIDER: 'openai' }))
vi.mock('./mobile.js', () => ({ MOBILE: false, readJsonFile: async () => null, writeJsonFile: async () => {} }))
vi.mock('./coach-secrets.js', () => ({ getApiKey: async () => null, setApiKey: async () => {}, clearApiKey: async () => {} }))

const local = await import('./coach-local.js')
const KEY = 'sk-test-0000000000000000000000'

// A response shaped like the one the adapters read: status, text() and json().
const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => body, json: async () => JSON.parse(body) })

let seen = []
let answer = async () => reply(200, '{"data":[{"id":"m1"}]}')
beforeEach(() => {
  seen = []
  answer = async () => reply(200, '{"data":[{"id":"m1"}]}')
  local._setTransport(async (url, init) => { seen.push({ url, init }); return answer(url, init) })
})

describe('localTest in the browser build', () => {
  it('reports the model count and calls the models list with the key in the header only', async () => {
    const r = await local.localTest({ provider: 'openai', baseUrl: null }, KEY)
    expect(r).toEqual({ ok: true, count: 1 })
    expect(seen[0].url).toBe('https://api.openai.com/v1/models')
    expect(seen[0].init.headers.authorization).toBe(`Bearer ${KEY}`)
    expect(seen[0].url).not.toContain(KEY)
  })

  it('says the key was not accepted on a 401', async () => {
    answer = async () => reply(401, '{"error":{"message":"Incorrect API key"}}')
    const r = await local.localTest({ provider: 'openai', baseUrl: null }, KEY)
    expect(r.ok).toBe(false)
    expect(r.kind).toBe('auth')
    expect(r.message).toContain('did not accept this key')
    expect(r.message).not.toContain(KEY)
  })

  it('says the rate limit or missing credit on a 429', async () => {
    answer = async () => reply(429, '{"error":"quota"}')
    const r = await local.localTest({ provider: 'openai', baseUrl: null }, KEY)
    expect(r.kind).toBe('rate')
    expect(r.message).toContain('rate limit')
  })

  it('says the network is the problem when fetch itself fails', async () => {
    answer = async () => { throw new TypeError('Failed to fetch') }
    const r = await local.localTest({ provider: 'openai', baseUrl: null }, KEY)
    expect(r.ok).toBe(false)
    expect(r.kind).toBe('network')
    expect(r.message).toContain('Could not reach the provider')
    expect(r.message).not.toContain(KEY)
  })
})

describe('guardedFetch in the browser build', () => {
  it('refuses plain http to the internet without calling the transport', async () => {
    const before = seen.length
    await expect(local.guardedFetch('http://example.com/x', {})).rejects.toThrow(/Plain http/)
    expect(seen.length).toBe(before)
  })

  it('sends an https provider call through the transport', async () => {
    await local.guardedFetch('https://api.openai.com/v1/models', { method: 'GET' })
    expect(seen[seen.length - 1].url).toBe('https://api.openai.com/v1/models')
  })
})
