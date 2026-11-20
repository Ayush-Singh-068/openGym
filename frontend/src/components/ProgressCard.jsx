// The Home card for progress, as small tiles: this month against the plan, the lifts that moved over
// four weeks (with a sparkline), and body weight week on week. The numbers come from
// lib/progress-summary.js.
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { exOr } from '../lib/exercises.js'
import { fmtNum, todayISO } from '../lib/format.js'
import { progressSummary } from '../lib/progress-summary.js'
import { isOn } from '../lib/modules.js'
import Icon from './Icon.jsx'
import CardHead from './CardHead.jsx'
import { withoutEmptyWorkouts } from '../lib/workout-count.js'

// A tiny line through the points, scaled to its own range. Decoration: the numbers say it too.
function Spark({ pts }) {
  if (!Array.isArray(pts) || pts.length < 2) return null
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1
  const W = 56, H = 20
  const d = pts.map((y, i) => (i / (pts.length - 1) * W).toFixed(1) + ',' + (H - 2 - (y - lo) / span * (H - 4)).toFixed(1)).join(' ')
  return <svg className="pt-spark" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true"><polyline points={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function Delta({ v, unit }) {
  if (v == null || v === 0) return null
  return <span className={'pt-d ' + (v > 0 ? 'up' : 'down')} title={t('{0} in 4 weeks', (v > 0 ? '+' : '') + fmtNum(v) + ' ' + unit)}><Icon name={v > 0 ? 'arrowUp' : 'arrowDown'} />{(v > 0 ? '+' : '') + fmtNum(v) + ' ' + unit}</span>
}

export default function ProgressCard({ S }) {
  const nav = useNavigate()
  const todayKey = todayISO()
  const p = useMemo(() => progressSummary(withoutEmptyWorkouts(S), new Date()), [S.workouts, S.routines, S.week, S.dayPlan, S.dayNotes, S.bodyweight, S.unit, todayKey]) // eslint-disable-line react-hooks/exhaustive-deps
  if (p.empty) return null

  const unit = S.unit || 'kg'
  const showMonth = p.month.planned > 0 || p.month.skipped > 0
  const bw = isOn(S, 'body') ? p.weight : null
  const pct = p.month.planned > 0 ? Math.min(100, Math.round(p.month.done / p.month.planned * 100)) : 0

  return <div className="card tap-host progress-card">
    <CardHead icon="chartLine" tint="var(--blue)" title={t('Your progress')} open={{ onClick: () => nav('/stats') }}
      action={<Icon name="chevronRight" className="chev" />} />
    <div className="pt-grid">
      {showMonth && <div className="pt pt-month">
        <div className="pt-row"><span>{t('{0} of {1} workouts this month', p.month.done, p.month.planned)}</span>{p.month.skipped > 0 && <span className="dim">{t('{0} skipped', p.month.skipped)}</span>}</div>
        <div className="pt-bar" aria-hidden="true"><i style={{ width: pct + '%' }} /></div>
      </div>}
      {p.lifts.map(l => <div key={l.id} className="pt">
        <div className="pt-n">{exerciseNameFor(exOr(l.id))}</div>
        <div className="pt-v"><strong>{fmtNum(l.est)}</strong><span className="pt-of">{unit}</span><Spark pts={l.spark} /></div>
        <div className="pt-l">{t('est. 1RM')}<Delta v={l.delta} unit={unit} /></div>
      </div>)}
      {bw && <div className="pt">
        <div className="pt-n">{t('Body weight')}</div>
        <div className="pt-v"><strong>{fmtNum(bw.avg)}</strong><span className="pt-of">{unit}</span></div>
        <div className="pt-l">{t('7-day average')}{bw.delta != null && <span className="pt-d dim">{(bw.delta > 0 ? '+' : bw.delta < 0 ? '−' : '') + fmtNum(Math.abs(bw.delta))}</span>}</div>
      </div>}
    </div>
  </div>
}
