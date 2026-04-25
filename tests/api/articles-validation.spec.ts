// Documents the query-validation contract of `server/api/articles.get.ts` as
// executable invariants. The parsing helper is currently file-private, so
// this spec re-implements the same rules and tests the parallel function.
// If the handler changes, update BOTH here and in the file — drift is a bug.

import { describe, it, expect } from 'vitest'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const TOPICS = new Set([
  'military', 'economy', 'politics',
  'environment', 'technology', 'health', 'culture', 'sports'
])

function parsePositiveInt(
  raw: unknown,
  fallback: number,
  max?: number
): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return Number.NaN
  if (max !== undefined && n > max) return Number.NaN
  return n
}

interface Query {
  country?: unknown
  topic?: unknown
  page?: unknown
  pageSize?: unknown
}

type Validation =
  | { ok: true; country: string; topic: string; page: number; pageSize: number }
  | { ok: false; reason: string }

function validate(q: Query): Validation {
  const country = String(q.country ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(country)) return { ok: false, reason: 'country' }

  const topic = String(q.topic ?? '')
  if (!TOPICS.has(topic)) return { ok: false, reason: 'topic' }

  const page = parsePositiveInt(q.page, 1)
  if (Number.isNaN(page)) return { ok: false, reason: 'page' }

  const pageSize = parsePositiveInt(q.pageSize, 20, 50)
  if (Number.isNaN(pageSize)) return { ok: false, reason: 'pageSize' }

  return { ok: true, country, topic, page, pageSize }
}

describe('/api/articles query validation', () => {
  it('accepts a canonical request', () => {
    const r = validate({ country: 'US', topic: 'politics', page: 1, pageSize: 20 })
    expect(r).toEqual({
      ok: true,
      country: 'US',
      topic: 'politics',
      page: 1,
      pageSize: 20
    })
  })

  it('uppercases the country param', () => {
    const r = validate({ country: 'us', topic: 'economy' })
    expect(r.ok && r.country).toBe('US')
  })

  it('rejects unknown topics', () => {
    const r = validate({ country: 'US', topic: 'finance' })
    expect(r).toEqual({ ok: false, reason: 'topic' })
  })

  it('accepts new topic slugs (e.g. sports, environment)', () => {
    expect(validate({ country: 'US', topic: 'sports' }).ok).toBe(true)
    expect(validate({ country: 'US', topic: 'environment' }).ok).toBe(true)
  })

  it('rejects non-alpha-2 country', () => {
    expect(validate({ country: 'USA', topic: 'economy' })).toEqual({
      ok: false,
      reason: 'country'
    })
    expect(validate({ country: '1', topic: 'economy' })).toEqual({
      ok: false,
      reason: 'country'
    })
  })

  it('rejects non-integer or non-positive page', () => {
    expect(
      validate({ country: 'US', topic: 'economy', page: 0 }).ok
    ).toBe(false)
    expect(
      validate({ country: 'US', topic: 'economy', page: -1 }).ok
    ).toBe(false)
    expect(
      validate({ country: 'US', topic: 'economy', page: 1.5 }).ok
    ).toBe(false)
  })

  it('caps pageSize at 50', () => {
    expect(
      validate({ country: 'US', topic: 'economy', pageSize: 51 }).ok
    ).toBe(false)
    const r = validate({ country: 'US', topic: 'economy', pageSize: 50 })
    expect(r.ok && r.pageSize).toBe(50)
  })

  it('defaults to page=1, pageSize=20', () => {
    const r = validate({ country: 'US', topic: 'economy' })
    expect(r.ok && r.page).toBe(1)
    expect(r.ok && r.pageSize).toBe(20)
  })

  it('accepts string-typed numeric params (typical getQuery behavior)', () => {
    const r = validate({
      country: 'US',
      topic: 'economy',
      page: '2',
      pageSize: '10'
    })
    expect(r.ok && r.page).toBe(2)
    expect(r.ok && r.pageSize).toBe(10)
  })
})
