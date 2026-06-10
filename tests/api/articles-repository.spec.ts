// QA — Perf iteration (2026-06-10): single-round-trip list queries.
//
// Exercises the real findArticles() / findLatestAcrossSources() against a
// mocked prisma singleton. Verifies:
//   - exact ArticleDTO shape (publishedAt Date→ISO string, nested source)
//   - inline hasContent derivation (true/false straight from the row)
//   - windowed total (COUNT(*) OVER()) — no separate count query on the
//     normal path
//   - the count fallback that only fires for out-of-range pages (page > 1,
//     zero rows) per architecture § 2-D2
//   - invariant § 2.4: the contentHtml body is never selected — only the
//     IS NOT NULL check appears in the SQL

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '~/server/utils/prisma'
import {
  findArticles,
  findLatestAcrossSources
} from '~/server/utils/repositories/articles'

// Hoisted by Vitest above the imports — replaces the prisma singleton before
// the repository module evaluates.
vi.mock('~/server/utils/prisma', () => ({
  prisma: { $queryRaw: vi.fn(), article: { count: vi.fn() } }
}))

const queryRaw = prisma.$queryRaw as unknown as ReturnType<typeof vi.fn>
const count = prisma.article.count as unknown as ReturnType<typeof vi.fn>

/** Reassemble the tagged-template SQL with `?` where values were bound. */
function sqlOf(call: unknown[]): string {
  const [strings] = call as [TemplateStringsArray, ...unknown[]]
  return strings.join('?')
}

/** Bound parameter values of a tagged-template call (in order). */
function paramsOf(call: unknown[]): unknown[] {
  return call.slice(1)
}

// Flattened raw rows as the single-query SQL returns them.
const rawRowWithContent = {
  id: 'id-a',
  title: 'Budget plan unveiled',
  summary: 'A summary',
  link: 'https://news.example.com/a',
  imageUrl: 'https://img.example.com/a.jpg',
  publishedAt: new Date('2026-06-10T02:11:00.000Z'),
  hasContent: true,
  sourceId: 7,
  sourceName: 'Korea Herald Economy',
  sourceCountryCode: 'KR',
  sourceTopicSlug: 'economy',
  total: 41
}
const rawRowWithoutContent = {
  id: 'id-b',
  title: 'Defense talks resume',
  summary: null,
  link: 'https://news.example.com/b',
  imageUrl: null,
  publishedAt: new Date('2026-06-09T23:59:59.500Z'),
  hasContent: false,
  sourceId: 8,
  sourceName: 'Yonhap',
  sourceCountryCode: 'KR',
  sourceTopicSlug: 'military',
  total: 41
}

beforeEach(() => {
  queryRaw.mockReset()
  count.mockReset()
})

describe('findArticles — single-query list (ArticleDTO mapping + total)', () => {
  it('maps rows to the exact ArticleDTO shape with ISO-8601 publishedAt', async () => {
    queryRaw.mockResolvedValueOnce([rawRowWithContent, rawRowWithoutContent])

    const result = await findArticles({
      country: 'KR',
      topic: 'economy',
      page: 1,
      pageSize: 20
    })

    expect(result.total).toBe(41) // windowed COUNT(*) OVER()
    expect(result.items).toEqual([
      {
        id: 'id-a',
        title: 'Budget plan unveiled',
        summary: 'A summary',
        link: 'https://news.example.com/a',
        imageUrl: 'https://img.example.com/a.jpg',
        publishedAt: '2026-06-10T02:11:00.000Z',
        hasContent: true,
        source: {
          id: 7,
          name: 'Korea Herald Economy',
          countryCode: 'KR',
          topicSlug: 'economy'
        }
      },
      {
        id: 'id-b',
        title: 'Defense talks resume',
        summary: null,
        link: 'https://news.example.com/b',
        imageUrl: null,
        publishedAt: '2026-06-09T23:59:59.500Z',
        hasContent: false,
        source: {
          id: 8,
          name: 'Yonhap',
          countryCode: 'KR',
          topicSlug: 'military'
        }
      }
    ])

    // Field-name contract: exactly the ArticleDTO keys — the windowed
    // `total` and flattened source columns must not leak into the DTO.
    expect(Object.keys(result.items[0]!).sort()).toEqual(
      ['hasContent', 'id', 'imageUrl', 'link', 'publishedAt', 'source', 'summary', 'title'].sort()
    )
    expect(Object.keys(result.items[0]!.source).sort()).toEqual(
      ['countryCode', 'id', 'name', 'topicSlug'].sort()
    )
  })

  it('is one round trip on the normal path — no separate count query', async () => {
    queryRaw.mockResolvedValueOnce([rawRowWithContent])
    await findArticles({ country: 'KR', topic: 'economy', page: 1, pageSize: 20 })

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(count).not.toHaveBeenCalled()

    const sql = sqlOf(queryRaw.mock.calls[0]!)
    expect(sql).toContain('COUNT(*) OVER()::int AS "total"')
    expect(sql).toContain('s."countryCode" = ?')
    expect(sql).toContain('s."topicSlug"   = ?')
    expect(sql).toContain('s."enabled"')
    expect(sql).toContain('ORDER  BY a."publishedAt" DESC')
    // country, topic, LIMIT pageSize, OFFSET (page-1)*pageSize
    expect(paramsOf(queryRaw.mock.calls[0]!)).toEqual(['KR', 'economy', 20, 0])
  })

  it('never selects the contentHtml body — only the IS NOT NULL check (invariant § 2.4)', async () => {
    queryRaw.mockResolvedValueOnce([rawRowWithContent])
    await findArticles({ country: 'KR', topic: 'economy', page: 1, pageSize: 20 })

    const sql = sqlOf(queryRaw.mock.calls[0]!)
    expect(sql).toContain('(a."contentHtml" IS NOT NULL) AS "hasContent"')
    expect(sql.split('"contentHtml"')).toHaveLength(2) // exactly one mention
  })

  it('page 1 + zero rows → total 0 without a fallback count', async () => {
    queryRaw.mockResolvedValueOnce([])
    const result = await findArticles({
      country: 'KR',
      topic: 'economy',
      page: 1,
      pageSize: 20
    })

    expect(result).toEqual({ total: 0, items: [] })
    expect(count).not.toHaveBeenCalled()
  })

  it('out-of-range page (page > 1, zero rows) falls back to a count query', async () => {
    queryRaw.mockResolvedValueOnce([])
    count.mockResolvedValueOnce(41)

    const result = await findArticles({
      country: 'KR',
      topic: 'economy',
      page: 9,
      pageSize: 20
    })

    expect(result).toEqual({ total: 41, items: [] })
    expect(count).toHaveBeenCalledTimes(1)
    expect(count).toHaveBeenCalledWith({
      where: { source: { countryCode: 'KR', topicSlug: 'economy', enabled: true } }
    })
    // OFFSET reflects the requested page: (9-1)*20 = 160.
    expect(paramsOf(queryRaw.mock.calls[0]!)).toEqual(['KR', 'economy', 20, 160])
  })
})

describe('findLatestAcrossSources — home featured strip', () => {
  it('maps rows to ArticleDTO with inline hasContent, one round trip', async () => {
    const { total: _a, ...homeRowA } = rawRowWithContent
    const { total: _b, ...homeRowB } = rawRowWithoutContent
    queryRaw.mockResolvedValueOnce([homeRowA, homeRowB])

    const items = await findLatestAcrossSources(12)

    expect(queryRaw).toHaveBeenCalledTimes(1)
    expect(items.map((i) => i.hasContent)).toEqual([true, false])
    expect(items[0]!.publishedAt).toBe('2026-06-10T02:11:00.000Z')
    expect(items[0]!.source).toEqual({
      id: 7,
      name: 'Korea Herald Economy',
      countryCode: 'KR',
      topicSlug: 'economy'
    })

    const sql = sqlOf(queryRaw.mock.calls[0]!)
    expect(sql).toContain('s."enabled"')
    expect(sql).toContain('(a."contentHtml" IS NOT NULL) AS "hasContent"')
    expect(sql).toContain('ORDER  BY a."publishedAt" DESC')
    expect(paramsOf(queryRaw.mock.calls[0]!)).toEqual([12])
  })
})
