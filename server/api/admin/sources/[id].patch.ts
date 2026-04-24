// server/api/admin/sources/[id].patch.ts
//
// PATCH /api/admin/sources/:id — partial update (name or enabled only).
// feedUrl / countryCode / topicSlug are deliberately not patchable — delete
// and recreate instead (architecture § 3.1).

import { defineEventHandler, readBody } from 'h3'
import type { AdminSourceDTO } from '~/types/dto'
import { requireAdminSession } from '../../../utils/auth'
import {
  parseSourceId,
  updateSourceOrchestrated
} from '../../../utils/services/sourceAdmin'

export default defineEventHandler(async (event): Promise<AdminSourceDTO> => {
  requireAdminSession(event)

  const id = parseSourceId(event.context.params?.id)
  const body = await readBody(event).catch(() => null)

  return updateSourceOrchestrated(id, body)
})
