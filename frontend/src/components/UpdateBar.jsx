import { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'
import { MOBILE } from '../lib/mobile.js'
import Icon from './Icon.jsx'

/* "New version ready": public/sw.js installs a new version in the background and keeps it waiting,
   so the app always opens from this device and never waits on the server. Reload hands over to the
   new version now; otherwise it takes over once every window of the app has closed. A check for a
   new version runs at start and whenever the app comes back to the front. */
export default function UpdateBar() {
  const [waiting, setWaiting] = useState(null)
  const [hidden, setHidden] = useState(false)
  const reloading = useRef(false)
  const regRef = useRef(null)
  const shown = useRef(null)
  useEffect(() => {
    const sw = typeof navigator !== 'undefined' ? navigator.serviceWorker : null
    if (MOBILE || !sw) return undefined
    let live = true
    // Controlled at start: a later controller change is an update taking over, from this window or
    // another one, so this window reloads onto it too (its old files are about to be swept).
    // Uncontrolled at start (a first install), the change is the first worker claiming the page.
    const hadController = !!sw.controller
    // A waiting worker next to an active one is an update. A newer one than the bar showed brings
    // the bar back even after it was closed.
    const offer = w => {
      if (!live || !w || !regRef.current?.active || shown.current === w) return
      shown.current = w
      setHidden(false)
      setWaiting(w)
    }
    const watch = w => {
      if (!w) return
      if (w.state === 'installed') offer(w)
      else w.addEventListener('statechange', () => { if (w.state === 'installed') offer(w) })
    }
    const onFound = () => watch(regRef.current?.installing)
    const onVis = () => { if (document.visibilityState === 'visible') regRef.current?.update().catch(() => {}) }
    const onChange = () => {
      if (!reloading.current && !hadController) return
      // One reload per 10 s at most, so a misbehaving worker can never loop the page.
      try {
        const last = Number(sessionStorage.getItem('gym_sw_reload') || 0)
        if (Date.now() - last < 10000) return
        sessionStorage.setItem('gym_sw_reload', String(Date.now()))
      } catch { /* no storage: reload anyway */ }
      location.reload()
    }
    sw.ready.then(r => {
      if (!live) return
      regRef.current = r
      offer(r.waiting)
      watch(r.installing)
      r.addEventListener('updatefound', onFound)
      document.addEventListener('visibilitychange', onVis)
      r.update().catch(() => {})
    }).catch(() => {})
    sw.addEventListener('controllerchange', onChange)
    return () => {
      live = false
      regRef.current?.removeEventListener('updatefound', onFound)
      document.removeEventListener('visibilitychange', onVis)
      sw.removeEventListener('controllerchange', onChange)
    }
  }, [])
  if (!waiting || hidden) return null
  const reload = () => {
    const w = regRef.current?.waiting || waiting
    if (!w || w.state === 'redundant') { setWaiting(null); return }
    reloading.current = true
    w.postMessage({ type: 'SKIP_WAITING' })
  }
  // The same structure and classes as the connection bar (SyncBanner), so the existing styles apply.
  return <div className="conn-bar">
    <div className="conn-row" role="status" aria-live="polite">
      <button className="conn" onClick={reload}>
        <span className="conn-t">{t('New version ready')}</span>
        <span className="conn-a">{t('Reload')}</span>
      </button>
      <button type="button" className="conn-x" aria-label={t('Close')} onClick={() => setHidden(true)}><Icon name="xmark" /></button>
    </div>
  </div>
}
