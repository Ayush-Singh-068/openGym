// Records of one exercise, read from all its sessions (lib/exercise-history.js with no limit).
// Work sets only: a done set that is not a warm-up (warm-up sets never reach a session's sets).
// Pure: no store, no formatting. The screen formats the numbers and writes the labels.

// `h` is exerciseHistory(S, exId, { limit: Number.MAX_SAFE_INTEGER }).
export function exerciseRecords(h) {
  // Oldest first. Only a strict improvement replaces a record, so on a full tie the earlier one is kept.
  const sessions = [...(h.sessions || [])].sort((a, b) => a.t - b.t)
  const out = {
    metric: h.metric,
    count: sessions.length,
    firstD: sessions.length ? sessions[0].d : null,
    latestId: sessions.length ? sessions[sessions.length - 1].id : null,
    heavy: null,
    most: null,
    inSession: null,
  }
  const sets = s => (s.sets || []).filter(x => x.done !== false)
  const wOf = x => Number(x.w) || 0
  const rOf = x => Number(x.r) || 0
  if (h.metric === 'weight' || h.metric === 'reps') {
    sessions.forEach(s => sets(s).forEach(x => {
      const w = wOf(x), r = rOf(x)
      // Heaviest weight: most weight; on a tie, more reps.
      if (w > 0 && (!out.heavy || w > out.heavy.w || (w === out.heavy.w && r > out.heavy.r))) out.heavy = { w, r, d: s.d, sid: s.id }
      // Most reps in a set: most reps; on a tie, the heavier set.
      if (r > 0 && (!out.most || r > out.most.r || (r === out.most.r && w > out.most.w))) out.most = { w, r, d: s.d, sid: s.id }
    }))
    // Most in one session: total weight × reps (weight), or total reps (reps).
    sessions.forEach(s => {
      const ws = sets(s)
      const v = h.metric === 'reps' ? ws.reduce((a, x) => a + rOf(x), 0) : ws.reduce((a, x) => a + wOf(x) * rOf(x), 0)
      if (v > 0 && (!out.inSession || v > out.inSession.v)) out.inSession = { v, n: ws.length, d: s.d, sid: s.id }
    })
  } else {
    // Timed, distance and cardio: the session's own value.
    sessions.forEach(s => {
      const v = Number(s.value) || 0
      if (v > 0 && (!out.inSession || v > out.inSession.v)) out.inSession = { v, n: (s.sets || []).length, d: s.d, sid: s.id }
    })
  }
  return out
}
