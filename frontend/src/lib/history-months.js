// History's list in months: one heading per calendar month, newest first like the rows.
export const monthKeyOf = d => String(d || '').slice(0, 7)

// Rows (each with a `d` date, newest first) in runs of the same month: [{ key: '2026-11', rows: [...] }].
export function groupByMonth(rows) {
  const groups = []
  for (const r of rows || []) {
    const key = monthKeyOf(r?.d)
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.rows.push(r)
    else groups.push({ key, rows: [r] })
  }
  return groups
}
