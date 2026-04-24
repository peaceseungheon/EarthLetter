// server/api/admin/session/logout.post.ts
//
// Clear the admin session cookie. Idempotent — returns { ok: true } even if
// no cookie was present. Not auth-gated on purpose: logging out is safe for
// anyone to request.

import { defineEventHandler, deleteCookie } from 'h3'
import { ADMIN_COOKIE_NAME } from '../../../utils/auth'

export default defineEventHandler((event) => {
  deleteCookie(event, ADMIN_COOKIE_NAME, { path: '/', httpOnly: true, secure: true, sameSite: 'strict' })
  return { ok: true as const }
})
