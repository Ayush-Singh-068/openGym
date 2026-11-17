// The calendar view's dates and week sums (views/CalendarView.jsx). Pure: no React.
// Every date is a 'YYYY-MM-DD' key. Dates are parsed at noon, so a daylight-saving change cannot
// move a day.
import { isoOf, weekKey, weekDayOffset, startOfWeek } from './format.js'
import { workoutDay, workoutDuration, sessionVolume, setsDone } from './history.js'

const noon = iso => new Date(iso + 'T12:00:00')

// The day `n` days after (or before, for a negative n) an ISO day.
export const addDays = (iso, n) => {
  const d = noon(iso)
  d.setDate(d.getDate() + n)
  return isoOf(d)
}

// The ISO-8601 week number of the week containing `iso`. The week is Monday-first or Sunday-first
// as `ws` says, and its Thursday decides the number (ISO rule), so a late-December week can
// belong to week 1 of the next year. Returns { week, year } so the UI can show either.
export function weekNumberOf(iso, ws) {
  const start = startOfWeek(iso, ws)
  const thu = new Date(start)
  thu.setDate(start.getDate() + ((4 - start.getDay() + 7) % 7))
  // The ISO week of that Thursday, counted in UTC so the local zone cannot shift it.
  const d = new Date(Date.UTC(thu.getFullYear(), thu.getMonth(), thu.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7)
  return { week, year: thu.getFullYear() }
}

// The weeks of one month as a grid. Rows run from the week of the 1st to the week of the last day,
// seven days each. The days from the neighbouring months that fill those rows are included, marked
// `inMonth: false`.
export function monthGrid(year, monthIndex0, ws) {
  const first = new Date(year, monthIndex0, 1, 12)
  const last = new Date(year, monthIndex0 + 1, 0, 12)
  const lead = weekDayOffset(first.getDay(), ws)
  const trail = 6 - weekDayOffset(last.getDay(), ws)
  const count = lead + last.getDate() + trail
  const days = []
  for (let i = 0; i < count; i++) {
    const d = new Date(year, monthIndex0, 1 - lead + i, 12)
    days.push({ iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === monthIndex0 && d.getFullYear() === year })
  }
  const weeks = []
  for (let i = 0; i < days.length; i += 7) {
    const row = days.slice(i, i + 7)
    weeks.push({ key: weekKey(row[0].iso, ws), no: weekNumberOf(row[0].iso, ws), days: row })
  }
  return { year, monthIndex0, weeks }
}

// The month `delta` months from (year, monthIndex0), with the year rolled over. `delta` may be any
// whole number, positive or negative.
export function shiftMonth(year, monthIndex0, delta) {
  const total = year * 12 + monthIndex0 + delta
  return { year: Math.floor(total / 12), monthIndex0: ((total % 12) + 12) % 12 }
}

// The earliest day with a workout, or null when there is none.
export function firstWorkoutDay(S) {
  let first = null
  for (const w of Array.isArray(S?.workouts) ? S.workouts : []) {
    const day = workoutDay(w)
    if (day && (first === null || day < first)) first = day
  }
  return first
}

// The years the picker offers, newest first: next year down to the year of the first workout.
// Never below 1970. With no workouts it is this year and next.
export function yearOptions(S, todayIso) {
  const first = firstWorkoutDay(S)
  const thisYear = Number(todayIso.slice(0, 4))
  const hi = thisYear + 1
  const lo = Math.min(hi, Math.max(1970, first ? Number(first.slice(0, 4)) : thisYear))
  const years = []
  for (let y = hi; y >= lo; y--) years.push(y)
  return years
}

// Keeps the year and month within the first workout's month (or this month when there are no
// workouts) and twelve months past today.
export function clampMonth(S, todayIso, year, monthIndex0) {
  const first = firstWorkoutDay(S)
  const todayY = Number(todayIso.slice(0, 4))
  const todayM = Number(todayIso.slice(5, 7)) - 1
  const lowKey = first ? Number(first.slice(0, 4)) * 12 + Number(first.slice(5, 7)) - 1 : todayY * 12 + todayM
  const highKey = (todayY * 12 + todayM) + 12
  const key = Math.min(highKey, Math.max(lowKey, year * 12 + monthIndex0))
  return { year: Math.floor(key / 12), monthIndex0: key % 12 }
}

// The seven days from a week's first day.
export function weekDays(weekStartIso) {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartIso, i))
}

// The workouts of each day in `isos`, and the totals of the week. Each day's workouts are in the
// order they started.
export function weekSummary(S, isos) {
  const all = Array.isArray(S?.workouts) ? S.workouts : []
  const days = isos.map(iso => {
    const workouts = all
      .filter(w => workoutDay(w) === iso)
      .sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0))
      .map(w => ({
        w,
        name: w.name,
        durationMs: workoutDuration(w),
        volume: sessionVolume(w, S),
        sets: Array.isArray(w.entries) ? setsDone(w) : 0,
      }))
    return { iso, workouts }
  })
  const flat = days.flatMap(d => d.workouts)
  return {
    days,
    workouts: flat.length,
    durationMs: flat.reduce((n, x) => n + x.durationMs, 0),
    volume: flat.reduce((n, x) => n + x.volume, 0),
  }
}

// The week that stays selected after the month changes: the one the user picked if it is still in
// the grid, else the week of today, else the first week that has a day of this month.
export function weekToSelect(grid, selectedKey, todayIso) {
  const weeks = grid.weeks
  if (selectedKey && weeks.some(wk => wk.key === selectedKey)) return selectedKey
  const today = weeks.find(wk => wk.days.some(d => d.iso === todayIso))
  if (today) return today.key
  const firstInMonth = weeks.find(wk => wk.days.some(d => d.inMonth))
  return (firstInMonth || weeks[0]).key
}
