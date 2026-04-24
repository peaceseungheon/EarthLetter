// server/api/admin/sources.post.ts
//
// POST /api/admin/sources — create a new source. Cookie-gated.

import {
  defineEventHandler,
  readBody,
  setResponseStatus
} from 'h3'
import type { AdminSourceDTO } from '~/types/dto'
import { requireAdminSession } from '../../utils/auth'
import { createSourceOrchestrated } from '../../utils/services/sourceAdmin'

export default defineEventHandler(async (event): Promise<AdminSourceDTO> => {
  requireAdminSession(event)

  const body = await readBody(event).catch(() => null)
  const created = await createSourceOrchestrated(body)
  setResponseStatus(event, 201)
  return created
})
