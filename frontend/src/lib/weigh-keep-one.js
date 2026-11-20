// "Keep one": a day with several weigh-ins keeps the one the "Daily weigh-in value" setting points at
// and removes the others. It never runs by itself, and one Undo puts every removed reading back.
import { dailyModeOf, readingsOf, removeWeighIn, restoreWeighIn } from './weigh-ins.js'

// The reading to keep: the earliest (the morning value), the latest, or for the average the one
// nearest to it (the earlier one on a tie). `readings` come sorted by time (readingsOf).
export function readingToKeep(readings, mode = 'first') {
  const rs = Array.isArray(readings) ? readings : []
  if (!rs.length) return null
  if (mode === 'last') return rs[rs.length - 1]
  if (mode === 'avg') {
    const mean = rs.reduce((n, r) => n + Number(r.w), 0) / rs.length
    return rs.reduce((best, r) => (Math.abs(Number(r.w) - mean) < Math.abs(Number(best.w) - mean) ? r : best), rs[0])
  }
  return rs[0]
}

// S is mutated. Returns what Undo needs, one entry per reading removed; empty when the day has
// fewer than two readings.
export function keepOneWeighIn(S, d, now = Date.now(), mode = dailyModeOf(S)) {
  const day = (Array.isArray(S?.bodyweight) ? S.bodyweight : []).find(b => b && b.d === d)
  const rs = readingsOf(day)
  if (rs.length < 2) return []
  const keep = readingToKeep(rs, mode)
  const undos = []
  rs.filter(r => r.id !== keep.id).forEach((r, i) => {
    const undo = removeWeighIn(S, d, r.id, now + i, mode)
    if (undo) undos.push(undo)
  })
  return undos
}

// Undo of keepOneWeighIn: every removed reading back. S is mutated.
export function undoKeepOne(S, undos, now = Date.now(), mode = dailyModeOf(S)) {
  ;[...(Array.isArray(undos) ? undos : [])].reverse().forEach((u, i) => restoreWeighIn(S, u, now + i, mode))
}
