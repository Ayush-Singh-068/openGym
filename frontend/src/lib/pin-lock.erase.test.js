import { describe, expect, it } from 'vitest'
import { maskPin, pinFromField, eraseDevice, PIN_KEY, DEVICE_DBS } from './pin-lock.js'

describe('maskPin', () => {
  it('shows one dot per digit', () => {
    expect(maskPin('2468')).toBe('••••')
    expect(maskPin('')).toBe('')
    expect(maskPin(null)).toBe('')
  })
})

describe('pinFromField', () => {
  const dots = n => '•'.repeat(n)
  it('adds a typed digit at the end', () => {
    expect(pinFromField('24', dots(2) + '6')).toBe('246')
  })
  it('takes a digit off the end when one dot is deleted', () => {
    expect(pinFromField('246', dots(2))).toBe('24')
    expect(pinFromField('2', '')).toBe('')
  })
  it('reads a paste as digits, whatever is between them', () => {
    expect(pinFromField('', '1234 5678')).toBe('12345678')
    expect(pinFromField('', '12-34')).toBe('1234')
  })
  it('replaces the PIN when the whole field was selected and typed over', () => {
    expect(pinFromField('2468', '9')).toBe('9')
  })
  it('ignores letters, reads native digits and stops at 8', () => {
    expect(pinFromField('12', dots(2) + 'a')).toBe('12')
    expect(pinFromField('', '١٢٣٤')).toBe('1234')
    expect(pinFromField('1234567', dots(7) + '89')).toBe('12345678')
  })
})

// A stand-in for the browser: every step is written to `events`, in the order it happened.
function rig({ failing = [], silent = false, throwOnRemove = false } = {}) {
  const events = []
  const store = new Map([['a', '1'], [PIN_KEY, 'x'], ['b', '2']])
  const storage = {
    get length() { return store.size },
    key: i => [...store.keys()][i] ?? null,
    removeItem: k => { if (throwOnRemove) throw new Error('refused'); events.push('rm:' + k); store.delete(k) },
  }
  const idb = {
    deleteDatabase: name => {
      events.push('db:' + name)
      const request = {}
      if (!silent) setTimeout(() => (failing.includes(name) ? request.onerror?.() : request.onsuccess?.()), 0)
      return request
    },
  }
  const Channel = class { postMessage(m) { events.push('tell:' + m) } close() {} }
  const reload = () => events.push('reload')
  return { events, store, args: { idb, storage, Channel, reload, waitMs: 30 } }
}

describe('eraseDevice', () => {
  it('tells other tabs, deletes both databases, then the other keys, the PIN key last, then reloads', async () => {
    const { events, store, args } = rig()
    expect(await eraseDevice(args)).toBe(true)
    expect(events[0]).toBe('tell:erase')
    expect(events.slice(1, 3).sort()).toEqual(DEVICE_DBS.map(n => 'db:' + n).sort())
    expect(events.slice(3)).toEqual(['rm:a', 'rm:b', 'rm:' + PIN_KEY, 'reload'])
    expect(store.size).toBe(0)
  })

  it('keeps the lock and does not reload when a database cannot be deleted', async () => {
    const { events, store, args } = rig({ failing: [DEVICE_DBS[1]] })
    expect(await eraseDevice(args)).toBe(false)
    expect(store.has(PIN_KEY)).toBe(true)
    expect(events.filter(e => e.startsWith('rm:'))).toEqual([])
    expect(events).not.toContain('reload')
  })

  it('gives up on a delete that never answers', async () => {
    const { events, store, args } = rig({ silent: true })
    expect(await eraseDevice(args)).toBe(false)
    expect(store.has(PIN_KEY)).toBe(true)
    expect(events).not.toContain('reload')
  })

  it('keeps the lock when storage refuses the removal', async () => {
    const { events, args } = rig({ throwOnRemove: true })
    expect(await eraseDevice(args)).toBe(false)
    expect(events).not.toContain('reload')
  })

  it('treats a database API that throws as a failure', async () => {
    const { events, args } = rig()
    args.idb = { deleteDatabase: () => { throw new Error('no') } }
    expect(await eraseDevice(args)).toBe(false)
    expect(events).not.toContain('reload')
  })
})
