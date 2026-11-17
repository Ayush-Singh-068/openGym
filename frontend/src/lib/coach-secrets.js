// Where the phone keeps the user's own API key: the platform's secure storage — the Keychain on
// iOS, the Keystore-backed EncryptedSharedPreferences on Android — and nowhere else. Never in
// S (which syncs and exports), never in the coach device file next to it.
//
// The browser local build (VITE_LOCAL=1) has no secure storage. There the key is plain text in
// this browser's localStorage under its own key (WEB_KEY), on this device only. It is not in S,
// not in the device file, and not in any export; clearing site data or erasing the device removes it.
//
// The plugin is imported lazily and every call is wrapped: on a plain web dev run it stores
// to localStorage by its own admission, and in a test there is no platform at all. In both
// cases the fallback is a process-local map that forgets on reload, which is the honest
// behaviour for a place that cannot keep a secret.
import { WEB_COACH } from './coach-web.js'

const KEY = 'coach.apiKey'
export const WEB_KEY = 'gym_coach_key_v1'
const webStore = () => { try { return WEB_COACH ? globalThis.localStorage : null } catch { return null } }
const memory = new Map()

// The loaded plugin travels inside a plain object, never as a promise's own value (no `await`
// or `.then` may ever hand the proxy back bare — the wrapper below is the whole point). Capacitor's
// registerPlugin() hands out a Proxy that answers EVERY property name with a native-method
// wrapper — `then` included — so a promise that resolves to the proxy itself takes it for a
// thenable, calls SecureStorage.then() on the native side ("not implemented on android"), and
// never settles. That one await hung the whole feature on the phone: "Save and use the Coach"
// greyed out forever, the key "not saved", the Coach "thinking" without end (issues #42, #58).
let pluginPromise = null
function plugin() {
  if (!pluginPromise) {
    pluginPromise = import('@aparajita/capacitor-secure-storage')
      .then(m => ({ store: m && m.SecureStorage && typeof m.SecureStorage.get === 'function' ? m.SecureStorage : null }))
      .catch(() => ({ store: null }))
  }
  return pluginPromise
}

// A native call that never answers must not hang the setup screen behind a greyed-out button
// (issue #42: "Save and use the Coach" stayed disabled forever on one Android 16 phone). After
// this long the platform store is treated as unavailable and the process-local map takes over.
const NATIVE_TIMEOUT_MS = 4000
export const withTimeout = (promise, ms = NATIVE_TIMEOUT_MS) => new Promise((resolve, reject) => {
  const tm = setTimeout(() => reject(new Error('secure storage timed out')), ms)
  promise.then(v => { clearTimeout(tm); resolve(v) }, e => { clearTimeout(tm); reject(e) })
})

// Any small secret under a key of its own, with the same fallbacks: lib/cf-access.js keeps the
// Cloudflare Access service token here, beside the Coach's API key.
export async function secureGet(key) {
  const { store: p } = await plugin()
  if (p) {
    try { const v = await withTimeout(p.get(key)); return typeof v === 'string' && v ? v : null } catch { /* fall through */ }
  }
  return memory.get(key) || null
}
export async function secureSet(key, value) {
  const v = String(value || '').trim()
  if (!v) return secureRemove(key)
  const { store: p } = await plugin()
  if (p) {
    try { await withTimeout(p.set(key, v)); memory.delete(key); return } catch { /* fall through */ }
  }
  memory.set(key, v)
}
export async function secureRemove(key) {
  const { store: p } = await plugin()
  if (p) { try { await withTimeout(p.remove(key)) } catch { /* nothing to clear */ } }
  memory.delete(key)
}

export async function getApiKey() {
  const ls = webStore()
  if (ls) { try { return ls.getItem(WEB_KEY) || null } catch { return null } }
  return secureGet(KEY)
}
export async function setApiKey(value) {
  const v = String(value || '').trim()
  if (!v) return clearApiKey()
  const ls = webStore()
  // A full or blocked storage throws here; the screen says "Could not save the key" then.
  if (ls) { ls.setItem(WEB_KEY, v); return }
  return secureSet(KEY, v)
}
export async function clearApiKey() {
  const ls = webStore()
  if (ls) { try { ls.removeItem(WEB_KEY) } catch { /* nothing to clear */ } }
  return secureRemove(KEY)
}
/** Whether a key is saved, without handing it out. */
export const hasApiKey = async () => !!(await getApiKey())
/** A key shown as sk-...abcd, for the screen. Never log or persist this either. */
export const maskKey = k => (k && k.length > 8 ? k.slice(0, 3) + '...' + k.slice(-4) : k ? '...' : '')
