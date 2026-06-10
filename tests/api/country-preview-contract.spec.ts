// QA — Iteration 8: preview endpoint contract (architecture § 5.1/5.2).
//
// Part A re-implements the handler's validation rules (same drift-guard style
// as trending-spikeratio.spec.ts) because parseLimit/ISO_ALPHA2 are not
// exported from server/api/countries/[code]/preview.get.ts.
//
// Part B exercises the real findRecentByCountry() DTO mapping with a mocked
// prisma singleton — verifies field names, publishedAt Date→ISO serialization,
// hasContent derivation and the lean-select invariant (no contentHtml).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import { findRecentByCountry } from '~/server/utils/repositories/articles'

// Hoisted by Vitest above the imports — replaces the prisma singleton before
// the repository module evaluates.
vi.mock('~/server/utils/prisma', () => ({
  prisma: { article: { findMany: vi.fn() } }
}))

const findMany = prisma.article.findMany as unknown as ReturnType<typeof vi.fn>

// ---------------------------------------------------------------------------
// Part A — validation rules re-implemented (drift guard)
// ---------------------------------------------------------------------------

const ISO_ALPHA2 = /^[A-Z]{2}$/
const DEFAULT_LIMIT = 3
const MAX_LIMIT = 5

/** Mirror of preview.get.ts parseLimit(). NaN ⇒ handler throws 400. */
function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_LIMIT
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) return Number.NaN
  return n
}

/** Mirror of the handler's code normalization + validation. */
function validateCode(raw: string | undefined): string | null {
  const code = String(raw ?? '').toUpperCase()
  return ISO_ALPHA2.test(code) ? code : null
}

describe('preview handler — limit validation (contract § 5.1)', () => {
  it('defaults to 3 when omitted or empty', () => {
    expect(parseLimit(undefined)).toBe(3)
    expect(parseLimit(null)).toBe(3)
    expect(parseLimit('')).toBe(3)
  })

  it('accepts integers 1..5', () => {
    for (const v of ['1', '2', '3', '4', '5']) {
      expect(parseLimit(v)).toBe(Number(v))
    }
  })

  it('rejects out-of-range and non-integer values (→ 400)', () => {
    for (const v of ['0', '6', '-1', '2.5', 'abc', '1e1', 'Infinity']) {
      expect(Number.isNaN(parseLimit(v))).toBe(true)
    }
  })

  it('rejects repeated query params (?limit=1&limit=2 → array → 400)', () => {
    expect(Number.isNaN(parseLimit(['1', '2']))).toBe(true)
  })
})

describe('preview handler — country code validation (contract § 5.1)', () => {
  it('uppercases lowercase input before validating', () => {
    expect(validateCode('kr')).toBe('KR')
    expect(validateCode('Jp')).toBe('JP')
  })

  it('rejects non-alpha-2 inputs (→ 400)', () => {
    for (const v of ['KOR', 'K', 'K1', '', '  ', 'K-', undefined]) {
      expect(validateCode(v)).toBeNull()
    }
  })
})

// ---------------------------------------------------------------------------
// Part B — findRecentByCountry DTO mapping (real repository code, mocked DB)
// ---------------------------------------------------------------------------

describe('findRecentByCountry — CountryPreviewArticleDTO mapping', () => {
  beforeEach(() => {
    findMany.mockReset()
  })

  const rowA = {
    id: 'id-a',
    title: 'Korea unveils new budget plan',
    publishedAt: new Date('2026-06-10T02:11:00.000Z'),
    source: { name: 'Korea Herald Economy', topicSlug: 'economy' }
  }
  const rowB = {
    id: 'id-b',
    title: 'Defense talks resume',
    publishedAt: new Date('2026-06-09T23:59:59.500Z'),
    source: { name: 'Yonhap', topicSlug: 'military' }
  }

  it('maps rows to the exact DTO shape with ISO-8601 publishedAt', async () => {
    findMany
      .mockResolvedValueOnce([rowA, rowB]) // list query
      .mockResolvedValueOnce([{ id: 'id-a' }]) // resolveHasContentSet

    const items = await findRecentByCountry('KR', 3)

    expect(items).toEqual([
      {
        id: 'id-a',
        title: 'Korea unveils new budget plan',
        topicSlug: 'economy',
        sourceName: 'Korea Herald Economy',
        publishedAt: '2026-06-10T02:11:00.000Z',
        hasContent: true
      },
      {
        id: 'id-b',
        title: 'Defense talks resume',
        topicSlug: 'military',
        sourceName: 'Yonhap',
        publishedAt: '2026-06-09T23:59:59.500Z',
        hasContent: false
      }
    ])

    // Field-name contract: exactly the CountryPreviewArticleDTO keys — no
    // snake_case drift, no extra fields leaking from the row.
    expect(Object.keys(items[0]!).sort()).toEqual(
      ['hasContent', 'id', 'publishedAt', 'sourceName', 'title', 'topicSlug'].sort()
    )
  })

  it('queries enabled sources for the country, newest first, capped at limit', async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await findRecentByCountry('KR', 5)

    const args = findMany.mock.calls[0]![0]
    expect(args.where).toEqual({ source: { countryCode: 'KR', enabled: true } })
    expect(args.orderBy).toEqual({ publishedAt: 'desc' })
    expect(args.take).toBe(5)
  })

  it('lean select — never selects contentHtml/summary/link/imageUrl (invariant § 2.4)', async () => {
    findMany.mockResolvedValueOnce([]).mockResolvedValueOnce([])
    await findRecentByCountry('KR', 3)

    const select = findMany.mock.calls[0]![0].select
    expect(select.contentHtml).toBeUndefined()
    expect(select.summary).toBeUndefined()
    expect(select.link).toBeUndefined()
    expect(select.imageUrl).toBeUndefined()
    expect(select).toMatchObject({ id: true, title: true, publishedAt: true })
  })

  it('returns [] for zero rows and skips the hasContent query (200-empty case)', async () => {
    findMany.mockResolvedValueOnce([])
    const items = await findRecentByCountry('KR', 3)
    expect(items).toEqual([])
    // resolveHasContentSet early-returns on empty ids — single DB round trip.
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
