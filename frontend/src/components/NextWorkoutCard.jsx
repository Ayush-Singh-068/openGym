// The body of Home's Today card: what the next session holds and what each exercise opens at, then
// Start and Skip. The head (routine, icon, state) is Home's own row above it. The numbers come from
// the same builder Start uses (lib/next-targets.js), so they match the screen the session opens on.
import { useMemo } from 'react'
import { useStore } from '../store/useStore.js'
import { t, exerciseNameFor } from '../lib/i18n.js'
import { exOr } from '../lib/exercises.js'
import { todayISO, DAYN, exCount } from '../lib/format.js'
import { nextTrainingDay } from '../lib/history.js'
import { dayStatus } from '../lib/day-status.js'
import { nextTargetsFor } from '../lib/next-targets.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { startOrPreview } from './StartSheets.jsx'
import { skipSheet } from './SkipSheet.jsx'

// Long plans show the first few lifts; the rest is one dim line.
const MAX_ROWS = 5

// `todayIds`: what Home's row says is still to do today (its own count of done and queued sessions);
// without it the day's status decides.
export default function NextWorkoutCard({ S, hidden, todayIds }) {
  const todayKey = todayISO()
  const running = !!S.active && !S.active.editingWorkoutId
  // An editor open on a saved workout is not a session to start from here.
  const editing = !!S.active?.editingWorkoutId
  const status = dayStatus(S, todayKey, todayKey)
  // Today's plan while it is still to do; otherwise the next day that has one.
  const todo = todayIds !== undefined ? todayIds : status.kind === 'today' ? status.routineIds : []
  const next = todo.length ? null : nextTrainingDay(S, todayKey)
  const upcoming = todo.length
    ? { key: todayKey, ids: todo, isToday: true }
    : next ? { key: next.iso, ids: next.routines.map(r => r.id), isToday: false, weekday: next.weekday, name: next.routines.map(r => r.name).join(' + ') }
      : null
  const upKey = upcoming ? upcoming.key + ':' + upcoming.ids.join('+') : ''
  const targets = useMemo(() => (upcoming ? nextTargetsFor(S, upcoming.ids) : []),
    [S.workouts, S.routines, S.week, S.dayPlan, S.startFrom, S.programme, S.queue, S.unit, todayKey, upKey]) // eslint-disable-line react-hooks/exhaustive-deps

  if (editing || hidden) return null
  // A running session is the head row's own Resume; nothing else to offer here.
  if (running) return null
  const skipped = status.kind === 'skipped'
  if (!upcoming && !skipped) return null

  const rows = (upcoming ? targets : []).flatMap(x => x.rows)
  const shown = rows.slice(0, MAX_ROWS)
  const more = rows.length - shown.length
  const mins = Math.round(rows.reduce((n, r) => n + (r.est || 0), 0) / 300) * 5
  const meta = [rows.length ? exCount(rows.length) : null, mins > 0 ? '~' + t('{0} min', mins) : null].filter(Boolean).join(' · ')

  return <div className="hero-next">
    {skipped && <Button size="sm" variant="ghost" icon="undo" onClick={() => skipSheet(todayKey)}>{t('Undo skip')}</Button>}
    {upcoming && !upcoming.isToday && <div className="hero-next-h">{t('Next: {0}', t(DAYN[upcoming.weekday]))}{upcoming.name ? ' · ' + upcoming.name : ''}</div>}
    {meta && <div className="hero-meta">{meta}</div>}
    {upcoming && shown.length > 0 && <div className="hero-ex">
      {shown.map((row, i) => <div key={row.exId + ':' + i} className="hero-exrow">
        <span className="hero-exn">{exerciseNameFor(exOr(row.exId))}</span>
        <span className="hero-exl">{row.kind === 'up' && <Icon name="arrowUp" className="hero-up" />}{row.line}</span>
      </div>)}
      {more > 0 && <div className="hero-more">{'+ ' + exCount(more)}</div>}
    </div>}
    {upcoming && <div className="hero-acts">
      <Button variant="primary" icon="play" onClick={() => startOrPreview(upcoming.ids)}>{upcoming.isToday ? t('Start') : t('Start now')}</Button>
      {upcoming.isToday && <Button variant="tinted" icon="skipForward" onClick={() => skipSheet(todayKey)}>{t('Skip')}</Button>}
    </div>}
  </div>
}
