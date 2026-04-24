// server/api/articles.get.ts
// Paginated article list for one (country, topic). See architecture § 4.1.

import { createError, defineEventHandler, getQuery, setResponseHeader } from 'h3'
import type { ArticlesResponseDTO, TopicSlug } from '~/types/dto'
import { findArticles } from '../utils/repositories/articles'
import { countryExists } from '../utils/repositories/countries'

const TOPICS: readonly TopicSlug[] = ['military', 'economy', 'politics'] as const
const ISO_ALPHA2 = /^[A-Z]{2}$/

function parsePositiveInt(raw: unknown, fallback: number, max?: number): number {
  if (raw === undefined || raw === null || raw === '') return fallback
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) return Number.NaN
  if (max !== undefined && n > max) return Number.NaN
  return n
}

function bad(statusMessage: string, message: string) {
  return createError({
    statusCode: 400,
    statusMessage,
    data: { statusCode: 400, statusMessage, message }
  })
}

export default defineEventHandler(async (event): Promise<ArticlesResponseDTO> => {
  const query = getQuery(event)

  const country = String(query.country ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(country)) {
    throw bad('BAD_REQUEST', 'Query param "country" must be ISO-3166 alpha-2.')
  }

  const topic = String(query.topic ?? '') as TopicSlug
  if (!TOPICS.includes(topic)) {
    throw bad('BAD_REQUEST', 'Query param "topic" must be one of military|economy|politics.')
  }

  const page = parsePositiveInt(query.page, 1)
  if (Number.isNaN(page)) {
    throw bad('BAD_REQUEST', 'Query param "page" must be a positive integer.')
  }

  const pageSize = parsePositiveInt(query.pageSize, 20, 50)
  if (Number.isNaN(pageSize)) {
    throw bad('BAD_REQUEST', 'Query param "pageSize" must be between 1 and 50.')
  }

  if (!(await countryExists(country))) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NOT_FOUND',
      data: {
        statusCode: 404,
        statusMessage: 'NOT_FOUND',
        message: `Country "${country}" is not registered.`
      }
    })
  }

  const { items, total } = await findArticles({ country, topic, page, pageSize })
  const totalPages = pageSize > 0 ? Math.ceil(total / pageSize) : 0

  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')

  return { items, total, page, pageSize, totalPages }
})
