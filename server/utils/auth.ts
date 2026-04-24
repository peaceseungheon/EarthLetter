// server/utils/auth.ts
//
// Bearer auth for ingestion/prune endpoints. Timing-safe compare against
// runtimeConfig.ingestSecret (server-only). See architecture § 11.1.
//
// Two paths, one secret (architecture § 5):
// - GH Actions → bearer header → requireIngestSecret
// - Browser admin → `el_admin` cookie → requireAdminSession

import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import { createError, getCookie, getRequestHeader, type H3Event } from 'h3'
import { useRuntimeConfig } from '#imports'

export const ADMIN_COOKIE_NAME = 'el_admin'

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

/**
 * Assert the incoming request carries a matching bearer token. Throws a
 * Nitro-compatible 401 otherwise. Only the configured `INGEST_SECRET` is
 * read here; callers must never touch `process.env` directly.
 */
export function requireIngestSecret(event: H3Event): void {
  const config = useRuntimeConfig(event)
  const expected = config.ingestSecret as string

  if (!expected || expected.length < 8) {
    // Guard against a misconfigured server accepting every request.
    throw createError({
      statusCode: 500,
      statusMessage: 'INTERNAL_ERROR',
      data: {
        statusCode: 500,
        statusMessage: 'INTERNAL_ERROR',
        message: 'Server auth is not configured.'
      }
    })
  }

  const header = getRequestHeader(event, 'authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  const token = match?.[1] ?? ''

  if (!token || !safeEqual(token, expected)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'UNAUTHORIZED',
      data: {
        statusCode: 401,
        statusMessage: 'UNAUTHORIZED',
        message: 'Missing or invalid bearer token.'
      }
    })
  }
}

/**
 * Assert the request carries a valid admin session cookie. The cookie value
 * must match the configured `INGEST_SECRET` byte-for-byte. Used by the admin
 * dashboard endpoints under `/api/admin/**`.
 *
 * Rejects with 500 when the server is misconfigured (empty/short secret) so a
 * missing env var never silently admits everyone.
 */
export function requireAdminSession(event: H3Event): void {
  const config = useRuntimeConfig(event)
  const expected = config.ingestSecret as string

  if (!expected || expected.length < 8) {
    throw createError({
      statusCode: 500,
      statusMessage: 'INTERNAL_ERROR',
      data: {
        statusCode: 500,
        statusMessage: 'INTERNAL_ERROR',
        message: 'Server auth is not configured.'
      }
    })
  }

  const cookie = getCookie(event, ADMIN_COOKIE_NAME) ?? ''

  if (!cookie || !safeEqual(cookie, expected)) {
    throw createError({
      statusCode: 401,
      statusMessage: 'UNAUTHORIZED',
      data: {
        statusCode: 401,
        statusMessage: 'UNAUTHORIZED',
        message: 'Admin session required.'
      }
    })
  }
}

/**
 * Shared timing-safe string compare. Exported so admin session issuance can
 * validate the candidate token using the same routine before setting the
 * cookie.
 */
export function timingSafeCompare(a: string, b: string): boolean {
  return safeEqual(a, b)
}
