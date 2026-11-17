// @vitest-environment happy-dom
// Settings → Automatic copies → "Keep a backup file in a folder": hidden where the folder API is
// missing, offers a choice when off, Reconnect when permission lapsed, and the folder's own rows.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const mocks = vi.hoisted(() => ({
  supported: true, status: { state: 'off', name: '', at: 0 }, cb: null,
  chooseFolder: vi.fn(async () => null), reconnectFolder: vi.fn(async () => 'granted'),
  forgetFolder: vi.fn(async () => {}), scheduleFolderBackup: vi.fn(), initFolderBackup: vi.fn(async () => {}),
}))
vi.mock('../lib/backup-folder.js', () => ({
  folderBackupSupported: () => mocks.supported,
  folderStatus: () => mocks.status,
  onFolderStatus: fn => { mocks.cb = fn; return () => { mocks.cb = null } },
  initFolderBackup: mocks.initFolderBackup,
  chooseFolder: mocks.chooseFolder,
  reconnectFolder: mocks.reconnectFolder,
  forgetFolder: mocks.forgetFolder,
  scheduleFolderBackup: mocks.scheduleFolderBackup,
}))
vi.mock('../lib/demo.js', async o => ({ ...(await o()), LOCAL_BUILD: true }))
vi.mock('../lib/mobile.js', () => ({ MOBILE: false }))
vi.mock('../store/useStore.js', () => ({ useStore: { getState: () => ({ S: { workouts: [] } }) } }))

const { default: DesktopFolderBackup } = await import('./DesktopFolderBackup.jsx')
let root, host
const rowByText = text => [...host.querySelectorAll('button')].find(b => b.textContent.includes(text))
const flush = async () => { for (let i = 0; i < 4; i++) await act(async () => { await Promise.resolve() }) }

beforeEach(() => {
  mocks.supported = true; mocks.status = { state: 'off', name: '', at: 0 }; mocks.cb = null
  mocks.chooseFolder.mockClear(); mocks.reconnectFolder.mockClear(); mocks.forgetFolder.mockClear()
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

describe('the desktop folder backup row', () => {
  it('renders nothing where the folder API is missing', () => {
    mocks.supported = false
    act(() => root.render(<DesktopFolderBackup />))
    expect(host.innerHTML).toBe('')
  })
  it('offers to keep a folder when off, and choosing one calls chooseFolder', async () => {
    act(() => root.render(<DesktopFolderBackup />))
    await flush()
    expect(host.textContent).toContain('Keep a backup file in a folder')
    act(() => rowByText('Keep a backup file in a folder').click())
    await flush()
    expect(mocks.scheduleFolderBackup).toHaveBeenCalledTimes(1)
    expect(mocks.chooseFolder).toHaveBeenCalledTimes(1)
  })
  it('asks for permission again with Reconnect folder, which calls reconnectFolder', async () => {
    mocks.status = { state: 'needs-permission', name: 'Backups', at: 0 }
    act(() => root.render(<DesktopFolderBackup />))
    await flush()
    expect(host.textContent).toContain('Reconnect folder')
    act(() => rowByText('Reconnect folder').click())
    await flush()
    expect(mocks.reconnectFolder).toHaveBeenCalledTimes(1)
  })
  it('shows the folder name when ok, and Stop using this folder calls forgetFolder', async () => {
    mocks.status = { state: 'ok', name: 'Backups', at: 0 }
    act(() => root.render(<DesktopFolderBackup />))
    await flush()
    expect(host.textContent).toContain('Backup folder: Backups')
    act(() => rowByText('Stop using this folder').click())
    await flush()
    expect(mocks.forgetFolder).toHaveBeenCalledTimes(1)
  })
  it('re-renders when a status is pushed through onFolderStatus', async () => {
    act(() => root.render(<DesktopFolderBackup />))
    await flush()
    expect(mocks.cb).toBeTypeOf('function')
    act(() => mocks.cb({ state: 'error', name: 'Backups', at: 0 }))
    await flush()
    expect(host.textContent).toContain('Could not write to the backup folder')
  })
})
