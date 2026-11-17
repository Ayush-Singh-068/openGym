// Adds the built-in six-day push/pull/legs plan to a store draft: the routines (mergePlan), the
// exercise names the plan writes, and the deload settings it asks for. Call it inside the store's
// update(), the same way mergePlan is called. Loading it twice adds nothing twice: a routine with
// the same name and folder is reused as it is.
import { mergePlan } from '../plan-share.js'
import { normalizeAliases } from '../exercise-aliases.js'
import { deloadCycleOf } from '../deload-cycle.js'
import { weekKey, weekStartOf, todayISO } from '../format.js'
import { MAX_BACKUPS } from '../routine-backups.js'
import { PPL_SHOWN_NAMES, PPL_DELOAD, SIX_DAY_PPL } from './six-day-ppl.js'

export function applySixDayPpl(s, bundle, { schedule } = {}) {
  // Routines already here (same name and folder) are reused; only the missing ones are added.
  const have = s.routines || []
  const finalIds = []
  const missing = []
  bundle.routines.forEach((r, i) => {
    const hit = have.find(x => x.name === r.name && (x.folder || '') === (r.folder || ''))
    if (hit) finalIds[i] = hit.id
    else missing.push(i)
  })
  const result = mergePlan(s, { ...bundle, routines: missing.map(i => bundle.routines[i]) }, { schedule: false })
  missing.forEach((bi, k) => { finalIds[bi] = result.ids[k] })

  // The week points at the routines the plan names, reused or new (as mergePlan does on schedule).
  if (schedule) {
    s.week = s.week || {}
    for (let d = 0; d <= 6; d++) delete s.week[d]
    for (const [d, val] of Object.entries(bundle.week || {})) {
      const ids = [].concat(val).map(old => {
        const i = bundle.routines.findIndex(r => r.id === old)
        return i >= 0 ? finalIds[i] : null
      }).filter(Boolean)
      if (ids.length) s.week[d] = ids
    }
  }

  // parsePlan and mergePlan leave custom exercises out of subs, so put them back by name, on the
  // routines this call added (a reused routine is left as the user has it).
  const newCustomId = cid => {
    const c = (bundle.customEx || []).find(x => x.id === cid)
    if (!c) return null
    const hit = (s.customEx || []).find(x => (x.n || '').toLowerCase() === (c.n || '').toLowerCase() && x.bp === c.bp)
    return hit ? hit.id : null
  }
  for (const bi of missing) {
    const plan = SIX_DAY_PPL.routines[bi]
    const r = s.routines.find(x => x.id === finalIds[bi])
    if (!plan || !r) continue
    plan.ex.forEach((slot, si) => {
      if (!slot.subs || !r.ex[si]) return
      const subs = []
      for (const id of slot.subs) {
        const got = id.startsWith('cppl') ? newCustomId(id) : id
        if (got && got !== r.ex[si].id && !subs.includes(got)) subs.push(got)
      }
      if (subs.length) r.ex[si].subs = subs.slice(0, MAX_BACKUPS)
      else delete r.ex[si].subs
    })
  }

  // The names the plan writes for catalogue exercises: shown everywhere, as typed.
  s.exAliases = { ...(s.exAliases || {}) }
  s.exShownName = { ...(s.exShownName || {}) }
  for (const { id, name } of PPL_SHOWN_NAMES) {
    s.exAliases[id] = normalizeAliases([...normalizeAliases(s.exAliases[id]), name])
    s.exShownName[id] = name
  }

  // The deload week this plan asks for, counted from this week.
  const base = deloadCycleOf(s)
  s.deloadCycle = { ...base, ...PPL_DELOAD, from: weekKey(todayISO(), weekStartOf(s)) }
  return { ...result, routines: bundle.routines.length, ids: finalIds, added: missing.length }
}
