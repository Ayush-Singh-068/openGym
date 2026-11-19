// "About this weight": the small sheet behind the workout card's one sentence about the weight
// (lib/load-setup.js). It shows the sentence, the plates for each side as a plain list, the reason
// for the suggested weight when the progression engine has one, and a row to change how this
// exercise is counted. A sled whose own weight is not known yet opens on the one-number question
// instead; the answer is kept for that exercise and never asked again. The sheet reads nothing from
// the store: the caller hands in the numbers and the two actions.
import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { fmtPlate } from '../lib/format.js'
import { LOAD_KINDS } from '../lib/load-setup.js'
import { Button, Row, Stepper } from './ui.jsx'

// How each way of counting is named, and said in one line.
const KIND_TEXT = {
  bar: ['Bar and plates', 'The bar plus plates on each side'],
  sled: ['Sled and plates', 'The sled’s own weight plus plates on each side'],
  stack: ['Machine stack', 'The weight shown on the stack'],
  dumbbell: ['Dumbbells', 'The weight of one dumbbell'],
  bodyweight: ['Bodyweight plus added weight', 'Your body plus the weight you add'],
  total: ['Total load only', 'What you type is the whole load'],
}

// `model` is a snapshot from the moment the sheet opened: what is picked in here is kept in `kind`.
// `sledBase` is the sled weight already known for this exercise (kept when another way of counting
// was picked), 0 when it is not: a known one is not asked for again.
// `aim` is the Aim line (lib/effort-aim.js), '' for none; `back` is { label, onApply } for the row "Back to the
// suggested weight" (lib/suggested-weight.js), null for none: one tap applies it and closes the sheet.
export default function LoadSheet({ model, name, step, why, aim = '', back = null, sledBase = 0, onSaveBase, onPickKind, close }) {
  const [view, setView] = useState(model.needsBase ? 'sled' : 'about')
  const [kind, setKind] = useState(model.kind)
  const known = model.kind === 'sled' && model.base > 0 ? model.base : sledBase > 0 ? sledBase : 0
  const [base, setBase] = useState(known)
  const unit = model.unit
  const changeRow = <div className="list menu-list" style={{ marginTop: 14 }}>
    <Row title={t('Change how this exercise is counted')} subtitle={t(KIND_TEXT[kind][0])} accessory="chevron" onClick={() => setView('kind')} />
  </div>

  if (view === 'kind') return <>
    <h3>{t('How is this exercise counted?')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{name}</div>
    <div className="list menu-list">
      {LOAD_KINDS.map(k => <Row key={k} title={t(KIND_TEXT[k][0])} subtitle={t(KIND_TEXT[k][1])} accessory={k === kind ? 'check' : 'none'}
        onClick={() => {
          if (k !== kind) { onPickKind(k); setKind(k) }
          if (k === 'sled' && !(known > 0)) setView('sled')
          else close()
        }} />)}
    </div>
  </>

  if (view === 'sled') return <>
    <h3>{t('Sled weight')}</h3>
    <div className="muted small" style={{ marginBottom: 14, lineHeight: 1.4 }}>{name}</div>
    <div className="small dim" style={{ marginBottom: 12, lineHeight: 1.4 }}>{t('What does the empty sled weigh? You are only asked once for this exercise.')}</div>
    <Stepper value={base} step={step} unit={unit} ariaLabel={t('Sled weight')} onChange={setBase} />
    <div style={{ height: 16 }} />
    <Button variant="primary" disabled={!(base > 0)} onClick={() => { onSaveBase(base); close() }}>{t('Save')}</Button>
    {changeRow}
  </>

  return <>
    <h3>{t('About this weight')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{name}</div>
    <div style={{ fontSize: 'var(--fs-body)', lineHeight: 1.4, marginBottom: 8 }}>{model.text}</div>
    {model.plates?.length > 0 && <div className="small dim" style={{ marginBottom: 8 }}>{t('Each side: {0}', model.plates.map(fmtPlate).join(' + '))}</div>}
    {aim && <div className="small dim" style={{ marginBottom: 8, lineHeight: 1.4 }}>{aim}</div>}
    {why && <div className="small dim" style={{ marginBottom: 8, lineHeight: 1.4 }}>{t('Why this weight: {0}', why)}</div>}
    {back && <div className="list menu-list" style={{ marginTop: 14 }}>
      <Row title={t('Back to the suggested weight: {0}', back.label)} onClick={() => { back.onApply(); close() }} />
    </div>}
    {model.kind === 'sled' && model.base > 0 && <div className="list menu-list" style={{ marginTop: 14 }}>
      <Row title={t('Sled weight')} value={fmtPlate(model.base) + ' ' + unit} accessory="chevron" onClick={() => setView('sled')} />
    </div>}
    {changeRow}
  </>
}
