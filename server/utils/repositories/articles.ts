// server/utils/repositories/articles.ts
//
// All Prisma access for Article rows. Route handlers never touch `prisma`
// directly — they call these functions so tests can stub at this seam.

import type { Prisma } from '@prisma/client'
import type { ArticleDTO, TopicSlug } from '~/types/dto'
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

type ArticleWithSource = Prisma.ArticleGetPayload<{
  include: { source: true }
}>

function toArticleDTO(a: ArticleWithSource): ArticleDTO {
  return {
    id: a.id,
    title: a.title,
    summary: a.summary ?? null,
    link: a.link,
    imageUrl: a.imageUrl ?? null,
    publishedAt: a.publishedAt.toISOString(),
    source: {
      id: a.source.id,
      name: a.source.name,
      countryCode: a.source.countryCode,
      topicSlug: a.source.topicSlug as TopicSlug
    }
  }
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
      include: { source: true },
      orderBy: { publishedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ])

  return {
    total,
    items: rows.map(toArticleDTO)
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
    include: { source: true },
    orderBy: { publishedAt: 'desc' },
    take
  })
  return rows.map(toArticleDTO)
}

export interface UpsertArticleInput {
  id: string // sha256(link)
  sourceId: number
  title: string
  summary: string | null
  link: string
  imageUrl: string | null
  publishedAt: Date
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
      publishedAt: input.publishedAt
    },
    update: {
      title: input.title,
      summary: input.summary ?? null,
      imageUrl: input.imageUrl ?? null,
      publishedAt: input.publishedAt
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
