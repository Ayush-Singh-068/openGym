// Starting weights for a plan that ships without any (the built-in six-day plan): which lifts to
// ask about, and how the answers are written into the routines' slots. Pure helpers, no React.
import { EXIDX, exOr } from './exercises.js'
import { exerciseNameFor } from './i18n.js'
import { modeOf, isBw } from './history.js'
import { defaultIncrement, weightIncrement } from './progression.js'
import { exUnitOf, profileUnit, shownWeight } from './ex-unit.js'
import { convertExact, EXACT_STORE } from './units.js'

// A slot worth asking a weight for: loaded reps work. Not a hold, a run or a body-weight move,
// and not a short warm-up slot (2 sets or fewer with no progression rule, like bands and arm circles).
export const isStartingWeightSlot = slot =>
  !!slot && slot.id != null && modeOf(slot) === 'reps' && !isBw(slot) &&
  (slot.prog === 'double' || slot.prog === 'linear' || (Number(slot.sets) || 0) >= 3)

// The routine ids from `ids` that exist in the state and sit in `folder`, in the order given.
export const mainRoutineIds = (S, ids, folder) =>
  [].concat(ids || []).filter(id => (S?.routines || []).some(r => r && r.id === id && (r.folder || '') === folder))

const routineOf = (S, id) => (S?.routines || []).find(r => r && r.id === id)
const exerciseOf = (S, id) => EXIDX[id] || (S?.customEx || []).find(c => c && c.id === id) || exOr(id)

// One row per distinct exercise across the routines, in the order they first appear:
// { id, name, routineId (the first routine it is in), routineNames, unit, step, currentWeight }.
// `unit` is the unit the lift is shown in (a lift can be pinned to the other unit), `step` is its
// weight increment in that unit and `currentWeight` is the slot's weight in that unit.
export function startingWeightRows(S, routineIds) {
  const rows = []
  const byId = new Map()
  for (const rid of [].concat(routineIds || [])) {
    const r = routineOf(S, rid)
    if (!r || !Array.isArray(r.ex)) continue
    for (const slot of r.ex) {
      if (!isStartingWeightSlot(slot)) continue
      let row = byId.get(slot.id)
      if (!row) {
        const unit = exUnitOf(S, slot.id)
        row = {
          id: slot.id,
          name: exerciseNameFor(exerciseOf(S, slot.id)),
          routineId: r.id,
          routineNames: [],
          unit,
          step: unit === profileUnit(S) ? weightIncrement(slot, unit) : defaultIncrement(slot.id, unit),
          currentWeight: Number(shownWeight(S, slot.id, Number(slot.weight) || 0)) || 0,
        }
        byId.set(slot.id, row)
        rows.push(row)
      }
      if (!row.routineNames.includes(r.name)) row.routineNames.push(r.name)
    }
  }
  return rows
}

// Writes the typed weights into the slots of those routines (call it inside the store's update()).
// `weightsById` is { exerciseId: weight } with each weight in the unit that lift is shown in; it is
// stored in the profile's unit, the way every slot weight is. An id with no positive weight is left
// as it is. Alternatives (subs) are not touched, and warm-up rows follow the slot as percentages.
// Returns how many slots were set.
export function applyStartingWeights(S, routineIds, weightsById) {
  let set = 0
  for (const rid of [].concat(routineIds || [])) {
    const r = routineOf(S, rid)
    if (!r || !Array.isArray(r.ex)) continue
    for (const slot of r.ex) {
      if (!isStartingWeightSlot(slot)) continue
      const typed = Number(weightsById?.[slot.id])
      if (!(typed > 0)) continue
      const from = exUnitOf(S, slot.id)
      slot.weight = from === profileUnit(S) ? typed : convertExact(typed, from, profileUnit(S), EXACT_STORE)
      set++
    }
  }
  return set
}
