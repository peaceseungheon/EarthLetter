// server/utils/repositories/articles.ts
//
// All Prisma access for Article rows. Route handlers never touch `prisma`
// directly — they call these functions so tests can stub at this seam.
//
// Feature K — Article now carries `contentHtml` (sanitized RSS payload).
// Two invariants matter here:
//   1. LIST queries (findArticles, findLatestAcrossSources) MUST NOT select
//      `contentHtml`. See architecture § 2.4–2.5. The HTML body is TEXT /
//      TOAST-stored and would bloat the JSON response.
//   2. `hasContent` is derived at query time as an inline SQL computed column
//      (`a."contentHtml" IS NOT NULL`) — the NULL check reads only the main
//      tuple (no TOAST detoast), so invariant 1 holds and there is a single
//      source of truth without an extra round trip.
//
// Perf iteration (2026-06-10): list queries are single `$queryRaw` statements
// (camelCase quoted identifiers, same convention as `upsertArticle`).
// `findArticles` carries `COUNT(*) OVER()::int` so items+total cost one
// round trip; the separate-count path only runs as a rare fallback when an
// out-of-range page returns zero rows.

import type { Prisma } from '@prisma/client'
import type {
  ArticleDTO,
  ArticleDetailDTO,
  CountryPreviewArticleDTO,
  TopicSlug
} from '~/types/dto'
import { prisma } from '../prisma'

interface FindArticlesParams {
  country: string
  topic: TopicSlug
  page: number
  pageSize: number
}

interface FindArticlesResult {
  items: ArticleDTO[]
  total: number
}

// Row shape of the single-query article list (raw SQL, flattened join).
// `contentHtml` is never selected — only the inline NULL-check result.
type ArticleListRawRow = {
  id: string
  title: string
  summary: string | null
  link: string
  imageUrl: string | null
  publishedAt: Date
  hasContent: boolean
  sourceId: number
  sourceName: string
  sourceCountryCode: string
  sourceTopicSlug: string
}

// findArticles rows additionally carry the windowed total.
type ArticleListRawRowWithTotal = ArticleListRawRow & { total: number }

function toArticleDTO(row: ArticleListRawRow): ArticleDTO {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? null,
    link: row.link,
    imageUrl: row.imageUrl ?? null,
    publishedAt: row.publishedAt.toISOString(),
    hasContent: row.hasContent,
    source: {
      id: row.sourceId,
      name: row.sourceName,
      countryCode: row.sourceCountryCode,
      topicSlug: row.sourceTopicSlug as TopicSlug
    }
  }
}

/**
 * Paginated (country, topic) list — single round trip.
 * `COUNT(*) OVER()::int` rides along on every row so no separate count query
 * is needed. Edge case: an out-of-range page (> 1) returns zero rows and
 * therefore no window total — only then do we fall back to a count query.
 */
export async function findArticles(
  params: FindArticlesParams
): Promise<FindArticlesResult> {
  const { country, topic, page, pageSize } = params

  const rows = await prisma.$queryRaw<ArticleListRawRowWithTotal[]>`
    SELECT a."id", a."title", a."summary", a."link", a."imageUrl", a."publishedAt",
           (a."contentHtml" IS NOT NULL) AS "hasContent",
           s."id"          AS "sourceId",
           s."name"        AS "sourceName",
           s."countryCode" AS "sourceCountryCode",
           s."topicSlug"   AS "sourceTopicSlug",
           COUNT(*) OVER()::int AS "total"
    FROM   "Article" a
    JOIN   "Source"  s ON s."id" = a."sourceId"
    WHERE  s."countryCode" = ${country}
      AND  s."topicSlug"   = ${topic}
      AND  s."enabled"
    ORDER  BY a."publishedAt" DESC
    LIMIT  ${pageSize} OFFSET ${(page - 1) * pageSize}
  `

  if (rows.length === 0 && page > 1) {
    // Out-of-range page: the window total never materialized — rare fallback.
    const where: Prisma.ArticleWhereInput = {
      source: { countryCode: country, topicSlug: topic, enabled: true }
    }
    const total = await prisma.article.count({ where })
    return { total, items: [] }
  }

  return {
    total: rows[0]?.total ?? 0,
    items: rows.map(toArticleDTO)
  }
}

/**
 * Latest-N across every enabled source (home featured strip).
 * Single round trip — `hasContent` computed inline (invariant 1 holds:
 * the NULL check never reads the TOAST body).
 */
export async function findLatestAcrossSources(
  take: number
): Promise<ArticleDTO[]> {
  const rows = await prisma.$queryRaw<ArticleListRawRow[]>`
    SELECT a."id", a."title", a."summary", a."link", a."imageUrl", a."publishedAt",
           (a."contentHtml" IS NOT NULL) AS "hasContent",
           s."id"          AS "sourceId",
           s."name"        AS "sourceName",
           s."countryCode" AS "sourceCountryCode",
           s."topicSlug"   AS "sourceTopicSlug"
    FROM   "Article" a
    JOIN   "Source"  s ON s."id" = a."sourceId"
    WHERE  s."enabled"
    ORDER  BY a."publishedAt" DESC
    LIMIT  ${take}
  `
  return rows.map(toArticleDTO)
}

// Lean row for the hover-preview query — no summary/link/imageUrl.
type CountryPreviewRawRow = {
  id: string
  title: string
  publishedAt: Date
  hasContent: boolean
  sourceName: string
  topicSlug: string
}

/**
 * Latest-N for one country across all topics (hover preview popover).
 * Lean select — no summary/link/imageUrl, never contentHtml (invariant 1).
 * Single round trip; `hasContent` computed inline.
 */
export async function findRecentByCountry(
  country: string,
  limit: number
): Promise<CountryPreviewArticleDTO[]> {
  const rows = await prisma.$queryRaw<CountryPreviewRawRow[]>`
    SELECT a."id", a."title", a."publishedAt",
           (a."contentHtml" IS NOT NULL) AS "hasContent",
           s."name"      AS "sourceName",
           s."topicSlug" AS "topicSlug"
    FROM   "Article" a
    JOIN   "Source"  s ON s."id" = a."sourceId"
    WHERE  s."countryCode" = ${country}
      AND  s."enabled"
    ORDER  BY a."publishedAt" DESC
    LIMIT  ${limit}
  `

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    topicSlug: r.topicSlug as TopicSlug,
    sourceName: r.sourceName,
    publishedAt: r.publishedAt.toISOString(),
    hasContent: r.hasContent
  }))
}

/**
 * Single-article detail. Returns null when the row is missing OR its
 * `contentHtml` is null (the detail page has nothing to render in that
 * case — the caller 404s and the UI falls back to the external link).
 */
export async function findArticleById(
  id: string
): Promise<ArticleDetailDTO | null> {
  const row = await prisma.article.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      summary: true,
      link: true,
      imageUrl: true,
      publishedAt: true,
      contentHtml: true,
      source: {
        select: { id: true, name: true, countryCode: true, topicSlug: true }
      }
    }
  })

  if (!row || !row.contentHtml) return null

  return {
    id: row.id,
    title: row.title,
    summary: row.summary ?? null,
    link: row.link,
    imageUrl: row.imageUrl ?? null,
    publishedAt: row.publishedAt.toISOString(),
    contentHtml: row.contentHtml,
    source: {
      id: row.source.id,
      name: row.source.name,
      countryCode: row.source.countryCode,
      topicSlug: row.source.topicSlug as TopicSlug
    }
  }
}

export interface UpsertArticleInput {
  id: string // sha256(link)
  sourceId: number
  title: string
  summary: string | null
  link: string
  imageUrl: string | null
  publishedAt: Date
  contentHtml: string | null
}

export interface UpsertArticleResult {
  kind: 'inserted' | 'updated'
}

/**
 * Upsert by primary key (sha256(link)). Returns whether the row existed
 * before the write so the caller can accumulate insert/update counts.
 *
 * Single round-trip: the `pre` CTE captures pre-upsert existence, `ups`
 * does the INSERT … ON CONFLICT DO UPDATE, and the outer SELECT derives
 * the insert-vs-update flag — all in one query.
 */
export async function upsertArticle(
  input: UpsertArticleInput
): Promise<UpsertArticleResult> {
  const rows = await prisma.$queryRaw<Array<{ inserted: boolean }>>`
    WITH pre AS (
      SELECT id FROM "Article" WHERE id = ${input.id}
    ),
    ups AS (
      INSERT INTO "Article" (
        "id", "sourceId", "title", "summary", "link",
        "imageUrl", "publishedAt", "contentHtml"
      ) VALUES (
        ${input.id},
        ${input.sourceId},
        ${input.title},
        ${input.summary},
        ${input.link},
        ${input.imageUrl},
        ${input.publishedAt},
        ${input.contentHtml}
      )
      ON CONFLICT ("id") DO UPDATE SET
        "title"       = EXCLUDED."title",
        "summary"     = EXCLUDED."summary",
        "imageUrl"    = EXCLUDED."imageUrl",
        "publishedAt" = EXCLUDED."publishedAt",
        "contentHtml" = EXCLUDED."contentHtml"
      RETURNING "id"
    )
    SELECT (pre.id IS NULL)::boolean AS inserted
    FROM ups
    LEFT JOIN pre ON true
  `
  return { kind: rows[0]?.inserted ? 'inserted' : 'updated' }
}

/**
 * Delete articles with publishedAt strictly older than the cutoff.
 * Returns the number of rows deleted.
 */
export async function pruneOlderThan(days: number): Promise<{
  deleted: number
  cutoff: Date
}> {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const result = await prisma.article.deleteMany({
    where: { publishedAt: { lt: cutoff } }
  })
  return { deleted: result.count, cutoff }
}
