// @vitest-environment happy-dom
// The browser local build keeps the Coach key in this browser's localStorage, and nowhere a
// backup or the sync would ever read from. The key here is a fake.
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./coach-web.js', () => ({ WEB_COACH: true, WEB_PROVIDERS: ['openai'], webProviderOk: () => true }))

const K = 'sk-test-0000000000000000000000'
const secrets = await import('./coach-secrets.js')
const { useStore } = await import('../store/useStore.js')

beforeEach(() => { localStorage.clear() })

describe('coach key in the browser build', () => {
  it('stores, reads back, replaces and removes the key under its own localStorage key', async () => {
    await secrets.setApiKey(K)
    expect(localStorage.getItem(secrets.WEB_KEY)).toBe(K)
    expect(await secrets.getApiKey()).toBe(K)
    expect(await secrets.hasApiKey()).toBe(true)

    await secrets.setApiKey('sk-test-replaced-000000000000')
    expect(await secrets.getApiKey()).toBe('sk-test-replaced-000000000000')

    await secrets.clearApiKey()
    expect(await secrets.getApiKey()).toBe(null)
    expect(localStorage.getItem(secrets.WEB_KEY)).toBe(null)
  })

  it('treats an empty or whitespace value as a removal', async () => {
    await secrets.setApiKey(K)
    await secrets.setApiKey('   ')
    expect(await secrets.getApiKey()).toBe(null)
    await secrets.setApiKey(K)
    await secrets.setApiKey('')
    expect(await secrets.getApiKey()).toBe(null)
  })

  it('masks the middle of a key for the screen', () => {
    expect(secrets.maskKey(K)).toBe('sk-...0000')
    expect(secrets.maskKey('short')).toBe('...')
    expect(secrets.maskKey('')).toBe('')
  })

  it('is wiped by the same loop PinLock "Forgot PIN" runs', async () => {
    await secrets.setApiKey(K)
    for (const k of Object.keys(localStorage)) localStorage.removeItem(k)
    expect(await secrets.getApiKey()).toBe(null)
  })

  it('never puts the key into the store state, the device file or the export JSON', async () => {
    await secrets.setApiKey(K)
    expect(JSON.stringify(useStore.getState().S)).not.toContain(K)
    // The same serialization the backup file uses (lib/backup-media.js exportBackupZip).
    expect(JSON.stringify(useStore.getState().S, null, 2)).not.toContain(K)

    const device = await import('./coach-device.js')
    await device.saveCoachDevice({ mode: 'byok', provider: 'openai' })
    expect(localStorage.getItem('gym_coach_device_v1')).not.toContain(K)

    // The only place the key may live is its own entry.
    const everywhere = Object.keys(localStorage).map(k => localStorage.getItem(k)).join('\n')
    expect(everywhere.split(K).length - 1).toBe(1)
  })
})
