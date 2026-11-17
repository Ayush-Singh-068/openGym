/* The local build's nudge to save a backup file now and then (VITE_LOCAL=1).
 *
 * The copies kept in IndexedDB (lib/local-mirror.js) do not survive "clear site data" or removing
 * the installed app; a file does. So the app remembers when a file was last exported on this
 * device and asks again after REMIND_DAYS, at most once a day. Both stamps live in their own
 * localStorage keys, not in the profile: a restored backup must not make it look freshly saved.
 */
export const REMIND_DAYS = 7
const DAY = 86400000
const EXPORTED = 'gym_last_export'
const SNOOZED = 'gym_export_snooze'

const read = k => { try { return Number(localStorage.getItem(k)) || 0 } catch { return 0 } }
const write = (k, v) => { try { localStorage.setItem(k, String(v)) } catch { /* no room: it asks again */ } }

/** Whether to ask now. `first` is when this device first held data (so a new profile is not nagged
 *  on day one): the last export, else that. */
export function exportDue({ last, snoozed = 0, first = 0, now = Date.now(), has = true, days = REMIND_DAYS }) {
  if (!has) return false
  const since = last || first
  if (!since) return false
  return now - since >= days * DAY && now - snoozed >= DAY
}

export const markExported = (now = Date.now()) => write(EXPORTED, now)
export const snoozeReminder = (now = Date.now()) => write(SNOOZED, now)
/** Remembers the first time data was seen here, once. */
export function markFirstData(now = Date.now()) { if (!read('gym_first_data')) write('gym_first_data', now) }
export const reminderState = () => ({ last: read(EXPORTED), snoozed: read(SNOOZED), first: read('gym_first_data') })
