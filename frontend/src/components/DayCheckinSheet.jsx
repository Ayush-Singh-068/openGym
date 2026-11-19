// A day's check-in (sleep, energy, soreness, stress; lib/daily-form.js) to change or delete: opened from
// a saved workout's sheet and, for a day with no workout, from its row in History. One check-in per day.
// Save changes it in place; Delete takes it away with an Undo in the toast.
import { useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { fmtDate } from '../lib/format.js'
import { FORM_KEYS, formOf, withForm } from '../lib/daily-form.js'
import { Button } from './ui.jsx'
import { Scale, FORM_ROWS } from './DailyCheckin.jsx'

/** "Sleep 4/5 · Soreness 2/5": the answers given, in the order they are asked. */
export function feltLine(f) {
  return FORM_KEYS.filter(k => f?.[k] != null).map(k => FORM_ROWS[k]().label + ' ' + f[k] + '/5').join(' · ')
}

function DayCheckin({ d, close }) {
  const [f, setF] = useState(() => {
    const cur = formOf(useStore.getState().S, d)
    return Object.fromEntries(FORM_KEYS.map(k => [k, cur?.[k] ?? null]))
  })
  const answered = FORM_KEYS.some(k => f[k] != null)
  const save = () => {
    const lighter = formOf(useStore.getState().S, d)?.lighter || null
    useStore.getState().update(s => { s.dayForm = withForm(s.dayForm, d, { ...f, lighter }) })
    useUI.getState().toast(t('Check-in saved'))
    close()
  }
  const remove = () => {
    const prev = useStore.getState().S.dayForm?.[d]
    useStore.getState().update(s => { s.dayForm = withForm(s.dayForm, d, null) })
    close()
    useUI.getState().toast(t('Check-in deleted'), {
      action: t('Undo'),
      onAction: () => useStore.getState().update(s => { if (!formOf(s, d)) s.dayForm = { ...s.dayForm, [d]: { ...prev, _ts: Date.now() } } }),
    })
  }
  return <div className="dfc">
    <h3>{t('Felt that day')}</h3>
    <div className="muted small dfc-sub">{fmtDate(d, true, true)}</div>
    {FORM_KEYS.map(k => <Scale key={k} k={k} value={f[k]} onChange={v => setF(x => ({ ...x, [k]: v }))} />)}
    <Button variant="primary" onClick={save} disabled={!answered}>{t('Save')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" icon="trash" style={{ color: 'var(--red)' }} onClick={remove}>{t('Delete check-in')}</Button>
  </div>
}

export const dayCheckinSheet = d => useUI.getState().openSheet(close => <DayCheckin d={d} close={close} />)
