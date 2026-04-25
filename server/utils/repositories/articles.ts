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
//   2. `hasContent` is derived at query time via a second PK-IN query rather
//      than a denormalized column, so there's a single source of truth.

import type { Prisma } from '@prisma/client'
import type { ArticleDTO, ArticleDetailDTO, TopicSlug } from '~/types/dto'
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

// Shape returned by our lean list-query `select` — excludes contentHtml.
type ArticleListRow = {
  id: string
  title: string
  summary: string | null
  link: string
  imageUrl: string | null
  publishedAt: Date
  source: {
    id: number
    name: string
    countryCode: string
    topicSlug: string
  }
}

function toArticleDTO(a: ArticleListRow, hasContent: boolean): ArticleDTO {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary ?? null,
    link: a.link,
    imageUrl: a.imageUrl ?? null,
    publishedAt: a.publishedAt.toISOString(),
    hasContent,
    source: {
      id: a.source.id,
      name: a.source.name,
      countryCode: a.source.countryCode,
      topicSlug: a.source.topicSlug as TopicSlug
    }
  }
}

const LIST_SELECT = {
  id: true,
  title: true,
  summary: true,
  link: true,
  imageUrl: true,
  publishedAt: true,
  source: {
    select: { id: true, name: true, countryCode: true, topicSlug: true }
  }
} satisfies Prisma.ArticleSelect

/**
 * Resolve `hasContent` for a batch of article ids with one narrow PK-IN query.
 * Returns the set of ids whose `contentHtml` is non-null.
 */
async function resolveHasContentSet(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const rows = await prisma.article.findMany({
    where: { id: { in: ids }, contentHtml: { not: null } },
    select: { id: true }
  })
  return new Set(rows.map((r) => r.id))
}

export async function findArticles(
  params: FindArticlesParams
): Promise<FindArticlesResult> {
  const { country, topic, page, pageSize } = params
  const where: Prisma.ArticleWhereInput = {
    source: { countryCode: country, topicSlug: topic, enabled: true }
  }

  const [total, rows] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      select: LIST_SELECT,
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])

  const hasSet = await resolveHasContentSet(rows.map((r) => r.id))

  return {
    total,
    items: rows.map((r) => toArticleDTO(r, hasSet.has(r.id)))
  }
}

/**
 * Latest-N across every enabled source (home featured strip).
 */
export async function findLatestAcrossSources(
  take: number
): Promise<ArticleDTO[]> {
  const rows = await prisma.article.findMany({
    where: { source: { enabled: true } },
    select: LIST_SELECT,
    orderBy: { publishedAt: 'desc' },
    take
  })

  const hasSet = await resolveHasContentSet(rows.map((r) => r.id))
  return rows.map((r) => toArticleDTO(r, hasSet.has(r.id)))
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
 */
export async function upsertArticle(
  input: UpsertArticleInput
): Promise<UpsertArticleResult> {
  const existing = await prisma.article.findUnique({
    where: { id: input.id },
    select: { id: true }
  })

  await prisma.article.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      sourceId: input.sourceId,
      title: input.title,
      summary: input.summary ?? null,
      link: input.link,
      imageUrl: input.imageUrl ?? null,
      publishedAt: input.publishedAt,
      contentHtml: input.contentHtml ?? null
    },
    update: {
      title: input.title,
      summary: input.summary ?? null,
      imageUrl: input.imageUrl ?? null,
      publishedAt: input.publishedAt,
      contentHtml: input.contentHtml ?? null
    }
  })

  return { kind: existing ? 'updated' : 'inserted' }
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
