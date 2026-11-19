import { useEffect, useState } from 'react'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { listSnapshots, readSnapshot, onMirrorSaved, latestSavedAt, latestCopy, writeSafety, agoOf, LATEST_ID } from '../lib/local-mirror.js'
import { summarize, isEmptyCopy, holdsLess } from '../lib/backup-summary.js'
import { stateJson } from '../lib/state-json.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { confirmSheet } from '../sheets.jsx'
import { Row } from './ui.jsx'

const kb = n => (n < 1024 * 100 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`)

const DAY_ID = /^\d{4}-\d{2}-\d{2}$/
// A copy kept before a restore or an import is named "<day> before <UTC time of the data it holds>".
const BEFORE_ID = /^\d{4}-\d{2}-\d{2} before (\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})$/
const stampOf = ts => new Date(ts).toLocaleString(dateLocale(), { dateStyle: 'medium', timeStyle: 'short' })
// The row's title: the day and the time of day the copy was written, in the device's own language
// and clock ("17 Nov 2026, 15:56"), and what kind of copy it is. The raw name is never shown.
const whenOf = s => {
  if (s.id === LATEST_ID) return s.ts > 0 ? t('{0} (latest auto-save)', stampOf(s.ts)) : t('Latest auto-save')
  if (DAY_ID.test(s.id)) return s.ts > 0 ? stampOf(s.ts) : s.id
  const m = BEFORE_ID.exec(s.id)
  const at = s.ts > 0 ? s.ts : m ? Date.parse(m[1] + 'Z') : 0
  return at > 0 ? t('{0} (before a restore)', stampOf(at)) : s.id
}
const dayText = iso => new Date(iso + 'T12:00:00').toLocaleDateString(dateLocale(), { dateStyle: 'medium' })
// "15 routines, 1 workout, last workout 17 Nov 2026"
const countsText = sum => [
  sum.routines ? tn('{0} routine', '{0} routines', sum.routines) : t('no routines'),
  sum.workouts ? tn('{0} workout', '{0} workouts', sum.workouts) : t('no workouts'),
  sum.last ? t('last workout {0}', dayText(sum.last)) : '',
].filter(Boolean).join(', ')

// What the restore question shows: the copy and what you have now, side by side in words, a strong
// warning when the copy holds less, and the promise that what you have now is kept first.
function RestoreMessage({ s, copy, now, warning }) {
  return <div style={{ textAlign: 'start' }}>
    <div className="small" style={{ marginBottom: 8 }}><b>{t('This copy')}</b><br />{whenOf(s)}<br />{countsText(copy)} · {kb(s.size)}</div>
    <div className="small" style={{ marginBottom: 10 }}><b>{t('Right now')}</b><br />{countsText(now)}</div>
    {warning && <div role="alert" className="small" style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 10 }}>{warning}</div>}
    <div className="small">{t('Whatever you have now is saved first as a copy marked “before a restore”, so you can undo this from this list.')}</div>
  </div>
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

// The latest automatic copy first, then one copy per day and the copies kept before a restore.
const loadCopies = async () => {
  const [latest, snaps] = await Promise.all([latestCopy(), listSnapshots()])
  return latest ? [latest, ...snaps] : snaps
}

/* Local build only: the copies kept in this browser (lib/local-mirror.js): the latest automatic
   copy on top, then one per day, and a "before a restore" copy for every restore. Each row says
   what the copy holds (an empty one is labelled), and tapping one shows that against what you have
   now before it asks. The copy being replaced is saved first, and waited for, so it is in the list
   when the restore is done and a wrong tap can be undone from here. */
export default function LocalSnapshots() {
  const [copies, setCopies] = useState(null)
  const [sums, setSums] = useState({})   // copy id -> what it holds, filled in one by one
  const importBackup = useStore(s => s.importBackup)
  const toast = useUI(s => s.toast)
  useEffect(() => { let live = true; loadCopies().then(l => { if (live) setCopies(l) }); return () => { live = false } }, [])
  // What each copy holds is read from the copy itself, a row at a time, so the list shows at once.
  useEffect(() => {
    if (!copies || !copies.length) return undefined
    let live = true
    ;(async () => {
      for (const c of copies) {
        const json = await readSnapshot(c.id)
        if (!live) return
        let sum = null
        try { sum = json ? summarize(JSON.parse(json)) : null } catch { sum = null }
        if (sum) setSums(m => ({ ...m, [c.id]: sum }))
      }
    })()
    return () => { live = false }
  }, [copies])
  if (!copies || !copies.length) return <Row icon="info" iconTint="var(--acc)" title={t('No automatic copies yet')} subtitle={t('A copy of your data is kept in this browser every day you log something.')} />
  const bringBack = async (s, copy) => {
    const cur = useStore.getState().S
    // What is being replaced is saved first, under its own row, and the restore waits for it.
    if (summarize(cur).any && !(await writeSafety(stateJson(cur), cur._ts || 0))) {
      toast(t('Your current data could not be saved as a copy first, so nothing was changed.'))
      return
    }
    try { importBackup(copy); toast(t('Copy restored')) } catch { toast(t('That copy could not be read')); return }
    setSums({})
    setCopies(await loadCopies())
  }
  const restore = async s => {
    const json = await readSnapshot(s.id)
    let copy = null
    try { copy = json ? JSON.parse(json) : null } catch { copy = null }
    if (!copy || typeof copy !== 'object') { toast(t('That copy could not be read')); return }
    const inCopy = summarize(copy)
    const now = summarize(useStore.getState().S)
    const empty = isEmptyCopy(inCopy) && now.any
    const less = !empty && holdsLess(inCopy, now)
    const warning = empty ? t('This copy is empty. Restoring it leaves you with no routines and no workouts.')
      : less ? t('This copy has fewer routines or workouts than you have now. Restoring it replaces what you have with less.') : ''
    confirmSheet({
      title: empty ? t('Restore an empty copy?') : less ? t('Restore a smaller copy?') : t('Restore this copy?'),
      message: <RestoreMessage s={s} copy={inCopy} now={now} warning={warning} />,
      confirmText: warning ? t('Restore anyway') : t('Restore'),
      danger: !!warning,
      onConfirm: () => bringBack(s, copy),
    })
  }
  return <>
    {copies.map(s => {
      const sum = sums[s.id]
      const empty = !!sum && isEmptyCopy(sum)
      return <Row key={s.id} icon="reset" iconTint={empty ? 'var(--red)' : 'var(--blue)'} title={whenOf(s)}
        subtitle={sum ? (empty ? t('Empty copy') : countsText(sum)) + ' · ' + kb(s.size) : kb(s.size)} accessory="chevron" onClick={() => restore(s)} />
    })}
  </>
}
