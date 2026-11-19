// The body of a saved workout's sheet: the header, the totals, one card per exercise with its sets,
// the session note and the actions. The sheet frame comes from openSheet (sheets.jsx workoutDetailSheet).
import { useEffect, useMemo, useRef, useState } from 'react'
import '../views/history-views.css'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { menuSheet, confirmSheet, bwSheet, exerciseDetailSheet, exerciseHistorySheet, workoutDateSheet, workoutDurationSheet, shareWorkoutSheet, repeatWorkout, AutoEndedNote, mediaGoesToo, saveFitFile } from '../sheets.jsx'
import { NOTE_MAX, countsWarmups } from '../lib/history.js'
import { scaleName } from '../lib/effort.js'
import { setTagName } from '../lib/set-tags.js'
import { stampWorkout } from '../lib/sync-merge.js'
import { sameWorkout } from '../lib/workout-date.js'
import { editCompletedSession } from '../lib/session-edit.js'
import { saveSessionAsRoutine, routineFromSession } from '../lib/session-routines.js'
import { shareRoutineSheet } from './RoutineShare.jsx'
import { workoutText } from '../lib/workout-text.js'
import { workoutFit, fitFileName } from '../lib/fit-export.js'
import { printWorkout } from '../lib/report-print.js'
import { copyText } from '../lib/clipboard.js'
import { closeThenNav, nav } from '../lib/nav.js'
import { isOn } from '../lib/modules.js'
import { formOf } from '../lib/daily-form.js'
import { readingsOf, readingTime } from '../lib/weigh-ins.js'
import { dayCheckinSheet, feltLine } from './DayCheckinSheet.jsx'
import { useSheetKeyboard, tappable } from '../lib/use-sheet-keyboard.js'
import { buildDetailModel } from '../lib/workout-detail-model.js'
import { trendGlyph, trendLabel } from '../lib/set-trend.js'
import { exUnitTag } from '../lib/ex-unit.js'
import { EXIDX, isAssisted } from '../lib/exercises.js'
import { exerciseNameFor, exerciseNameClass, t, tn } from '../lib/i18n.js'
import { fmtDate, fmtClock, fmtDur, fmtVol, fmtWeight, fmtNum, exerciseNameText } from '../lib/format.js'
import { speedUnitOf } from '../lib/speed.js'
import { nameIn } from '../lib/a11y-name.js'
import { glyphOf } from '../lib/glyphs.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import { Thumb } from './Media.jsx'
import WorkoutMediaSection from './WorkoutMedia.jsx'
import { CircuitResults } from './CircuitCard.jsx'
import { RecordBadge } from './SetRecord.jsx'

// Shows a toast. Reads the store when called, so it always uses the current toast handler.
const toast = m => useUI.getState().toast(m)
const S = () => useStore.getState().S

// The signed form of a number: "+5", "-2.5", "0".
const signed = n => (n > 0 ? '+' : '') + fmtNum(n)

export default function WorkoutDetailView({ w, close }) {
  const noteRef = useRef(null)
  const onNoteFocus = useSheetKeyboard(noteRef)
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  // The session note is editable here rather than only at the finish sheet: what you want to
  // record about a session is often clearer once you have looked at what you actually did.
  const [note, setNote] = useState(w.note || '')
  // A note written here is an edit of the saved workout, stamped for the sync to keep it over an
  // older copy of the same workout (stampWorkout) — and only when it changed, since a stamp
  // outranks what another device wrote since.
  const saveNote = () => update(s => {
    const rec = s.workouts.find(x => sameWorkout(x, w))
    if (!rec) return
    const text = note.trim().slice(0, NOTE_MAX)
    if (text === (rec.note || '')) return
    if (text) rec.note = text; else delete rec.note
    stampWorkout(rec)
  })
  // onBlur alone loses the note: Escape, the Android back gesture and swipe-to-dismiss all
  // close the sheet without ever moving focus out of the textarea. Flush on unmount too. The
  // ref is what makes that work — a cleanup closes over the note from its own render, which
  // is the empty string this started with.
  const latest = useRef(note)
  latest.current = note
  const initial = useRef(w.note || '')
  useEffect(() => () => {
    const text = latest.current.trim().slice(0, NOTE_MAX)
    if (text === initial.current) return
    update(s => {
      const rec = s.workouts.find(x => sameWorkout(x, w))
      if (!rec || text === (rec.note || '')) return   // deleted from this very sheet, or already saved
      if (text) rec.note = text; else delete rec.note
      stampWorkout(rec)
    })
  }, [])
  const nameOf = e => (EXIDX[e.id] ? exerciseNameFor(EXIDX[e.id]) : (e.n || e.id))
  // Everything the sheet shows is worked out once per change of the workout or the store.
  const model = useMemo(() => buildDetailModel(st, w), [st, w])
  const { header, sections, cards, grouped } = model
  const routine = (st.routines || []).find(r => r.id === header.routineId)
  // Copied with the note as it stands in the box, which may not be saved yet.
  const copyAsText = async () => {
    const rec = { ...(st.workouts.find(x => sameWorkout(x, w)) || w), note: note.trim() }
    toast(await copyText(workoutText(rec, { unit: st.unit, nameOf, speedUnit: speedUnitOf(st), warmups: countsWarmups(st), state: st })) ? t('Copied') : t('Could not copy'))
  }
  // A Garmin .fit activity (#447) of the saved record, for Garmin Connect's Import Data.
  const exportFit = () => {
    const rec = st.workouts.find(x => sameWorkout(x, w)) || w
    let bytes
    try { bytes = workoutFit(rec, { unit: st.unit, version: __APP_VERSION__ }) }
    catch (e) { toast(t('Could not create the file')); return }
    saveFitFile(new Blob([bytes], { type: 'application/vnd.ant.fit' }), fitFileName(rec))
  }
  const saveAsPdf = () => {
    saveNote()
    const rec = { ...(st.workouts.find(x => sameWorkout(x, w)) || w), note: note.trim() }
    printWorkout(st, rec, { owner: useStore.getState().user?.name || '' })
  }
  const shareAsImage = () => shareWorkoutSheet(st.workouts.find(x => sameWorkout(x, w)) || w)
  // The note lives in a textarea that only writes on blur, and moving the workout re-keys a
  // legacy record — so whatever leaves this sheet flushes it first and stops the unmount hook
  // writing it a second time.
  const flushNote = () => {
    saveNote()
    initial.current = latest.current.trim().slice(0, NOTE_MAX)
  }
  const saveAsRoutine = () => confirmSheet({
    title: t('Save as routine?'),
    message: t('Create an independent routine from these exercise targets. Your workout history is kept.'),
    confirmText: t('Save'),
    onConfirm: () => {
      let id
      try { update(s => { id = saveSessionAsRoutine(s, w, w.name) }) }
      catch (e) { toast(t(e.message)); return }
      close()
      nav('/plan/r/' + id)
    }
  })
  // "Do the workout I just did": the session as a routine (the one Save as routine makes, never
  // saved here) behind a link (components/RoutineShare.jsx).
  const shareWithFriend = () => {
    let routine
    try { routine = routineFromSession(w, w.name, st.routines) } catch { toast(t('Nothing to share in this one.')); return }
    shareRoutineSheet(routine)
  }
  // Matched the way the edits above are, not by id: a workout from before ids has none, and
  // filtering on `x.id !== undefined` took every other one of them with it.
  const deleteWorkout = () => confirmSheet({ title: t('Delete workout?'), message: t('This removes it from your history for good.') + mediaGoesToo(S().workouts.find(x => sameWorkout(x, w))), confirmText: t('Delete'), danger: true, onConfirm: () => { update(s => { s.workouts = s.workouts.filter(x => !sameWorkout(x, w)) }); close(); toast(t('Workout deleted')) } })
  // The once-in-a-while things, in one menu over this sheet: when it happened, keeping it as a
  // routine, getting it out of the app (on paper: the browser's print dialog or the phone's
  // print sheet; .fit for Garmin Connect), and Delete on its own at the end.
  const openOptions = () => {
    flushNote()
    menuSheet({
      title: w.name,
      sections: [
        { items: [
          // Locked while another workout is open, like Edit workout: tapping says why (sheets.jsx).
          { icon: 'calendar', label: t('Change date & time'), sub: st.active ? t('Finish your workout first') : undefined, onClick: () => workoutDateSheet(w, close) },
          { icon: 'stopwatch', label: t('Change duration'), sub: st.active ? t('Finish your workout first') : undefined, onClick: () => workoutDurationSheet(w, close) },
          { icon: 'plus', label: t('Save as routine'), onClick: saveAsRoutine },
        ] },
        { title: t('Share'), items: [
          { icon: 'person', label: t('Share with a friend'), sub: t('As a routine they can do too'), onClick: shareWithFriend },
          // The share card is part of Motivation (Settings → Modules).
          isOn(st, 'motivation') && { icon: 'share', label: t('Share as image'), onClick: shareAsImage },
          { icon: 'copy', label: t('Copy as text'), onClick: copyAsText },
          { icon: 'note', label: t('Save as PDF'), onClick: saveAsPdf },
          { icon: 'download', label: t('Export as .fit file'), onClick: exportFit },
        ] },
        { items: [
          { icon: 'trash', label: t('Delete workout'), danger: true, onClick: deleteWorkout },
        ] },
      ],
    })
  }
  // One exercise's card, or a superset's cards under one label.
  const unitNodes = unit => (unit.length < 2
    ? <ExerciseCard key={unit[0]} card={cards[unit[0]]} />
    : <div key={'ss' + unit[0]} className="wd-ss">
      <div className="ss-label"><Icon name="link" />{t('Superset')}</div>
      {unit.map(i => <ExerciseCard key={i} card={cards[i]} />)}
    </div>)
  return <div className="wdv">
    <header className="wdv-head">
      <span className="wdv-icon"><Icon name={glyphOf(routine?.emoji)} /></span>
      <div className="wdv-head-main">
        <h3 className="wdv-title">{header.name}</h3>
        <div className="wdv-when muted small">{fmtDate(header.dateISO, true, true)}{header.startMs ? ' · ' + fmtClock(header.startMs) : ''}</div>
      </div>
    </header>
    <div className="wdv-stats">
      {header.durationMs >= 60000 && <div className="wdv-stat"><b>{fmtDur(header.durationMs)}</b><span>{t('Duration')}</span></div>}
      <div className="wdv-stat"><b>{fmtVol(header.volume, st.unit)}</b><span>{t('Volume')}</span></div>
      <div className="wdv-stat"><b>{header.sets}</b><span>{t('Sets')}</span></div>
      {header.prCount > 0 && <div className="wdv-stat pr-tile"><b><Icon name="trophy" />{header.prCount}</b><span>{t('PRs')}</span></div>}
      {header.bodyweight && <div className="wdv-stat"><b>{fmtWeight(header.bodyweight, st.unit)}</b><span>{t('Body weight')}</span></div>}
    </div>
    {/* What the day said besides the workout: the check-in and the weight, a tap from changing or deleting. */}
    <DayRows d={header.dateISO} />
    {/* Ended by itself (lib/forgotten-workout.js): said so, with Reopen for 24 hours. */}
    <AutoEndedNote w={w} close={close} />
    {/* Circuits, AMRAPs, EMOMs and intervals: the score and the round times (lib/circuit.js). */}
    <CircuitResults w={w} />
    {grouped ? sections.map(sec => <div key={sec.rid || '__none'}>
      <div className="wdv-section-head">
        <span className="row" style={{ gap: 7 }}>{sec.iconName && <Icon name={sec.iconName} />}{sec.name || t('Freestyle')}</span>
        <span className="small dim">{t('{0} sets', sec.sets)} · {fmtVol(sec.volume, st.unit)}</span>
      </div>
      {sec.units.map(unitNodes)}
    </div>) : sections[0]?.units.map(unitNodes)}
    {/* Progress photos and form-check videos: added and removed right here, on the saved record. */}
    <WorkoutMediaSection w={w} />
    <div className="small muted" style={{ margin: '4px 0 6px' }}>{t('Session note')}</div>
    <textarea ref={noteRef} className="input" rows={2} maxLength={NOTE_MAX} value={note} data-tour="wd-note"
      placeholder={t('How the session went as a whole.')}
      onFocus={onNoteFocus} onChange={e => setNote(e.target.value)} onBlur={saveNote} />
    <div style={{ height: 14 }} />
    {st.active ? <>
      {/* Past workouts are edited in the same screen as a running one, so only one can be open. Say so
          and offer the way back, instead of a dead button. */}
      <p className="small muted" data-testid="wd-edit-blocked">{st.active.editingWorkoutId
        ? t('You are already editing a workout. Finish or discard that edit first.')
        : t('A workout is in progress. Finish it first, then you can edit this one.')}</p>
      <Button icon="play" data-tour="wd-edit" onClick={() => { flushNote(); closeThenNav(close, '/workout') }}>
        {st.active.editingWorkoutId ? t('Open the edit') : t('Open running workout')}
      </Button>
    </> : null}
    {/* The editor starts from the record as it is, so a note typed here goes in first — the same
        flush the date row does, and the unmount hook then has nothing left to write over it. */}
    {st.active ? null : <Button icon="pencil" data-tour="wd-edit" onClick={() => {
      flushNote()
      try { update(state => { editCompletedSession(state, w) }); closeThenNav(close, '/workout') }
      catch (error) { toast(t(error.message)) }
    }}>{t('Edit workout')}</Button>}
    <div style={{ height: 8 }} />
    {/* The same exercises again, today, as a new session (#58): the rows read what was logged
        in this workout. The record itself stays as it is. */}
    <Button icon="reset" disabled={!!st.active} onClick={() => {
      flushNote()
      repeatWorkout(w, close)
    }}>{t('Repeat today')}</Button>
    <div style={{ height: 10 }} />
    {/* Everything else a past workout can do, once in a while each, behind one row (v1.4.4): it
        used to be eight more buttons down the sheet. */}
    <div className="list menu-list">
      <div className="item menu-item menu-more" data-tour="wd-options" aria-haspopup="dialog" {...tappable(openOptions)}>
        <span className="lrow-i"><Icon name="more" /></span>
        <div className="grow"><div className="tt">{t('Workout options')}</div>
          <div className="ss">{t('Date, duration, share, export, delete')}</div></div>
        <Icon name="chevronRight" className="menu-chev" />
      </div>
    </div>
  </div>
}

// The day's check-in and the day's weight (lib/daily-form.js, lib/weigh-ins.js), each a row that opens
// its own sheet to change or delete. Nothing at all for a day that has neither.
function DayRows({ d }) {
  const st = useStore(s => s.S)
  const felt = formOf(st, d)
  const weights = readingsOf((st.bodyweight || []).find(b => b && b.d === d))
  if (!felt && !weights.length) return null
  return <div className="list" style={{ marginBottom: 12 }}>
    {felt && <div className="item" {...tappable(() => dayCheckinSheet(d))}>
      <div className="grow"><div className="tt">{t('Felt that day')}</div><div className="ss">{feltLine(felt)}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>}
    {weights.map(r => <div key={r.id} className="item" {...tappable(() => bwSheet({ edit: { d, id: r.id } }))}>
      <div className="grow"><div className="tt">{t('Weight that day')}</div>
        <div className="ss">{fmtNum(r.w) + ' ' + st.unit}{weights.length > 1 && readingTime(r) ? ' · ' + readingTime(r) : ''}</div></div>
      <Icon name="chevronRight" className="chev" />
    </div>)}
  </div>
}

// One exercise of the workout: its name and totals, a table of its sets, and the lines under it.
function ExerciseCard({ card }) {
  const st = useStore(s => s.S)
  const ex = EXIDX[card.id]
  const { rows, stats, compare } = card
  const unit = st.unit
  const showEffort = rows.some(r => r.effort)
  const effortKind = rows.find(r => r.effort)?.effort.kind
  const dir = compare ? compare.dir : 0
  return <section className="card wdv-card wd-ex tap-host">
    <div className="wdv-card-head row">
      {ex && <button type="button" className="wd-thumb" aria-label={nameIn(exerciseNameText(ex), t('Details'))} aria-haspopup="dialog" onClick={() => exerciseDetailSheet(ex)}><Thumb ex={ex} /></button>}
      <button type="button" className="grow item-open tap-main wdv-card-title" aria-haspopup="dialog" onClick={() => exerciseHistorySheet(card.id)}>
        <span className={`tt ${exerciseNameClass(ex)}`}>{card.name} {card.pr && <span className="pr"><Icon name="trophy" />PR</span>}{exUnitTag(st, card.id)}</span>
        <span className="small dim">{tn('{0} set', '{0} sets', stats.workSets)} · {fmtVol(stats.volume, unit)}{card.timeMs > 0 ? ' · ' + fmtDur(Math.max(card.timeMs, 60000)) : ''}</span>
      </button>
      <Icon name="chevronRight" className="chev" />
    </div>
    {rows.length ? <table className="wdv-sets" aria-label={t('Sets')}>
      <thead><tr><th>{t('Set')}</th><th>{t('Logged')}</th>{showEffort && <th>{scaleName(effortKind)}</th>}</tr></thead>
      <tbody>
        {rows.map(r => <tr key={r.j} className={'wdv-set' + (r.warm ? ' warm' : '') + (r.records.length ? ' rec' : '')}>
          <td className="wdv-n">{r.warm ? t('Warm-up') : r.n}</td>
          <td className="wdv-val"><span className="wd-set">{r.label}</span>
            {r.trend && <span className={'settrend inline ' + (r.trend.dir > 0 ? 'up' : r.trend.dir < 0 ? 'down' : 'same')} role="img" aria-label={trendLabel(r.trend, unit)} title={trendLabel(r.trend, unit)}>{trendGlyph(r.trend)}</span>}
            {r.records.length > 0 && <RecordBadge kinds={r.records} assisted={isAssisted(card.id)} />}
            {r.note && <Icon name="note" className="setnote-mark" role="img" aria-hidden="false" aria-label={t('Note: {0}', r.note)} />}
            {r.tag && <span className="settag" role="img" style={{ '--tag': r.tag.color }} aria-label={t('Colour tag: {0}', setTagName(r.tag.id))}>{r.tag.shape}</span>}</td>
          {showEffort && <td className="wdv-eff">{r.effort ? r.effort.value : ''}</td>}
        </tr>)}
      </tbody>
    </table> : <div className="small dim">{t('no sets')}</div>}
    <div className="wdv-meta">
      {compare && <div className={'wdv-vs ' + (dir > 0 ? 'up' : dir < 0 ? 'down' : 'same')}>{compareText(compare, unit)}</div>}
      {stats.e1rm && <div className="wdv-e1rm small muted">{t('Est. 1RM')}: <b>{fmtWeight(stats.e1rm.est, unit)}</b> <span className="dim">({stats.e1rm.r} × {fmtNum(stats.e1rm.w)}, {stats.formulaName})</span></div>}
      {card.note && <div className="small dim wdv-note">{card.notePin && <Icon name="pin" />}{card.note}</div>}
      {card.setNotes.map(n => <span key={n.i} className="small dim setnote-hist"><Icon name="note" />{n.label}: {n.note}</span>)}
    </div>
  </section>
}

// The "vs last time" line: the date, then each change that is not zero, or "Same as last time".
function compareText(c, unit) {
  const head = t('vs last time ({0})', fmtDate(c.lastDay))
  if (c.secDelta !== undefined) return [head, c.secDelta ? signed(c.secDelta) + ' s' : t('Same as last time')].join(' · ')
  const parts = []
  if (c.bestDelta) parts.push(t('{0} on the best set', signed(c.bestDelta) + ' ' + unit))
  if (c.repsDelta) parts.push((c.repsDelta > 0 ? '+' : '-') + tn('{0} rep', '{0} reps', Math.abs(c.repsDelta)))
  if (c.volDelta) parts.push(signed(c.volDelta) + ' ' + unit + (c.volPct != null ? ' (' + signed(c.volPct) + '%)' : ''))
  if (!parts.length) parts.push(t('Same as last time'))
  return [head, ...parts].join(' · ')
}
