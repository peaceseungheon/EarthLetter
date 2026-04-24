import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useRelativeTime } from '../../composables/useRelativeTime'

describe('useRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-04-22T12:00:00Z'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns an empty string for empty input', () => {
    expect(useRelativeTime('')).toBe('')
  })

  it('falls back to the ISO string for unparseable input', () => {
    expect(useRelativeTime('not-a-date')).toBe('not-a-date')
  })

  it('formats minutes in the recent past', () => {
    const iso = new Date('2026-04-22T11:57:00Z').toISOString()
    const out = useRelativeTime(iso, 'en')
    // Intl.RelativeTimeFormat with `numeric: 'auto'` → "3 minutes ago"
    expect(out).toMatch(/3 minutes? ago/)
  })

  it('formats hours', () => {
    const iso = new Date('2026-04-22T09:00:00Z').toISOString()
    const out = useRelativeTime(iso, 'en')
    expect(out).toMatch(/3 hours? ago/)
  })

  it('formats days', () => {
    const iso = new Date('2026-04-20T12:00:00Z').toISOString()
    const out = useRelativeTime(iso, 'en')
    expect(out).toMatch(/2 days? ago/)
  })
})
