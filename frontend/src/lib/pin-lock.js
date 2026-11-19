/* The local build's optional PIN lock (VITE_LOCAL=1).
 *
 * What it is: a lock on the screen, for a phone someone else may pick up. What it is not: security
 * against a person with the browser's developer tools. The page, the data and this check all live
 * in the browser, so anyone who can run code on the page can read the data or delete the lock.
 *
 * The PIN is never stored: only a random salt and a PBKDF2-SHA-256 hash of it, in their own
 * localStorage key, never in the profile, so a backup file does not carry the lock to another
 * device and a restore does not remove it. Wrong tries slow down after FREE_TRIES (the delay
 * doubles, up to MAX_DELAY_MS) and the count survives a reload.
 */
export const PIN_KEY = 'gym_pin_v1'
const FAIL_KEY = 'gym_pin_fail'
export const ITERATIONS = 210000
export const FREE_TRIES = 5
export const BASE_DELAY_MS = 5000
export const MAX_DELAY_MS = 15 * 60 * 1000
export const LOCK_AFTER_MS = 2 * 60 * 1000

/** What a field holds, as a PIN: the digits of other scripts (Arabic-Indic, Persian, Devanagari,
 *  Bengali, Thai) become Latin ones, everything else but digits goes, and it stops at 8. Pasting
 *  "1234 5678" therefore gives 12345678, and a keyboard that types native digits can still unlock. */
export function normalizePin(text) {
  const zeros = [0x0660, 0x06f0, 0x0966, 0x09e6, 0x0e50]
  let out = ''
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0)
    const z = zeros.find(z0 => c >= z0 && c <= z0 + 9)
    if (z !== undefined) out += String(c - z)
    else if (c >= 48 && c <= 57) out += ch
  }
  return out.slice(0, 8)
}

export const validPin = pin => typeof pin === 'string' && /^\d{4,8}$/.test(pin)

const toHex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
const fromHex = hex => new Uint8Array((hex.match(/../g) || []).map(h => parseInt(h, 16)))

/** The hash of a PIN under a salt, as hex. */
export async function derive(pin, salt, iterations = ITERATIONS, subtle = globalThis.crypto?.subtle) {
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return toHex(await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256))
}

/** Equal strings, without stopping at the first difference. */
export function sameHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** How long to wait before the next try, given the count of wrong ones so far. */
export function delayFor(fails) {
  if (fails < FREE_TRIES) return 0
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (fails - FREE_TRIES))
}

const read = k => { try { return JSON.parse(localStorage.getItem(k) || 'null') } catch { return null } }
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true } catch { return false } }

export const hasPin = () => {
  const r = read(PIN_KEY)
  return !!(r && typeof r.salt === 'string' && typeof r.hash === 'string')
}

/** Sets or replaces the PIN. False when it is not 4 to 8 digits or could not be saved. */
export async function setPin(pin) {
  if (!validPin(pin)) return false
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const hash = await derive(pin, salt)
  const ok = write(PIN_KEY, { salt: toHex(salt), hash, iter: ITERATIONS })
  if (ok) try { localStorage.removeItem(FAIL_KEY) } catch { /* nothing to clear */ }
  return ok
}

export function clearPin() {
  try { localStorage.removeItem(PIN_KEY); localStorage.removeItem(FAIL_KEY) } catch { /* nothing to clear */ }
}

/** Milliseconds left of a wait after too many wrong tries; 0 when a try is allowed. */
export function waitLeft(now = Date.now()) {
  const f = read(FAIL_KEY)
  // Never longer than the longest wait there is: a clock set back after the wait was recorded
  // (by a stranger, or a phone that corrected itself) must not lock the owner out for months.
  return f && f.until > now ? Math.min(f.until - now, MAX_DELAY_MS) : 0
}

let checking = false
/** Checks a PIN: { ok, wait, busy } — `wait` is ms to the next allowed try after a wrong one.
 *  The try is counted before the hash is computed, and one check runs at a time, so several tries
 *  fired together cannot all be judged inside a single wait. A right PIN wipes the count. */
export async function verifyPin(pin, now = Date.now()) {
  if (checking) return { ok: false, wait: 0, busy: true }
  const left = waitLeft(now)
  if (left) return { ok: false, wait: left }
  const r = read(PIN_KEY)
  if (!r || !validPin(pin)) return { ok: false, wait: 0 }
  checking = true
  try {
    const n = (read(FAIL_KEY)?.n || 0) + 1
    const wait = delayFor(n)
    write(FAIL_KEY, { n, until: wait ? now + wait : 0 })
    const hash = await derive(pin, fromHex(r.salt), Number(r.iter) || ITERATIONS)
    if (sameHash(hash, r.hash)) {
      try { localStorage.removeItem(FAIL_KEY) } catch { /* nothing to clear */ }
      return { ok: true, wait: 0 }
    }
    return { ok: false, wait }
  } finally { checking = false }
}

/** What a PIN field shows: one dot per digit. The field is a plain text field, not a password
 *  field: a password field makes browsers offer to save the PIN in their password manager, which
 *  would then offer it to whoever holds the phone. Showing the dots ourselves works the same in
 *  every browser (the CSS that masks a text field does not). */
export const MASK = '•'
export const maskPin = pin => MASK.repeat(String(pin ?? '').length)

/** The PIN after a change in a field that was showing maskPin(prev). The dots left in the field
 *  are the digits kept, what is not a dot is what was typed or pasted: so typing adds digits at
 *  the end, deleting takes digits off the end, and a pasted "1234 5678" is 12345678. */
export function pinFromField(prev, shown) {
  const text = String(shown ?? '')
  const kept = text.split(MASK).length - 1
  return normalizePin(String(prev ?? '').slice(0, kept) + normalizePin(text.split(MASK).join('')))
}

export const LOCK_CHANNEL = 'opengym-lock'
export const DEVICE_DBS = ['opengym-local', 'opengym-media']

function deleteDb(idb, name, waitMs) {
  return new Promise(resolve => {
    let timer = null
    const end = ok => { clearTimeout(timer); resolve(ok) }
    try {
      const request = idb.deleteDatabase(name)
      request.onsuccess = () => end(true)
      request.onerror = () => end(false)
      // A delete that is blocked waits for other tabs to close their connections: not for ever.
      timer = setTimeout(() => end(false), waitMs)
    } catch { end(false) }
  })
}

/** Wipes this device's data and, last of all, the lock: the way out of a forgotten PIN. Other tabs
 *  are told first and reload, so none of them keeps the profile in memory and writes it back. The
 *  IndexedDB copies go before anything else and must really be gone: if one cannot be deleted the
 *  lock stays (false), because a copy that survives would come back at the next start with no
 *  lock on it. Then every other localStorage key, then the PIN key, then the page reloads (true).
 *  The parts are arguments so that a test can stand in for the browser. */
export async function eraseDevice({
  idb = globalThis.indexedDB,
  storage = globalThis.localStorage,
  reload = () => globalThis.location.reload(),
  Channel = globalThis.BroadcastChannel,
  waitMs = 8000,
} = {}) {
  try { const bc = new Channel(LOCK_CHANNEL); bc.postMessage('erase'); bc.close() } catch { /* no other tabs to tell */ }
  const gone = await Promise.all(DEVICE_DBS.map(name => deleteDb(idb, name, waitMs)))
  if (!gone.every(Boolean)) return false
  try {
    const keys = []
    for (let i = 0; i < storage.length; i++) keys.push(storage.key(i))
    for (const key of keys) if (key !== PIN_KEY) storage.removeItem(key)
    storage.removeItem(PIN_KEY)
  } catch { return false }
  reload()
  return true
}
