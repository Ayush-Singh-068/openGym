import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { LOCAL_BUILD } from '../lib/demo.js'
import { useStore, hasData } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { exportDue, markExported, snoozeReminder, markFirstData, reminderState } from '../lib/backup-reminder.js'

const todayISO = () => new Date().toISOString().slice(0, 10)

/* Local build only: "Save a backup file" after a week without one. One tap downloads the JSON (or
   opens the phone's share sheet, so it can go to Files or a drive); "Later" asks again tomorrow. */
export default function BackupReminder() {
  const has = useStore(s => hasData(s.S))
  const toast = useUI(s => s.toast)
  const [tick, setTick] = useState(0)
  useEffect(() => { if (has) markFirstData() }, [has])
  if (!LOCAL_BUILD || !has) return null
  void tick
  if (!exportDue({ ...reminderState(), has })) return null
  const save = async () => {
    const json = JSON.stringify(useStore.getState().S, null, 2)
    const name = 'opengym-backup-' + todayISO() + '.json'
    try {
      const file = new File([json], name, { type: 'application/json' })
      if (navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], title: name })
      else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; a.click(); URL.revokeObjectURL(a.href)
      }
      markExported(); toast(t('Backup exported')); setTick(x => x + 1)
    } catch { /* share sheet dismissed: it asks again tomorrow */ }
  }
  return (
    <div className="card small" role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '8px 12px' }}>
      <span style={{ flex: 1 }}>{t('It has been a while since you saved a backup file.')}</span>
      <button className="btn" onClick={save}>{t('Save now')}</button>
      <button className="btn" onClick={() => { snoozeReminder(); setTick(x => x + 1) }}>{t('Later')}</button>
    </div>
  )
}
