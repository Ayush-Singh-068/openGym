// "What do you lift now?": the sheet that follows loading a plan with no weights in it. One
// stepper per main lift, grouped by day; Save writes the weights into the routines, Skip for now
// leaves them at 0. Lifts left at 0 stay at 0 (lib/starting-weights.js).
import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { Button, Stepper } from './ui.jsx'
import { startingWeightRows, applyStartingWeights } from '../lib/starting-weights.js'

export default function StartingWeights({ routineIds, close }) {
  const update = useStore(s => s.update)
  const toast = useUI(s => s.toast)
  // The rows are worked out once, when the sheet opens: typing never reshuffles them.
  const [rows] = useState(() => startingWeightRows(useStore.getState().S, routineIds))
  const [weights, setWeights] = useState(() => Object.fromEntries(rows.map(r => [r.id, r.currentWeight])))

  // The days in plan order, each with the lifts that first appear in it.
  const days = []
  for (const row of rows) {
    let day = days.find(d => d.id === row.routineId)
    if (!day) { day = { id: row.routineId, name: row.routineNames[0], rows: [] }; days.push(day) }
    day.rows.push(row)
  }

  const save = () => {
    const typed = {}
    for (const r of rows) if (weights[r.id] > 0) typed[r.id] = weights[r.id]
    if (Object.keys(typed).length) {
      update(s => { applyStartingWeights(s, routineIds, typed) })
      toast(t('Starting weights saved'))
    }
    close()
  }

  return <>
    <h3>{t('What do you lift now?')}</h3>
    <div className="muted small" style={{ marginBottom: 14, lineHeight: 1.4 }}>
      {t('Enter the weight you use for each main lift so your first workout already shows real numbers. Leave a lift at 0 to set it later.')}
    </div>
    {days.map(day => <div key={day.id}>
      <h4 className="sec">{day.name}</h4>
      <div className="list">
        {day.rows.map(r => <div key={r.id} className="row between" data-ex={r.id} style={{ gap: 12 }}>
          <span className="tt grow" style={{ minWidth: 0, fontSize: 'var(--fs-subhead)' }}>{r.name}</span>
          <Stepper value={weights[r.id] || 0} step={r.step} unit={r.unit} ariaLabel={r.name}
            onChange={v => setWeights(w => ({ ...w, [r.id]: v }))} />
        </div>)}
      </div>
    </div>)}
    <div style={{ height: 16 }} />
    <Button variant="primary" onClick={save}>{t('Save weights')}</Button>
    <div style={{ height: 8 }} />
    <Button variant="ghost" className="dim" onClick={close}>{t('Skip for now')}</Button>
  </>
}
