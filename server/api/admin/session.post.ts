// server/api/admin/session.post.ts
//
// Admin session issuance. Body `{ token: string }` is timing-safe compared
// against `INGEST_SECRET`; on match we set the HttpOnly `el_admin` cookie
// (architecture § 5). Failed attempts are rate-limited in-memory per IP
// (architecture § 5 hardening + § 10 E-4).

import {
  createError,
  defineEventHandler,
  getRequestHeader,
  readBody,
  setCookie,
  type H3Event
} from 'h3'
import { useRuntimeConfig } from '#imports'
import { ADMIN_COOKIE_NAME, timingSafeCompare } from '../../utils/auth'

const COOKIE_MAX_AGE = 86_400 // 24h (architecture § 5 cookie spec)
const RATE_WINDOW_MS = 10 * 60 * 1000 // 10 min
const RATE_MAX_FAILURES = 5

interface RateRecord {
  firstFailure: number
  count: number
}

/**
 * In-memory failure counter keyed by client IP. Accepted trade-off for MVP
 * (architecture § 10 E-4): resets on serverless cold start. Only failed
 * attempts increment — successful logins do not consume the budget.
 */
const rateLimiter = new Map<string, RateRecord>()

function clientIp(event: H3Event): string {
  // Vercel + most reverse proxies set x-forwarded-for; fall back to x-real-ip
  // then to the raw socket address. Unknown → single bucket (accept risk).
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0]!.trim()
  }
  const real = getRequestHeader(event, 'x-real-ip')
  if (typeof real === 'string' && real.length > 0) return real
  const addr = event.node?.req?.socket?.remoteAddress
  return addr ?? 'unknown'
}

function checkRateLimit(ip: string): void {
  const now = Date.now()
  const rec = rateLimiter.get(ip)
  if (!rec) return
  if (now - rec.firstFailure > RATE_WINDOW_MS) {
    // Window expired — drop the record so the next call starts fresh.
    rateLimiter.delete(ip)
    return
  }
  if (rec.count >= RATE_MAX_FAILURES) {
    throw createError({
      statusCode: 429,
      statusMessage: 'TOO_MANY_REQUESTS',
      data: {
        statusCode: 429,
        statusMessage: 'TOO_MANY_REQUESTS',
        message: 'Too many failed attempts. Try again later.'
      }
    })
  }
}

function recordFailure(ip: string): void {
  const now = Date.now()
  const rec = rateLimiter.get(ip)
  if (!rec || now - rec.firstFailure > RATE_WINDOW_MS) {
    rateLimiter.set(ip, { firstFailure: now, count: 1 })
    return
  }
  rec.count += 1
}

export default defineEventHandler(async (event) => {
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

  const ip = clientIp(event)
  checkRateLimit(ip)

  const body = (await readBody(event).catch(() => null)) as
    | { token?: unknown }
    | null

  const token = typeof body?.token === 'string' ? body.token : ''

  if (!token || !timingSafeCompare(token, expected)) {
    recordFailure(ip)
    throw createError({
      statusCode: 401,
      statusMessage: 'UNAUTHORIZED',
      data: {
        statusCode: 401,
        statusMessage: 'UNAUTHORIZED',
        message: 'Invalid admin token.'
      }
    })
  }

  setCookie(event, ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: 'strict',
    maxAge: COOKIE_MAX_AGE,
    path: '/'
  })

  return { ok: true as const }
})
