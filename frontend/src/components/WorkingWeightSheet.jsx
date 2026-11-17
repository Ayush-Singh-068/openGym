// "Working weight": the small sheet "Complete as planned" opens for a weighted lift that is still at
// 0, so no set is ever logged at 0 kg. One number, in the exercise's unit; Save and complete hands
// it back and the caller fills the sets and ticks them.
import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { Button, Stepper } from './ui.jsx'

export default function WorkingWeightSheet({ name, unit, step, onSave }) {
  const [weight, setWeight] = useState(0)
  return <>
    <h3>{t('Working weight')}</h3>
    <div className="muted small" style={{ marginBottom: 14, lineHeight: 1.4 }}>{name}</div>
    <Stepper value={weight} step={step} unit={unit} ariaLabel={t('Working weight')} onChange={setWeight} />
    <div style={{ height: 16 }} />
    <Button variant="primary" disabled={!(weight > 0)} onClick={() => onSave(weight)}>{t('Save and complete')}</Button>
  </>
}
