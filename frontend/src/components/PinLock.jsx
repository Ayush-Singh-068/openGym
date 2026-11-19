import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { t } from '../lib/i18n.js'
import { LOCAL_BUILD } from '../lib/demo.js'
import { useUI } from '../store/useUI.js'
import { Row, Button } from './ui.jsx'
import { hasPin, setPin, clearPin, verifyPin, validPin, maskPin, pinFromField, eraseDevice, waitLeft, LOCK_AFTER_MS, LOCK_CHANNEL, PIN_KEY } from '../lib/pin-lock.js'
import { useLocked, setLocked } from '../lib/lock-state.js'

// A PIN is typed in a plain text field that shows one dot per digit (maskPin, pinFromField in
// lib/pin-lock.js): a password field makes browsers offer to save the PIN in their password
// manager, which would then offer it to whoever holds the phone, and the CSS that masks a text
// field is not the same in every browser.
const masked = { type: 'text', inputMode: 'numeric', autoComplete: 'off', autoCorrect: 'off', autoCapitalize: 'off', spellCheck: false, 'data-lpignore': 'true', 'data-1p-ignore': 'true' }
const field = { font: 'inherit', fontSize: '1.4rem', letterSpacing: '0.4em', textAlign: 'center', width: '100%', maxWidth: 240, padding: '12px 10px', borderRadius: 12, border: '1px solid var(--sep, #8884)', background: 'var(--bg-el)', color: 'var(--label)' }
const wrap = { position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg)', color: 'var(--label)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }
const CHANNEL = LOCK_CHANNEL

// While the lock shows, everything else on the page is out of reach too: not just covered but
// inert (no Tab, no click, no screen reader), so a sheet underneath cannot take the focus back,
// a key cannot tick a set on the workout screen, and the backup reminder cannot be tapped.
function useShutOut(lockEl, on) {
  useEffect(() => {
    if (!on || !lockEl) return undefined
    const done = []
    for (const el of document.body.children) {
      if (el === lockEl || el.tagName === 'SCRIPT') continue
      const prev = { inert: el.inert, hidden: el.getAttribute('aria-hidden') }
      el.inert = true
      el.setAttribute('aria-hidden', 'true')
      done.push(() => { el.inert = prev.inert; if (prev.hidden === null) el.removeAttribute('aria-hidden'); else el.setAttribute('aria-hidden', prev.hidden) })
    }
    return () => done.forEach(f => f())
  }, [lockEl, on])
}

/* Full-screen lock: at start and after LOCK_AFTER_MS in the background, while a PIN is set. A
   screen lock only (lib/pin-lock.js says what it does not protect against). While it shows, App
   renders nothing but this (lib/lock-state.js), so the app is not in the page behind it. */
export default function PinLock() {
  const locked = useLocked()
  const [pin, setPinText] = useState('')
  const [msg, setMsg] = useState('')
  const [wait, setWait] = useState(() => waitLeft())
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)   // "Erase this device's data?" is on the screen
  const [el, setEl] = useState(null)
  const input = useRef(null)
  const hiddenAt = useRef({ wall: 0, mono: 0 })
  useShutOut(el, locked)
  useEffect(() => {
    if (!LOCAL_BUILD) return undefined
    // Back from the background: locked after LOCK_AFTER_MS by either clock, and at once when the
    // wall clock reads earlier than when the page was hidden (it was set back).
    const on = () => {
      if (document.visibilityState === 'hidden') { hiddenAt.current = { wall: Date.now(), mono: performance.now() }; return }
      const { wall, mono } = hiddenAt.current
      if (!wall || !hasPin()) return
      const dWall = Date.now() - wall
      const dMono = performance.now() - mono
      if (dWall < 0 || Math.max(dWall, dMono) >= LOCK_AFTER_MS) { setPinText(''); setMsg(''); setAsking(false); setWait(waitLeft()); setLocked(true) }
    }
    document.addEventListener('visibilitychange', on)
    // Another tab turned the lock off, changed it, or erased the device: this one reloads, so it
    // starts from what is stored now instead of holding the old profile and the old lock.
    const onStorage = e => { if (e.key === PIN_KEY || e.key === null) location.reload() }
    window.addEventListener('storage', onStorage)
    let bc = null
    try { bc = new BroadcastChannel(CHANNEL); bc.onmessage = () => location.reload() } catch { /* single tab only */ }
    return () => { document.removeEventListener('visibilitychange', on); window.removeEventListener('storage', onStorage); bc?.close() }
  }, [])
  useEffect(() => {
    if (!wait) return undefined
    const id = setInterval(() => { const w = waitLeft(); setWait(w); if (!w) setMsg('') }, 500)
    return () => clearInterval(id)
  }, [wait])
  // The field takes the focus back when the wait ends or the check is done.
  useEffect(() => { if (locked && !wait && !busy && !asking) input.current?.focus() }, [locked, wait, busy, asking])
  if (!locked) return null
  const submit = async e => {
    e.preventDefault()
    if (busy || wait) return
    setBusy(true)
    try {
      const r = await verifyPin(pin)
      if (r.busy) return
      if (r.ok) { setLocked(false); setPinText(''); setMsg(''); return }
      // The lock was removed or the device erased in another tab while this one was waiting.
      if (!hasPin()) { location.reload(); return }
      setPinText('')
      setWait(r.wait)
      setMsg(r.wait ? t('Too many tries. Wait a moment.') : t('That PIN is not right.'))
    } finally { setBusy(false) }
  }
  // Erased only after the question below was answered Yes. A failure keeps the lock and says so.
  const erase = async () => {
    setAsking(false)
    setMsg('')
    setBusy(true)
    try {
      if (!(await eraseDevice())) setMsg(t('The data could not be erased, so the lock stays on. Close other tabs of this app and try again.'))
    } finally { setBusy(false) }
  }
  return createPortal(
    <form ref={setEl} style={wrap} onSubmit={submit} role="dialog" aria-modal="true" aria-label={t('App locked')}>
      {asking ? <div style={{ maxWidth: 320 }}>
        {/* The same question the app asks everywhere (sheets.jsx confirmSheet), drawn here because
            no sheet can open while the app is out of the page. */}
        <h3 style={{ marginBottom: 8 }}>{t('Erase this device’s data?')}</h3>
        <div className="muted" style={{ marginBottom: 18, lineHeight: 1.5 }}>{t('There is no way to reset a PIN. To open the app again, everything stored in this browser is erased: your workouts, routines and settings. Afterwards you can restore them from a backup file you saved earlier. Without a backup file they are gone for good.')}</div>
        <button type="button" className="btn danger" onClick={erase}>{t('Erase everything')}</button>
        <div style={{ height: 8 }} />
        <Button type="button" variant="ghost" className="dim" onClick={() => setAsking(false)}>{t('Cancel')}</Button>
      </div> : <>
        <h1 style={{ margin: 0 }}>{t('Enter your PIN')}</h1>
        <input ref={input} {...masked} style={field} autoFocus value={maskPin(pin)} disabled={!!wait || busy}
          aria-label={t('PIN')} onChange={e => setPinText(pinFromField(pin, e.target.value))} />
        <div className="muted small" style={{ minHeight: '1.4em' }}>
          {/* The words are announced once; the seconds are for the eyes only. */}
          <span role="alert">{msg}</span>{wait ? <span aria-hidden="true"> {t('Try again in {0} s.', Math.ceil(wait / 1000))}</span> : null}
        </div>
        <button type="submit" className="btn primary" disabled={!!wait || busy || !validPin(pin)}>{t('Unlock')}</button>
        <button type="button" className="btn" disabled={busy} onClick={() => { setMsg(''); setAsking(true) }}>{t('Forgot PIN?')}</button>
      </>}
    </form>,
    document.body,
  )
}

/* Settings → Data & backup → App lock (local build): set, change or turn off the PIN. Changing or
   turning off asks for the current one. */
export function PinSettings() {
  const toast = useUI(s => s.toast)
  const [on, setOn] = useState(() => hasPin())
  const [mode, setMode] = useState(null)   // null | 'set' | 'change' | 'off'
  const [cur, setCur] = useState('')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const done = () => { setMode(null); setCur(''); setA(''); setB(''); setErr('') }
  // A field shows one dot per digit; what was typed in it is read back as digits (pinFromField).
  const typed = (value, set) => e => set(pinFromField(value, e.target.value))
  const save = async () => {
    if (busy) return
    setErr('')
    // What can be told from the fields alone is said first, before the current PIN is checked
    // (a check counts as a try), and a blank new PIN always gets an answer.
    if (mode !== 'set' && !cur) { setErr(t('Type your current PIN.')); return }
    if (mode !== 'off') {
      if (!a && !b) { setErr(mode === 'change' ? t('Type a new PIN. To remove the lock instead, press Cancel and choose Turn off the lock.') : t('Type a new PIN.')); return }
      if (!validPin(a)) { setErr(t('Use 4 to 8 digits.')); return }
      if (a !== b) { setErr(t('The two PINs do not match.')); return }
    }
    setBusy(true)
    try {
      if (!globalThis.crypto?.subtle) { setErr(t('This page cannot lock the app: it needs a secure (https) address.')); return }
      if (mode !== 'set') {
        const r = await verifyPin(cur)
        if (!r.ok) { setErr(r.wait ? t('Too many tries. Wait a moment.') : r.busy ? '' : t('That PIN is not right.')); return }
      }
      if (mode === 'off') { clearPin(); setOn(false); done(); toast(t('App lock is off')); return }
      if (!(await setPin(a))) { setErr(t('The PIN could not be saved.')); return }
      setOn(true); done(); toast(t('PIN saved'))
    } catch { setErr(t('The PIN could not be saved.')) } finally { setBusy(false) }
  }
  const box = { font: 'inherit', padding: '10px 12px', borderRadius: 10, border: '1px solid var(--sep, #8884)', background: 'var(--bg-el)', color: 'var(--label)', width: '100%', boxSizing: 'border-box' }
  return <>
    {!mode && !on && <Row icon="lock" iconTint="var(--acc)" title={t('Lock the app with a PIN')} subtitle={t('Asks for it when the app opens and after it was away for a while.')} accessory="chevron" onClick={() => setMode('set')} />}
    {!mode && on && <>
      <Row icon="lock" iconTint="var(--green)" title={t('Change PIN')} accessory="chevron" onClick={() => setMode('change')} />
      <Row icon="xmark" iconTint="var(--red)" title={t('Turn off the lock')} subtitle={t('Asks for your current PIN.')} accessory="chevron" onClick={() => setMode('off')} />
    </>}
    {mode && <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600 }}>{mode === 'set' ? t('Lock the app with a PIN') : mode === 'change' ? t('Change PIN') : t('Turn off the lock')}</div>
      {mode === 'off' && <div className="muted small">{t('Type your current PIN to turn the lock off. Your data stays as it is.')}</div>}
      {mode !== 'set' && <input {...masked} style={box} autoFocus placeholder={t('Current PIN')} aria-label={t('Current PIN')} value={maskPin(cur)} onChange={typed(cur, setCur)} />}
      {mode !== 'off' && <>
        <input {...masked} style={box} autoFocus={mode === 'set'} placeholder={t('New PIN (4 to 8 digits)')} aria-label={t('New PIN (4 to 8 digits)')} value={maskPin(a)} onChange={typed(a, setA)} />
        <input {...masked} style={box} placeholder={t('New PIN again')} aria-label={t('New PIN again')} value={maskPin(b)} onChange={typed(b, setB)} />
      </>}
      {err && <div role="alert" className="small" style={{ color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn primary" onClick={save} disabled={busy}>{mode === 'off' ? t('Turn off') : t('Save PIN')}</button>
        <button className="btn" onClick={done}>{t('Cancel')}</button>
      </div>
    </div>}
  </>
}
