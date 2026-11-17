import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  LATEST_NAME, FOLDER_WAIT, DAILY_EVERY_MS, staleDated, datedName, folderBackupSupported,
  writeBackupFiles, initFolderBackup, chooseFolder, reconnectFolder, forgetFolder,
  scheduleFolderBackup, flushFolderBackup, folderStatus, __resetFolderBackupForTests,
} from './backup-folder.js'

// A directory handle with the parts of the File System Access API the module uses.
function fakeDir(initial = {}) {
  const files = new Map(Object.entries(initial))
  return {
    name: 'Backups', files, perm: 'granted',
    async getFileHandle(name) { return { async createWritable() { let buf = ''; return { async write(t) { buf += t }, async close() { files.set(name, buf) } } } } },
    async removeEntry(name) { files.delete(name) },
    async *entries() { for (const k of files.keys()) yield [k, {}] },
    async queryPermission() { return this.perm },
    async requestPermission() { this.perm = 'granted'; return 'granted' },
  }
}
const fakeStore = () => ({ h: null, async get() { return this.h }, async set(h) { this.h = h }, async clear() { this.h = null } })
const pickerWin = dir => ({ showDirectoryPicker: async () => dir })
const cancelWin = () => ({ showDirectoryPicker: async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }) } })

beforeEach(() => { __resetFolderBackupForTests() })
afterEach(() => { vi.useRealTimers(); delete globalThis.showDirectoryPicker; __resetFolderBackupForTests() })

describe('staleDated', () => {
  it('keeps the newest 14 of 16 dated names and ignores the other files', () => {
    const dated = Array.from({ length: 16 }, (_, i) => `opengym-backup-2026-09-${String(i + 1).padStart(2, '0')}.json`)
    const names = [...dated, LATEST_NAME, 'opengym-backup-2026-09-16-1405.json', 'notes.txt']
    expect(staleDated(names)).toEqual(['opengym-backup-2026-09-01.json', 'opengym-backup-2026-09-02.json'])
  })
})

describe('writeBackupFiles', () => {
  it('writes the latest and today\'s dated copy first, then only the latest within the day', async () => {
    const dir = fakeDir()
    const now = new Date(2026, 8, 16, 14, 5)
    const r = await writeBackupFiles(dir, '{"a":1}', { now, lastDatedAt: 0 })
    expect(dir.files.get(LATEST_NAME)).toBe('{"a":1}')
    expect(dir.files.get(datedName(now))).toBe('{"a":1}')
    expect(r.datedAt).toBe(now.getTime())

    const later = new Date(now.getTime() + 60_000)
    await writeBackupFiles(dir, '{"a":2}', { now: later, lastDatedAt: r.datedAt })
    expect(dir.files.get(LATEST_NAME)).toBe('{"a":2}')
    expect(dir.files.get(datedName(now))).toBe('{"a":1}')
    expect(later.getTime() - r.datedAt).toBeLessThan(DAILY_EVERY_MS)
  })
  it('prunes only the oldest dated files beyond 14 and leaves the timed export alone', async () => {
    const initial = {}
    for (let i = 1; i <= 15; i++) initial[`opengym-backup-2026-09-${String(i).padStart(2, '0')}.json`] = 'old'
    initial['opengym-backup-2026-09-10-1405.json'] = 'manual'
    initial['notes.txt'] = 'x'
    const dir = fakeDir(initial)
    await writeBackupFiles(dir, '{}', { now: new Date(2026, 8, 16), lastDatedAt: 0 })
    expect(dir.files.has('opengym-backup-2026-09-01.json')).toBe(false)
    expect(dir.files.has('opengym-backup-2026-09-02.json')).toBe(false)
    expect(dir.files.has('opengym-backup-2026-09-03.json')).toBe(true)
    expect(dir.files.get('opengym-backup-2026-09-10-1405.json')).toBe('manual')
    expect(dir.files.has('notes.txt')).toBe(true)
  })
})

describe('folderBackupSupported', () => {
  it('needs the folder picker', () => {
    expect(folderBackupSupported({})).toBe(false)
    expect(folderBackupSupported({ showDirectoryPicker() {} })).toBe(true)
  })
})

describe('initFolderBackup', () => {
  it('is off when no folder was remembered', async () => {
    await initFolderBackup({ win: { showDirectoryPicker() {} }, store: fakeStore() })
    expect(folderStatus().state).toBe('off')
  })
  it('asks for permission again when it is only a prompt, and is ok when granted', async () => {
    const dir = fakeDir(); dir.perm = 'prompt'
    const store = fakeStore(); store.h = dir
    await initFolderBackup({ win: { showDirectoryPicker() {} }, store })
    expect(folderStatus()).toMatchObject({ state: 'needs-permission', name: 'Backups' })

    __resetFolderBackupForTests()
    dir.perm = 'granted'
    await initFolderBackup({ win: { showDirectoryPicker() {} }, store })
    expect(folderStatus().state).toBe('ok')
  })
})

describe('chooseFolder', () => {
  it('stores the picked folder and sets the status ok', async () => {
    const dir = fakeDir(); const store = fakeStore()
    const r = await chooseFolder({ win: pickerWin(dir), store })
    expect(r).toEqual({ name: 'Backups' })
    expect(store.h).toBe(dir)
    expect(folderStatus()).toMatchObject({ state: 'ok', name: 'Backups' })
  })
  it('a cancelled picker returns null and changes nothing', async () => {
    const store = fakeStore()
    expect(await chooseFolder({ win: cancelWin(), store })).toBeNull()
    expect(store.h).toBeNull()
    expect(folderStatus().state).toBe('off')
  })
})

describe('scheduleFolderBackup', () => {
  it('debounces three quick changes into one write of the last copy', async () => {
    vi.useFakeTimers()
    globalThis.showDirectoryPicker = () => {}
    const dir = fakeDir()
    await chooseFolder({ win: pickerWin(dir), store: fakeStore() })
    const spy = vi.spyOn(dir, 'getFileHandle')
    scheduleFolderBackup('{"v":1}')
    scheduleFolderBackup('{"v":2}')
    scheduleFolderBackup('{"v":3}')
    await vi.advanceTimersByTimeAsync(FOLDER_WAIT)
    expect(dir.files.get(LATEST_NAME)).toBe('{"v":3}')
    expect(spy.mock.calls.filter(c => c[0] === LATEST_NAME)).toHaveLength(1)
  })
  it('with no folder there is no timer and no write', async () => {
    vi.useFakeTimers()
    globalThis.showDirectoryPicker = () => {}
    scheduleFolderBackup('{"v":1}')
    expect(vi.getTimerCount()).toBe(0)
  })
  it('a lapsed permission sets needs-permission and writes nothing; reconnect writes and sets ok', async () => {
    vi.useFakeTimers()
    globalThis.showDirectoryPicker = () => {}
    const dir = fakeDir()
    await chooseFolder({ win: pickerWin(dir), store: fakeStore() })
    dir.perm = 'prompt'
    scheduleFolderBackup('{"v":1}')
    await vi.advanceTimersByTimeAsync(FOLDER_WAIT)
    expect(folderStatus().state).toBe('needs-permission')
    expect(dir.files.has(LATEST_NAME)).toBe(false)

    expect(await reconnectFolder()).toBe('granted')
    expect(dir.files.get(LATEST_NAME)).toBe('{"v":1}')
    expect(folderStatus().state).toBe('ok')
  })
})

describe('write failures', () => {
  it('a folder that was removed sets error and does not throw', async () => {
    globalThis.showDirectoryPicker = () => {}
    const dir = fakeDir()
    await chooseFolder({ win: pickerWin(dir), store: fakeStore() })
    scheduleFolderBackup('{"v":1}')
    dir.getFileHandle = async () => { throw Object.assign(new Error('gone'), { name: 'NotFoundError' }) }
    await expect(flushFolderBackup()).resolves.toBeUndefined()
    expect(folderStatus().state).toBe('error')
  })
})

describe('forgetFolder', () => {
  it('clears the stored folder and returns to off', async () => {
    const store = fakeStore()
    await chooseFolder({ win: pickerWin(fakeDir()), store })
    await forgetFolder({ store })
    expect(store.h).toBeNull()
    expect(folderStatus()).toMatchObject({ state: 'off', name: '' })
  })
})
