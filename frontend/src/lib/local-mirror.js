import { dateLocale } from './i18n-core.js'
/* The local build's second copy of the profile (VITE_LOCAL=1, lib/demo.js LOCAL_BUILD).
 *
 * localStorage is the main store (store/useStore.js KEY). This is IndexedDB database
 * 'opengym-local' beside it, for two things:
 *   - 'state': the latest copy, written a moment after every change. A browser that emptied
 *     localStorage (storage pressure, a cleared cache) but kept IndexedDB hands the profile back
 *     at the next start (see boot in the store).
 *   - 'snaps': one snapshot per calendar day, the last SNAP_KEEP kept, so a bad edit or a bad
 *     import can be rolled back from Settings → Data & backup.
 * Neither survives "clear site data" or removing the installed app; an exported file does.
 * Every call answers quietly when IndexedDB is missing or refuses (some private windows).
 */

const DB = 'opengym-local'
const STATE = 'state'
const SNAPS = 'snaps'
export const SNAP_KEEP = 14
// Past this many characters the profile no longer goes into localStorage (browsers allow about 5
// million for the whole site): IndexedDB holds it alone. Years of daily training pass it one day.
export const LS_MAX = 2_000_000
/** Whether a profile of `len` characters still belongs in localStorage. */
export const fitsLocalStorage = len => len <= LS_MAX
export const MIRROR_WAIT = 300
// A day's snapshot is refreshed at most this often: it is compressed, and a change per second
// does not need a new one each time.
export const SNAP_EVERY_MS = 10 * 60 * 1000

/** 'YYYY-MM-DD' of a date, in the device's own calendar. */
export const dayKey = (d = new Date()) => {
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Which snapshot keys to delete so only the newest `keep` remain. Keys sort by date. */
export const pruneKeys = (keys, keep = SNAP_KEEP) => [...keys].sort().slice(0, Math.max(0, keys.length - keep))

/** Whether a copy of `now` characters is a drastic shrink of one of `before`. */
export const shrank = (before, now) => !!before && before > 2000 && now < before / 2

const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(tx.error)
  tx.onabort = () => reject(tx.error || new Error('aborted'))
})

let dbp = null
let usable = false
/** Whether IndexedDB opened: until it has, nothing may rely on it as the only copy. */
export const mirrorUsable = () => usable
function open(idb = globalThis.indexedDB) {
  if (dbp) return dbp
  dbp = (async () => {
    if (!idb) return null
    try {
      const db = await new Promise((resolve, reject) => {
        const r = idb.open(DB, 1)
        r.onupgradeneeded = () => {
          if (!r.result.objectStoreNames.contains(STATE)) r.result.createObjectStore(STATE)
          if (!r.result.objectStoreNames.contains(SNAPS)) r.result.createObjectStore(SNAPS)
        }
        r.onsuccess = () => resolve(r.result)
        r.onerror = () => reject(r.error)
        r.onblocked = () => reject(new Error('blocked'))
      })
      db.onversionchange = () => { try { db.close() } catch { /* already closed */ } dbp = null; usable = false }
      usable = true
      return db
    } catch { return null }
  })()
  return dbp
}

// Snapshots are stored gzipped: a profile is text, and 14 days of copies of a 40-year history would
// otherwise be 14 times its size. Without CompressionStream the text is kept as it is.
async function pack(json) {
  try {
    if (typeof CompressionStream === 'undefined') return null
    const out = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
    return await new Response(out).arrayBuffer()
  } catch { return null }
}
async function unpack(buf) {
  const out = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'))
  return await new Response(out).text()
}
const entry = async (json, ts) => {
  const gz = await pack(json)
  const savedAt = Date.now()
  return gz ? { gz, ts, size: json.length, savedAt } : { json, ts, size: json.length, savedAt }
}

/** The latest copy: { json, ts } or null. */
export async function loadMirror() {
  try {
    const db = await open()
    if (!db) return null
    const v = await req(db.transaction(STATE).objectStore(STATE).get('latest'))
    return v && typeof v.json === 'string' ? v : null
  } catch { return null }
}

/** Writes the copy, and refreshes today's snapshot when it is missing or SNAP_EVERY_MS old. A copy
 *  that shrank by half (a reset, a wipe) never replaces the day's snapshot: that is the one a
 *  person comes back to. */
export async function writeMirror(json, ts) {
  try {
    const db = await open()
    if (!db) return false
    const today = dayKey()
    const prev = await req(db.transaction(SNAPS).objectStore(SNAPS).get(today))
    const refresh = !prev || (ts - (prev.ts || 0) >= SNAP_EVERY_MS && !shrank(prev.size, json.length))
    const snap = refresh ? await entry(json, ts) : null   // compressed before the transaction opens
    const savedAt = Date.now()
    const tx = db.transaction([STATE, SNAPS], 'readwrite')
    tx.objectStore(STATE).put({ json, ts, savedAt }, 'latest')
    // A tiny record beside the big one, so the live "Auto-saved" line never loads the whole profile.
    tx.objectStore(STATE).put({ savedAt, ts, size: json.length }, 'latest-meta')
    const snaps = tx.objectStore(SNAPS)
    if (snap) snaps.put(snap, today)
    const keys = await req(snaps.getAllKeys())
    for (const k of pruneKeys(keys)) snaps.delete(k)
    await done(tx)
    lastSavedAt = savedAt
    for (const f of [...listeners]) { try { f(savedAt) } catch { /* a bad listener must not stop the save */ } }
    return true
  } catch { return false }
}

/** Snapshots, newest first: [{ id, ts, size }] — no bodies. */
export async function listSnapshots() {
  try {
    const db = await open()
    if (!db) return []
    const store = db.transaction(SNAPS).objectStore(SNAPS)
    const keys = await req(store.getAllKeys())
    const vals = await req(store.getAll())
    // The write time when the copy has one; older copies fall back to the profile stamp.
    return keys.map((id, i) => ({ id, ts: vals[i]?.savedAt || vals[i]?.ts || 0, size: vals[i]?.size || 0 })).sort((a, b) => (a.id < b.id ? 1 : -1))
  } catch { return [] }
}

/** One snapshot's state JSON, or null. */
export async function readSnapshot(id) {
  try {
    const db = await open()
    if (!db) return null
    const v = await req(db.transaction(SNAPS).objectStore(SNAPS).get(id))
    if (!v) return null
    if (v.gz) return await unpack(v.gz)
    return typeof v.json === 'string' ? v.json : null
  } catch { return null }
}

/** A snapshot of the copy being replaced, kept under its own key before an import or a restore:
 *  `before-<time>` sorts after the day keys, so it is pruned last-in-first... never first. */
export async function writeSafety(json, ts) {
  try {
    const db = await open()
    if (!db) return false
    const snap = await entry(json, ts)
    const tx = db.transaction(SNAPS, 'readwrite')
    const stamp = new Date(ts || Date.now()).toISOString().slice(0, 19)
    tx.objectStore(SNAPS).put(snap, `${dayKey()} before ${stamp}`)
    await done(tx)
    return true
  } catch { return false }
}

let timer = null
let pending = null
/** Debounced writeMirror, for the store's persist(): the last copy within the wait is written. */
export function scheduleMirror(json, ts) {
  pending = { json, ts }
  clearTimeout(timer)
  timer = setTimeout(() => { timer = null; const p = pending; pending = null; if (p) writeMirror(p.json, p.ts) }, MIRROR_WAIT)
}

/** Writes what is waiting now (the page is being hidden or closed). */
export function flushMirror() {
  if (!pending) return
  clearTimeout(timer)
  timer = null
  const p = pending
  pending = null
  writeMirror(p.json, p.ts)
}

/** Asks the browser to keep this site's storage when space runs short. Quiet when refused. */
export async function keepStorage() {
  try { return (await navigator.storage?.persist?.()) === true } catch { return false }
}

// When the latest automatic copy was written, and who wants to hear about each new one.
let lastSavedAt = null
const listeners = new Set()

/** Calls `fn(savedAt)` after every successful automatic save. Returns the unsubscribe function. */
export function onMirrorSaved(fn) { listeners.add(fn); return () => listeners.delete(fn) }

/** When the latest automatic copy was written (ms since epoch), or null when there is none yet.
 *  Reads the small meta record, falling back to the full record of an older copy. */
export async function latestSavedAt() {
  if (lastSavedAt != null) return lastSavedAt
  try {
    const db = await open()
    if (!db) return null
    const meta = await req(db.transaction(STATE).objectStore(STATE).get('latest-meta'))
    if (meta && Number(meta.savedAt) > 0) return Number(meta.savedAt)
    const full = await req(db.transaction(STATE).objectStore(STATE).get('latest'))
    const at = Number(full?.savedAt)
    return at > 0 ? at : null
  } catch { return null }
}

/** How long ago `ts` was, as a count and a unit, for "(12 seconds ago)". Pure.
 *  { unit: 'now' } under 5 seconds; then seconds (<60), minutes (<60), hours (<48), days. */
// How long ago a copy was, as { unit, n, text }. `text` is the phrase in the UI language, from
// Intl.RelativeTimeFormat ("12 seconds ago", "1 day ago"), so no pack needs a plural key per unit.
// A time in the future reads as now.
export function agoOf(ts, now = Date.now()) {
  const sec = Math.max(0, Math.round((now - ts) / 1000))
  let out
  if (sec < 5) out = { unit: 'now', n: 0 }
  else if (sec < 60) out = { unit: 'seconds', n: sec }
  else {
    const min = Math.floor(sec / 60)
    if (min < 60) out = { unit: 'minutes', n: min }
    else {
      const hr = Math.floor(min / 60)
      out = hr < 48 ? { unit: 'hours', n: hr } : { unit: 'days', n: Math.floor(hr / 24) }
    }
  }
  return { ...out, text: agoText(out) }
}
function agoText({ unit, n }) {
  const value = unit === 'now' ? 0 : n
  const word = unit === 'now' ? 'second' : unit.slice(0, -1)
  try { return new Intl.RelativeTimeFormat(dateLocale(), { numeric: 'auto' }).format(-value, word) }
  catch { return new Date(Date.now() - value * 1000).toLocaleString(dateLocale()) }
}

/** 'YYYY-MM-DD-HHMM' of a date in the device's own clock: the stamp on a backup file's name. */
export function backupStamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0')
  return `${dayKey(d)}-${p(d.getHours())}${p(d.getMinutes())}`
}
/** 'opengym-backup-2026-09-16-1405.json' (ext 'json' or 'zip'). */
export const backupFileName = (ext = 'json', d = new Date()) => `opengym-backup-${backupStamp(d)}.${ext}`
