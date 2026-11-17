import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { listSnapshots, readSnapshot } from '../lib/local-mirror.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { Row } from './ui.jsx'

const kb = n => (n < 1024 * 100 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`)

/* Local build only: the daily copies kept in this browser (lib/local-mirror.js), newest first.
   Tapping one asks, then replaces the profile with it; the copy being replaced is kept first
   (importBackup writes it as a "before" snapshot), so a wrong tap can be undone from here. */
export default function LocalSnapshots() {
  const [snaps, setSnaps] = useState(null)
  const importBackup = useStore(s => s.importBackup)
  const toast = useUI(s => s.toast)
  useEffect(() => { let live = true; listSnapshots().then(l => { if (live) setSnaps(l) }); return () => { live = false } }, [])
  if (!snaps || !snaps.length) return <Row icon="info" iconTint="var(--acc)" title={t('No automatic copies yet')} subtitle={t('A copy of your data is kept in this browser every day you log something.')} />
  const restore = s => confirmSheet({
    title: t('Restore this copy?'),
    message: t('Your data goes back to how it was on {0}. What you have now is kept as a copy first.', s.id),
    confirmText: t('Restore'),
    onConfirm: async () => {
      const json = await readSnapshot(s.id)
      if (!json) { toast(t('That copy could not be read')); return }
      try { importBackup(JSON.parse(json)); toast(t('Copy restored')); listSnapshots().then(setSnaps) } catch { toast(t('That copy could not be read')) }
    },
  })
  return <>
    {snaps.map(s => <Row key={s.id} icon="reset" iconTint="var(--blue)" title={s.id} subtitle={kb(s.size)} accessory="chevron" onClick={() => restore(s)} />)}
  </>
}
