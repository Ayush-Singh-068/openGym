// The calendar: one month as a grid of days, each marked trained, skipped, missed, planned or rest,
// and the week under the grid listed day by day. Opened from Home and Stats (route /calendar).
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import '../views/history-views.css'
import { useStore } from '../store/useStore.js'
import Icon from '../components/Icon.jsx'
import { workoutDetailSheet } from '../sheets.jsx'
import { dayStatus, monthStatuses } from '../lib/day-status.js'
import { addDays, clampMonth, monthGrid, shiftMonth, weekDays, weekNumberOf, weekSummary, weekToSelect, yearOptions } from '../lib/calendar-model.js'
import { fmtDate, fmtDateRange, fmtDur, fmtVol, todayISO, weekKey, weekOrder, weekStartOf, DAYS, MONTHS, MONTHS_LONG, durPart } from '../lib/format.js'
import { t, tn } from '../lib/i18n.js'
import { glyphOf } from '../lib/glyphs.js'
import { tappable } from '../lib/use-sheet-keyboard.js'

// The icon that stands for why a day was skipped.
const REASON_ICON = { travel: 'globe', sick: 'cloud', busy: 'clock', other: 'note' }

// The English name of a skip reason, through t() so each one can be translated.
function reasonLabel(reason) {
  if (reason === 'travel') return t('Travelling')
  if (reason === 'sick') return t('Sick')
  if (reason === 'busy') return t('Busy')
  return t('Other')
}

// What a day's status says out loud, for the cell label and the day card.
function statusLabel(s) {
  if (s.kind === 'done') return t('Trained')
  if (s.kind === 'skipped') return t('Skipped') + (s.reason ? ' (' + reasonLabel(s.reason) + ')' : '')
  if (s.kind === 'missed') return t('Missed plan')
  if (s.kind === 'planned') return t('Planned')
  if (s.kind === 'today') return t('Today')
  return t('Rest day')
}

// The small mark drawn in a day cell. Missed, planned, rest and today are drawn by the cell's class.
function statusMark(s) {
  if (s.kind === 'done') return <i className="cv-dot" />
  if (s.kind === 'skipped') return <Icon name={REASON_ICON[s.reason] || 'note'} className="cv-reason" />
  return null
}

const REST = { kind: 'rest', workoutIds: [], routineIds: [] }

export default function CalendarView() {
  const navigate = useNavigate()
  const S = useStore(s => s.S)
  // Computed once per render: the day the calendar is about, as a key and as a Date at noon.
  const today = todayISO()
  const ws = weekStartOf(S)
  const todayYear = Number(today.slice(0, 4))
  const todayMonth = Number(today.slice(5, 7)) - 1
  const [ym, setYm] = useState({ year: todayYear, monthIndex0: todayMonth })
  const { year, monthIndex0 } = ym
  // The week the user picked, or null for the default (see weekToSelect).
  const [selKey, setSelKey] = useState(null)
  const [picker, setPicker] = useState(false)

  // Any month change goes through here: the range is clamped, and the week selection resets.
  const go = (y, m) => {
    setYm(clampMonth(S, today, y, m))
    setSelKey(null)
  }
  const prev = shiftMonth(year, monthIndex0, -1)
  const next = shiftMonth(year, monthIndex0, 1)
  const goToday = () => {
    go(todayYear, todayMonth)
    setSelKey(weekKey(today, ws))
  }
  const isCurrentMonth = year === todayYear && monthIndex0 === todayMonth

  const grid = useMemo(() => monthGrid(year, monthIndex0, ws), [year, monthIndex0, ws])
  // The status of every day in the grid: this month's days from monthStatuses, and the days from the
  // neighbouring months that the grid shows, one by one.
  const statuses = useMemo(() => {
    const at = new Date(today + 'T12:00:00')
    const out = { ...monthStatuses(S, year, monthIndex0, at) }
    grid.weeks.forEach(wk => wk.days.forEach(d => { if (!d.inMonth) out[d.iso] = dayStatus(S, d.iso, at) }))
    return out
  }, [S, year, monthIndex0, today, ws, grid])
  const selectedKey = weekToSelect(grid, selKey, today)
  const lastDayIso = addDays(selectedKey, 6)
  const summary = useMemo(() => weekSummary(S, weekDays(selectedKey)), [S, selectedKey])
  const weekNo = weekNumberOf(selectedKey, ws).week
  // The header line: the totals of the days of this month that the grid shows.
  const monthDays = grid.weeks.flatMap(wk => wk.days).filter(d => d.inMonth).map(d => d.iso)
  const month = weekSummary(S, monthDays)
  const skippedCount = monthDays.filter(iso => statuses[iso]?.kind === 'skipped').length
  const summaryParts = []
  if (month.workouts) summaryParts.push(tn('{0} workout', '{0} workouts', month.workouts))
  if (skippedCount) summaryParts.push(t('{0} skipped', skippedCount))
  const monthSummaryLine = summaryParts.length ? summaryParts.join(' · ') + ' ' + t('this month') : t('No workouts this month')

  return <div className="cv-page">
    <div className="hdr">
      <button className="iconbtn" data-back="/home" onClick={() => navigate(-1)} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div className="cv-hdr-t"><h1>{t('Calendar')}</h1><div className="sub">{monthSummaryLine}</div></div>
    </div>
    <div className="cv-nav">
      <button className="iconbtn" onClick={() => go(prev.year, prev.monthIndex0)} aria-label={t('Previous month')}><Icon name="chevronLeft" /></button>
      <button type="button" className="cv-title" aria-expanded={picker} aria-haspopup="true" onClick={() => setPicker(p => !p)}>{t(MONTHS_LONG[monthIndex0])} {year}<Icon name="chevronDown" /></button>
      <button className="iconbtn" onClick={() => go(next.year, next.monthIndex0)} aria-label={t('Next month')}><Icon name="chevronRight" /></button>
      <button className="cv-today" onClick={goToday} disabled={isCurrentMonth && selectedKey === weekKey(today, ws)}>{t('Today')}</button>
    </div>
    {picker && <div className="card cv-picker">
      <label className="small muted" htmlFor="cv-year">{t('Year')}</label>
      <select id="cv-year" className="input" value={year} onChange={e => go(Number(e.target.value), monthIndex0)}>{yearOptions(S, today).map(y => <option key={y} value={y}>{y}</option>)}</select>
      <div className="cv-months" role="group" aria-label={t('Month')}>{MONTHS.map((m, i) => <button key={m} type="button" className={'chip' + (i === monthIndex0 ? ' on' : '')} aria-pressed={i === monthIndex0} onClick={() => { go(year, i); setPicker(false) }}>{t(m)}</button>)}</div>
    </div>}
    <div className="cv-grid" role="grid" aria-label={t(MONTHS_LONG[monthIndex0]) + ' ' + year}>
      <div className="cv-row cv-head" role="row"><span className="cv-wk">{t('Wk')}</span>{weekOrder(ws).map(d => <span key={d} className="cv-h" role="columnheader">{t(DAYS[d])}</span>)}</div>
      {grid.weeks.map(wk => <div key={wk.key} role="row" className={'cv-row' + (wk.key === selectedKey ? ' sel' : '')}>
        <button type="button" className="cv-wk" aria-pressed={wk.key === selectedKey} aria-label={t('Week {0}', wk.no.week)} onClick={() => setSelKey(wk.key)}>{wk.no.week}</button>
        {wk.days.map(d => {
          const s = statuses[d.iso] || REST
          return <button key={d.iso} type="button" role="gridcell"
            className={'cv-day ' + s.kind + (d.inMonth ? '' : ' out') + (d.iso === today ? ' today' : '')}
            aria-label={fmtDate(d.iso, true) + ': ' + statusLabel(s)} aria-current={d.iso === today ? 'date' : undefined}
            onClick={() => setSelKey(wk.key)}>
            <span>{d.day}</span><b className="cv-mk">{statusMark(s)}</b>
          </button>
        })}
      </div>)}
    </div>
    <div className="cv-legend">
      <span className="cv-key done"><i />{t('Trained')}</span>
      <span className="cv-key skipped"><i />{t('Skipped')}</span>
      <span className="cv-key missed"><i />{t('Missed plan')}</span>
      <span className="cv-key planned"><i />{t('Planned')}</span>
      <span className="cv-key today"><i />{t('Today')}</span>
    </div>
    <section className="cv-week">
      <div className="row between"><h2>{t('Week {0}', weekNo)}</h2><span className="small muted">{fmtDateRange(selectedKey, lastDayIso, true)}</span></div>
      <div className="small muted">{summary.workouts ? `${tn('{0} workout', '{0} workouts', summary.workouts)} · ${fmtDur(summary.durationMs)} · ${fmtVol(summary.volume, S.unit)}` : t('No workouts this week')}</div>
      <div className="cv-days">{summary.days.map(day => {
        const s = statuses[day.iso] || REST
        const dow = new Date(day.iso + 'T12:00:00').getDay()
        const planned = (s.routineIds || []).map(id => (S.routines || []).find(r => r.id === id)?.name).filter(Boolean).join(', ')
        return <div key={day.iso} className={'cv-daycard ' + s.kind + (day.iso === today ? ' today' : '')}>
          <div className="cv-dd"><span>{t(DAYS[dow])}</span><b>{Number(day.iso.slice(8, 10))}</b></div>
          <div className="cv-db">
            {day.workouts.length ? <div className="list">{day.workouts.map(x => {
              const routine = (S.routines || []).find(r => r.id === (x.w.routineId || x.w.routineIds?.[0]))
              return <div key={x.w.id || x.w.start} className="item" {...tappable(() => workoutDetailSheet(x.w))}>
                <span className="lrow-i cv-ico"><Icon name={glyphOf(routine?.emoji)} /></span>
                <div className="grow"><div className="tt">{x.w.name}</div><div className="ss">{[...durPart(x.durationMs), tn('{0} set', '{0} sets', x.sets), fmtVol(x.volume, S.unit)].join(' · ')}</div></div>
                <Icon name="chevronRight" className="chev" />
              </div>
            })}</div> : <div className="cv-st"><i className="cv-sd" /><span className="cv-badge">{statusLabel(s)}</span>{planned && s.kind !== 'skipped' ? <span className="cv-plan">{planned}</span> : null}</div>}
          </div>
        </div>
      })}</div>
    </section>
  </div>
}
