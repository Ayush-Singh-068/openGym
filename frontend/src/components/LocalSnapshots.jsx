import { useEffect, useState } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { listSnapshots, readSnapshot, onMirrorSaved, latestSavedAt, agoOf } from '../lib/local-mirror.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { Row } from './ui.jsx'

const kb = n => (n < 1024 * 100 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`)

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/
// The row's title: the day and the time of day the copy was last refreshed, in the device's own
// language and clock. Safety copies keep their own id and just gain the time.
const whenOf = s => {
  if (!(s.ts > 0)) return s.id
  const d = new Date(s.ts)
  const stamp = d.toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })
  return DAY_ID.test(s.id) ? stamp : `${s.id} · ${d.toLocaleTimeString(dateLocale(), { timeStyle: 'short' })}`
}

/* "Auto-saved 14:05 (12 seconds ago)": the latest automatic copy's real write time, ticking every
   few seconds so a person can see the app is saving. */
export function AutoSavedLine() {
  const [at, setAt] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    let live = true
    latestSavedAt().then(v => { if (live && v) setAt(v) })
    // A new save also refreshes "now", so the label reads "just now" straight away.
    const off = onMirrorSaved(v => { if (live) { setAt(v); setNow(Date.now()) } })
    const tick = setInterval(() => setNow(Date.now()), 5000)
    return () => { live = false; off(); clearInterval(tick) }
  }, [])
  if (!at) return <Row icon="info" iconTint="var(--acc)" title={t('Not auto-saved yet')} subtitle={t('The first copy is written a moment after your next change.')} />
  const a = agoOf(at, now)
  const ago = a.unit === 'now' ? t('just now') : a.text
  const time = new Date(at).toLocaleTimeString(dateLocale(), { timeStyle: 'short' })
  return <Row icon="checkCircle" iconTint="var(--green)" title={t('Auto-saved {0} ({1})', time, ago)} />
}

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
    message: t('Your data goes back to how it was on {0}. What you have now is kept as a copy first.', whenOf(s)),
    confirmText: t('Restore'),
    onConfirm: async () => {
      const json = await readSnapshot(s.id)
      if (!json) { toast(t('That copy could not be read')); return }
      try { importBackup(JSON.parse(json)); toast(t('Copy restored')); listSnapshots().then(setSnaps) } catch { toast(t('That copy could not be read')) }
    },
  })
  return <>
    {snaps.map(s => <Row key={s.id} icon="reset" iconTint="var(--blue)" title={whenOf(s)} subtitle={kb(s.size)} accessory="chevron" onClick={() => restore(s)} />)}
  </>
}
