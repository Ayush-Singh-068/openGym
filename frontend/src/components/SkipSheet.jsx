// The Skip sheet: say why a day (or a few days away) will not be trained. A skip is a tagged day
// note, so the calendar, the week strip and the streak all read it the same way (lib/day-status.js).
import { useState, useRef } from 'react'
import { t } from '../lib/i18n.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import DateField from './DateField.jsx'
import { SKIP_TAGS, SKIP_LABEL, DAY_NOTE_ICON, readDayNote } from '../lib/day-notes.js'
import { withSkipDays, withoutSkipDays, daysBetween, addDaysKey, dayStatus } from '../lib/day-status.js'
import { todayISO, fmtDate } from '../lib/format.js'
import { NOTE_MAX } from '../lib/history.js'
import { useSheetKeyboard } from '../lib/use-sheet-keyboard.js'

// A range is capped so one slip cannot write a year of notes. A trip is booked ahead, so the
// far edge is wider than canNoteDay, which forbids future notes.
const MAX_DAYS = 31
const MAX_AHEAD = 60

export default function SkipSheet({ iso, close }) {
  const noteRef = useRef(null)
  const onNoteFocus = useSheetKeyboard(noteRef)
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  const today = todayISO()
  const had = readDayNote(S?.dayNotes?.[iso])
  const skipped = dayStatus(S, iso, today).kind === 'skipped'
  const [reason, setReason] = useState(SKIP_TAGS.includes(had?.tag) ? had.tag : null)
  const [note, setNote] = useState(had?.text || '')
  const [away, setAway] = useState(false)
  const [from, setFrom] = useState(iso)
  const [to, setTo] = useState(addDaysKey(iso, 2))
  const minFrom = addDaysKey(today, -MAX_DAYS)
  const maxDay = addDaysKey(today, MAX_AHEAD)
  const rangeBad = away && from > to

  const save = () => {
    const text = note.trim().slice(0, NOTE_MAX)
    const keys = away ? daysBetween(from, to) : [iso]
    if (!keys.length || keys.length > MAX_DAYS) { toast(t('Pick up to {0} days', MAX_DAYS)); return }
    update(s => { s.dayNotes = withSkipDays(s.dayNotes, keys, reason, text) })
    toast(away ? t('Away days saved') : t('Skipped. See you next session!'))
    close()
  }
  const undo = () => {
    update(s => { s.dayNotes = withoutSkipDays(s.dayNotes, [iso]) })
    toast(t('Skip removed'))
    close()
  }

  return <>
    <h3>{iso === today ? t('Skip today') : fmtDate(iso, true)}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Life happens. Tell the app why and it will not nag you about this day.')}</div>
    <div className="chips" style={{ margin: '0 0 8px' }}>
      {SKIP_TAGS.map(k => <button key={k} className={'chip nocap ichip' + (reason === k ? ' on' : '')} aria-pressed={reason === k}
        onClick={() => setReason(reason === k ? null : k)}><Icon name={DAY_NOTE_ICON[k]} />{t(SKIP_LABEL[k])}</button>)}
    </div>
    <div className="small dim" style={{ marginBottom: 12 }}>{t('Travel and Sick keep your streak going. Busy and Other are shown on your calendar but follow the normal streak rules.')}</div>
    <textarea ref={noteRef} className="input" rows={2} maxLength={NOTE_MAX} value={note}
      placeholder={t('Anything else? (optional)')}
      onFocus={onNoteFocus} onChange={e => setNote(e.target.value)} />
    <div style={{ height: 10 }} />
    <Button variant="ghost" onClick={() => setAway(!away)}>{away ? t('Just this day') : t('Away for several days')}</Button>
    {away && <>
      <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
        <DateField label={t('From')} value={from} min={minFrom} max={maxDay} onChange={setFrom} />
        <DateField label={t('To')} value={to} min={minFrom} max={maxDay} onChange={setTo} />
      </div>
      {rangeBad && <div className="small" style={{ color: 'var(--red)', marginTop: 6 }}>{t('The end date is before the start date.')}</div>}
    </>}
    <div style={{ height: 18 }} />
    <Button variant="primary" disabled={!reason} onClick={save}>
      {away ? t('Save away days') : iso === today ? t('Skip today') : t('Skip this day')}
    </Button>
    {skipped && <><div style={{ height: 10 }} /><Button variant="ghost" icon="undo" onClick={undo}>{t('Undo skip')}</Button></>}
  </>
}

export const skipSheet = (iso = todayISO()) => useUI.getState().openSheet(close => <SkipSheet iso={iso} close={close} />)
