// Documents the validation contract of
// `server/api/countries/[code]/trends.get.ts` as executable invariants.
// Mirror changes to both this spec and the handler if validation rules change.

import { describe, it, expect } from 'vitest'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const VALID_DAYS = new Set([7, 30, 90])

interface TrendsQuery {
  code?: unknown
  days?: unknown
}

type TrendsValidation =
  | { ok: true; code: string; days: number }
  | { ok: false; reason: string }

function validateTrends(q: TrendsQuery): TrendsValidation {
  const code = String(q.code ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(code)) return { ok: false, reason: 'code' }

  const rawDays = q.days === undefined ? 30 : Number(q.days)
  if (!VALID_DAYS.has(rawDays)) return { ok: false, reason: 'days' }

  return { ok: true, code, days: rawDays }
}

describe('/api/countries/[code]/trends validation', () => {
  it('accepts a canonical request', () => {
    expect(validateTrends({ code: 'US', days: 30 })).toEqual({ ok: true, code: 'US', days: 30 })
  })

  it('accepts days 7, 30, and 90', () => {
    for (const days of [7, 30, 90]) {
      expect(validateTrends({ code: 'KR', days })).toEqual({ ok: true, code: 'KR', days })
    }
  })

  it('defaults days to 30 when omitted', () => {
    const r = validateTrends({ code: 'JP' })
    expect(r).toEqual({ ok: true, code: 'JP', days: 30 })
  })

  it('uppercases the country code', () => {
    const r = validateTrends({ code: 'gb', days: 7 })
    expect(r.ok && r.code).toBe('GB')
  })

  it('rejects non-alpha-2 country code', () => {
    expect(validateTrends({ code: 'USA' })).toEqual({ ok: false, reason: 'code' })
    expect(validateTrends({ code: '' })).toEqual({ ok: false, reason: 'code' })
    expect(validateTrends({ code: '1' })).toEqual({ ok: false, reason: 'code' })
  })

  it('rejects invalid days values', () => {
    expect(validateTrends({ code: 'US', days: 14 })).toEqual({ ok: false, reason: 'days' })
    expect(validateTrends({ code: 'US', days: 0 })).toEqual({ ok: false, reason: 'days' })
    expect(validateTrends({ code: 'US', days: -7 })).toEqual({ ok: false, reason: 'days' })
    expect(validateTrends({ code: 'US', days: 'thirty' })).toEqual({ ok: false, reason: 'days' })
  })

  it('accepts string-typed numeric days (typical getQuery behavior)', () => {
    expect(validateTrends({ code: 'US', days: '30' })).toEqual({ ok: true, code: 'US', days: 30 })
    expect(validateTrends({ code: 'US', days: '7' })).toEqual({ ok: true, code: 'US', days: 7 })
  })
})
