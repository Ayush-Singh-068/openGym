// Desktop only: keep a backup file in a folder the person picked (File System Access API).
// Where the API is missing (phones, Firefox, Safari) none of this is shown or run.
import { dayKey } from './local-mirror.js'

export const LATEST_NAME = 'opengym-backup-latest.json'
export const KEEP_DAYS = 14
export const FOLDER_WAIT = 5000                // quiet time after the last change before a write
export const DAILY_EVERY_MS = 10 * 60 * 1000   // the day's dated file is refreshed at most this often
// Strict, so a manual export with a time in its name is never touched.
const DATED = /^opengym-backup-(\d{4}-\d{2}-\d{2})\.json$/

/** Whether this browser can pick a folder and write into it. */
export function folderBackupSupported(win = globalThis) {
  return typeof win.showDirectoryPicker === 'function' && win.isSecureContext !== false
}

/** 'opengym-backup-YYYY-MM-DD.json' for the day of `d`. */
export const datedName = (d = new Date()) => `opengym-backup-${dayKey(d)}.json`

/** The dated names to delete: all but the newest `keep`. Latest and timed exports never match. */
export function staleDated(names, keep = KEEP_DAYS) {
  const dated = names.filter(n => DATED.test(n)).sort()
  return dated.slice(0, Math.max(0, dated.length - keep))
}

// The directory handle is kept in IndexedDB: a handle can be stored there as it is.
const HANDLE_DB = 'opengym-folder'
const HANDLE_STORE = 'handles'
const HANDLE_KEY = 'dir'
const req = r => new Promise((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve()
  tx.onerror = () => reject(tx.error)
  tx.onabort = () => reject(tx.error || new Error('aborted'))
})

/** Stores the chosen folder. Every call answers quietly when IndexedDB is missing or refuses. */
export function createHandleStore(idb = globalThis.indexedDB) {
  const open = () => new Promise((resolve, reject) => {
    if (!idb) return reject(new Error('no indexedDB'))
    const r = idb.open(HANDLE_DB, 1)
    r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains(HANDLE_STORE)) r.result.createObjectStore(HANDLE_STORE) }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
  return {
    async get() {
      try {
        const db = await open()
        return (await req(db.transaction(HANDLE_STORE).objectStore(HANDLE_STORE).get(HANDLE_KEY))) || null
      } catch { return null }
    },
    async set(handle) {
      try {
        const db = await open()
        const tx = db.transaction(HANDLE_STORE, 'readwrite')
        tx.objectStore(HANDLE_STORE).put(handle, HANDLE_KEY)
        await done(tx)
        return true
      } catch { return false }
    },
    async clear() {
      try {
        const db = await open()
        const tx = db.transaction(HANDLE_STORE, 'readwrite')
        tx.objectStore(HANDLE_STORE).delete(HANDLE_KEY)
        await done(tx)
        return true
      } catch { return false }
    },
  }
}

/** 'granted', 'prompt' or 'denied'. Asking (`request`) only works inside a click, so only the
 *  Reconnect and Choose buttons pass it. */
export async function permissionOf(handle, { request = false } = {}) {
  try {
    const opts = { mode: 'readwrite' }
    let p = await handle.queryPermission?.(opts)
    if (p !== 'granted' && request) p = await handle.requestPermission?.(opts)
    return p || 'prompt'
  } catch { return 'denied' }
}

/** Writes one file in the folder, replacing it. */
export async function writeFileIn(dir, name, text) {
  const fh = await dir.getFileHandle(name, { create: true })
  const w = await fh.createWritable()
  await w.write(text)
  await w.close()
}

/** Writes the latest copy, and the day's dated copy when it is due, then prunes old dated files.
 *  Returns { datedAt }: the new lastDatedAt for the caller to keep. */
export async function writeBackupFiles(dir, json, { now = new Date(), lastDatedAt = 0, listNames } = {}) {
  await writeFileIn(dir, LATEST_NAME, json)
  let datedAt = lastDatedAt
  if (now.getTime() - lastDatedAt >= DAILY_EVERY_MS) {
    await writeFileIn(dir, datedName(now), json)
    datedAt = now.getTime()
  }
  const names = listNames ? await listNames() : await collectNames(dir)
  for (const n of staleDated(names)) {
    try { await dir.removeEntry(n) } catch { /* a file that will not go stays for now */ }
  }
  return { datedAt }
}

async function collectNames(dir) {
  const names = []
  for await (const [name] of dir.entries()) names.push(name)
  return names
}

// Module state: one folder per browser.
let handle = null, ready = null, lastJson = null, timer = null, datedAt = 0, watching = false
let status = { state: 'off', name: '', at: 0 }      // 'off' | 'ok' | 'needs-permission' | 'error'
const subs = new Set()
export const folderStatus = () => status
export function onFolderStatus(fn) { subs.add(fn); return () => subs.delete(fn) }
const setStatus = next => { status = { ...status, ...next }; for (const f of [...subs]) { try { f(status) } catch { /* a bad listener must not stop the rest */ } } }

// When the page is hidden, write what is waiting now: a change made seconds before closing the tab
// is kept. The browser may cut the write short, so the quiet-time timer stays the main path.
function watchVisibility() {
  if (watching || typeof document === 'undefined') return
  watching = true
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushFolderBackup() })
}

/** Looks for a remembered folder once per page load. Its status says whether it can be written. */
export function initFolderBackup(deps = {}) {
  if (!ready) {
    ready = (async () => {
      const win = deps.win ?? globalThis
      if (!folderBackupSupported(win)) return
      const store = deps.store ?? createHandleStore()
      handle = await store.get()
      if (!handle) return
      const perm = await permissionOf(handle)
      setStatus({ state: perm === 'granted' ? 'ok' : 'needs-permission', name: handle.name })
      watchVisibility()
    })()
  }
  return ready
}

/** Called on every save of the profile. Remembers the latest copy and writes it after a quiet time. */
export function scheduleFolderBackup(json) {
  if (!folderBackupSupported()) return
  // The latest copy is kept even before a folder is chosen, so choosing one can write at once.
  lastJson = json
  if (!handle) return
  clearTimeout(timer)
  timer = setTimeout(flushFolderBackup, FOLDER_WAIT)
}

/** Writes the remembered copy now. Never throws: a failure becomes the status. */
export async function flushFolderBackup() {
  clearTimeout(timer)
  timer = null
  if (!handle || lastJson == null) return
  const json = lastJson
  const perm = await permissionOf(handle)
  if (perm !== 'granted') { setStatus({ state: 'needs-permission' }); return }
  try {
    const r = await writeBackupFiles(handle, json, { lastDatedAt: datedAt })
    datedAt = r.datedAt ?? datedAt
    setStatus({ state: 'ok', at: Date.now() })
  } catch (e) {
    // A folder that was moved or deleted (NotFoundError) needs choosing again; a lost permission
    // (NotAllowedError) needs Reconnect.
    setStatus({ state: e?.name === 'NotAllowedError' ? 'needs-permission' : 'error' })
  }
}

/** Asks for a folder. Must run inside a click. Cancelling changes nothing. */
export async function chooseFolder(deps = {}) {
  const win = deps.win ?? globalThis
  const store = deps.store ?? createHandleStore()
  let h
  try {
    h = await win.showDirectoryPicker({ id: 'opengym-backup', mode: 'readwrite' })
  } catch (e) {
    if (e?.name !== 'AbortError') setStatus({ state: 'error' })
    return null
  }
  await store.set(h)
  handle = h
  datedAt = 0
  setStatus({ state: 'ok', name: h.name, at: 0 })
  watchVisibility()
  if (lastJson != null) await flushFolderBackup()
  return { name: h.name }
}

/** Asks again for permission to the remembered folder. Must run inside a click. */
export async function reconnectFolder() {
  if (!handle) return 'denied'
  const perm = await permissionOf(handle, { request: true })
  if (perm === 'granted') {
    setStatus({ state: 'ok' })
    await flushFolderBackup()
  }
  return perm
}

/** Stops using the folder: forgets it and returns to off. The files already there stay. */
export async function forgetFolder(deps = {}) {
  const store = deps.store ?? createHandleStore()
  await store.clear()
  handle = null
  lastJson = null
  datedAt = 0
  clearTimeout(timer)
  timer = null
  setStatus({ state: 'off', name: '', at: 0 })
}

/** Resets all module state. Tests only. */
export function __resetFolderBackupForTests() {
  handle = null; ready = null; lastJson = null; datedAt = 0; watching = false
  clearTimeout(timer); timer = null
  status = { state: 'off', name: '', at: 0 }
  subs.clear()
}
