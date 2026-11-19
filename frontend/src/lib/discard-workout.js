// Throwing the running workout away, from every place that can: the workout screen, the forgotten
// workout card and the crash screen. Named for the watch first (it must not read as finished and be
// saved to Apple Health, #776), then the session is gone and its timers stop. What the workout asked at
// Start (lib/day-answers.js staged) lives on the session, so it goes with it and nothing else is touched.
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { markDiscarded } from './watch-sync.js'

export function discardActiveWorkout() {
  markDiscarded(useStore.getState().S.active?.id)
  useStore.getState().update(s => { s.active = null })
  useUI.getState().stopRest()
  useUI.getState().stopWork()
}
