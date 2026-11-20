// The List layout's marker (s.active.cur): the exercise that is open. When the exercise it is on is
// finished, the marker moves to the next one that is still open. This is true whether or not
// "Collapse completed exercises" is on: that setting only folds the finished ones away.
// Pure: no store, no screen. The workout screen decides when to ask.
import { supersetUnits } from './history.js'
import { nextUnfinishedUnit } from './supersetFlow.js'

// The entry index the marker should move to, or null when it stays where it is: the marker's unit is
// still open, the unit has no sets yet (an empty exercise stays open, as the fold does), or nothing open follows it.
export function markerAfterDone(entries, cur) {
  if (!Array.isArray(entries) || entries.length === 0) return null
  const units = supersetUnits(entries)
  const unit = units.find(u => u.includes(cur))
  if (!unit) return null
  const finished = unit.every(i => {
    const sets = entries[i]?.sets || []
    return sets.length > 0 && sets.every(x => x.done)
  })
  if (!finished) return null
  const next = nextUnfinishedUnit(entries, units, cur)
  return next ? next[0] : null
}
