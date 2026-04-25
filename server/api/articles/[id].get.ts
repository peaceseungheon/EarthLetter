// server/api/articles/[id].get.ts
// Single-article detail endpoint. Architecture § 3.1.
// Public (no-auth) read path used by SSR pages/article/[id].vue.

import {
  createError,
  defineEventHandler,
  getRouterParam,
  setResponseHeader
} from 'h3'
import type { ArticleDetailDTO } from '~/types/dto'
import { findArticleById } from '../../utils/repositories/articles'

// Article.id is sha256(link) — 64-char lowercase hex. Reject anything else
// before we hit the DB so we don't waste a round-trip on malformed ids.
const ARTICLE_ID = /^[a-f0-9]{64}$/

function bad(statusMessage: string, message: string) {
  return createError({
    statusCode: 400,
    statusMessage,
    data: { statusCode: 400, statusMessage, message }
  })
}

function notFound(message: string) {
  return createError({
    statusCode: 404,
    statusMessage: 'NOT_FOUND',
    data: { statusCode: 404, statusMessage: 'NOT_FOUND', message }
  })
}

export default defineEventHandler(async (event): Promise<ArticleDetailDTO> => {
  const id = getRouterParam(event, 'id') ?? ''
  if (!ARTICLE_ID.test(id)) {
    throw bad('BAD_REQUEST', 'Path param "id" must be a 64-char hex string.')
  }

  const article = await findArticleById(id)
  if (!article) {
    throw notFound(`Article "${id}" not found or has no stored content.`)
  }

  setResponseHeader(
    event,
    'Cache-Control',
    'public, s-maxage=600, stale-while-revalidate=3600'
  )

  return article
})
