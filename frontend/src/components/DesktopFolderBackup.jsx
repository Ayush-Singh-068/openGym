import { useEffect, useState } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { LOCAL_BUILD } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { folderBackupSupported, folderStatus, onFolderStatus, initFolderBackup, chooseFolder, reconnectFolder, forgetFolder, scheduleFolderBackup } from '../lib/backup-folder.js'
import { Row } from './ui.jsx'

// Settings → Automatic copies → "Keep a backup file in a folder": desktop browsers with the File System Access API.
// Hidden everywhere else (phones, Firefox, Safari), so nobody sees a switch that cannot work.
export default function DesktopFolderBackup() {
  const [st, setSt] = useState(folderStatus())
  const toast = useUI(s => s.toast)
  const show = LOCAL_BUILD && !MOBILE && folderBackupSupported()
  useEffect(() => {
    if (!show) return undefined
    initFolderBackup()
    return onFolderStatus(setSt)
  }, [show])
  if (!show) return null

  // Taking a snapshot of the profile first gives the folder something to write at once.
  const choose = async () => {
    scheduleFolderBackup(JSON.stringify(useStore.getState().S))
    const r = await chooseFolder()
    if (r) toast(t('Backup folder set'))
  }
  const reconnect = async () => {
    const p = await reconnectFolder()
    toast(p === 'granted' ? t('Backups to the folder resumed') : t('Permission was not granted'))
  }
  const stop = () => { forgetFolder() }

  if (st.state === 'ok') {
    const time = st.at ? new Date(st.at).toLocaleTimeString(dateLocale(), { timeStyle: 'short' }) : null
    return <>
      <Row icon="folder" iconTint="var(--green)" title={t('Backup folder: {0}', st.name)}
        subtitle={time ? t('Last saved {0}', time) : t('Waiting for your next change.')} />
      <Row icon="trash" iconTint="var(--red)" title={t('Stop using this folder')} onClick={stop} />
      <Row icon="folder" iconTint="var(--acc)" title={t('Choose a different folder')} accessory="chevron" onClick={choose} />
    </>
  }
  if (st.state === 'needs-permission') {
    return <Row icon="warning" iconTint="var(--orange)" title={t('Reconnect folder')}
      subtitle={t('Backups to “{0}” are paused until you allow it again.', st.name)} accessory="chevron" onClick={reconnect} />
  }
  if (st.state === 'error') {
    return <Row icon="warning" iconTint="var(--red)" title={t('Could not write to the backup folder')}
      subtitle={t('The folder may have been moved or removed. Choose it again.')} accessory="chevron" onClick={choose} />
  }
  return <Row icon="folder" iconTint="var(--acc)" title={t('Keep a backup file in a folder')}
    subtitle={t('Pick a folder on this computer. A fresh backup file is saved there after every change, plus one per day for 14 days. A folder that a sync app watches makes it an off-site copy.')}
    accessory="chevron" onClick={choose} />
}
