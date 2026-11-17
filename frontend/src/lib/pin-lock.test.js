import { describe, it, expect, beforeEach } from 'vitest'
import { webcrypto } from 'node:crypto'
import { normalizePin, validPin, sameHash, delayFor, derive, setPin, verifyPin, hasPin, clearPin, waitLeft, PIN_KEY, FREE_TRIES, BASE_DELAY_MS, MAX_DELAY_MS } from './pin-lock.js'

// Few iterations keep the suite quick; the app's own number is ITERATIONS.
const mem = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) } }

beforeEach(() => {
  globalThis.localStorage = mem()
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto
})

describe('validPin', () => {
  it('takes 4 to 8 digits and nothing else', () => {
    for (const ok of ['1234', '00000', '12345678']) expect(validPin(ok)).toBe(true)
    for (const bad of ['123', '123456789', '12a4', '', ' 1234', null, 1234]) expect(validPin(bad)).toBe(false)
  })
})

describe('sameHash', () => {
  it('compares whole strings', () => {
    expect(sameHash('abcd', 'abcd')).toBe(true)
    expect(sameHash('abcd', 'abce')).toBe(false)
    expect(sameHash('abcd', 'abc')).toBe(false)
    expect(sameHash(null, 'abc')).toBe(false)
  })
})

describe('delayFor', () => {
  it('is free for the first tries, then doubles up to a ceiling', () => {
    expect(delayFor(FREE_TRIES - 1)).toBe(0)
    expect(delayFor(FREE_TRIES)).toBe(BASE_DELAY_MS)
    expect(delayFor(FREE_TRIES + 1)).toBe(BASE_DELAY_MS * 2)
    expect(delayFor(FREE_TRIES + 40)).toBe(MAX_DELAY_MS)
  })
})

describe('derive', () => {
  it('is stable for a PIN and salt, and differs for another PIN or salt', async () => {
    const s = new Uint8Array(16).fill(7)
    const a = await derive('1234', s, 1000)
    expect(await derive('1234', s, 1000)).toBe(a)
    expect(await derive('1235', s, 1000)).not.toBe(a)
    expect(await derive('1234', new Uint8Array(16).fill(8), 1000)).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('setPin and verifyPin', () => {
  it('refuses a malformed PIN and stores nothing', async () => {
    expect(await setPin('12')).toBe(false)
    expect(hasPin()).toBe(false)
  })
  it('accepts the right PIN and rejects a wrong one', async () => {
    expect(await setPin('4821')).toBe(true)
    expect(hasPin()).toBe(true)
    expect((await verifyPin('4821')).ok).toBe(true)
    expect((await verifyPin('4822')).ok).toBe(false)
  })
  it('never stores the PIN itself', async () => {
    await setPin('4821')
    expect(localStorage.getItem(PIN_KEY)).not.toContain('4821')
  })
  it('uses a fresh salt each time', async () => {
    await setPin('4821'); const a = localStorage.getItem(PIN_KEY)
    await setPin('4821'); expect(localStorage.getItem(PIN_KEY)).not.toBe(a)
  })
  it('slows down after too many wrong tries, and the right PIN waits too', async () => {
    await setPin('4821')
    const t0 = 1_000_000
    for (let i = 0; i < FREE_TRIES - 1; i++) expect((await verifyPin('0000', t0)).wait).toBe(0)
    const r = await verifyPin('0000', t0)
    expect(r.wait).toBe(BASE_DELAY_MS)
    expect(waitLeft(t0 + 1000)).toBe(BASE_DELAY_MS - 1000)
    expect((await verifyPin('4821', t0 + 1000)).ok).toBe(false)
    expect((await verifyPin('4821', t0 + BASE_DELAY_MS + 1)).ok).toBe(true)
    expect(waitLeft(t0 + BASE_DELAY_MS + 2)).toBe(0)
  })
  it('clearPin removes the lock', async () => {
    await setPin('4821'); clearPin()
    expect(hasPin()).toBe(false)
  })
})

describe('normalizePin', () => {
  it('turns native digits into Latin ones and drops everything else', () => {
    expect(normalizePin('١٢٣٤')).toBe('1234')
    expect(normalizePin('۱۲۳۴')).toBe('1234')
    expect(normalizePin('१२३४')).toBe('1234')
    expect(normalizePin('১২৩৪')).toBe('1234')
    expect(normalizePin('๑๒๓๔')).toBe('1234')
    expect(normalizePin('12 34-a')).toBe('1234')
  })
  it('cuts to 8 digits after cleaning, not before', () => {
    expect(normalizePin('1234 5678 9')).toBe('12345678')
  })
})

describe('a clock set back', () => {
  it('never leaves a wait longer than the longest one', async () => {
    await setPin('4821')
    const later = 1_800_000_000_000
    for (let i = 0; i < FREE_TRIES + 3; i++) await verifyPin('0000', later + i * 1000)
    // the clock now reads a year earlier than when the wait was recorded
    expect(waitLeft(later - 365 * 86400000)).toBeLessThanOrEqual(MAX_DELAY_MS)
  })
})

describe('tries at the same time', () => {
  it('judges one and refuses the rest while it runs', async () => {
    await setPin('4821')
    const rs = await Promise.all(Array.from({ length: 6 }, () => verifyPin('0000', 5_000_000)))
    expect(rs.filter(r => r.busy).length).toBe(5)
    expect(JSON.parse(localStorage.getItem('gym_pin_fail')).n).toBe(1)
  })
  it('counts a wrong try before the hash finishes', async () => {
    await setPin('4821')
    const p = verifyPin('0000', 6_000_000)
    expect(JSON.parse(localStorage.getItem('gym_pin_fail')).n).toBe(1)
    await p
  })
})
