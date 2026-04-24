// server/api/admin/sources/[id].delete.ts
//
// DELETE /api/admin/sources/:id — hard delete the source plus all its
// articles (onDelete: Cascade in schema). Returns the article count that was
// destroyed so the UI can surface a "deleted N archived articles" toast.

import { defineEventHandler } from 'h3'
import type { AdminSourceDeleteResponseDTO } from '~/types/dto'
import { requireAdminSession } from '../../../utils/auth'
import {
  deleteSourceOrchestrated,
  parseSourceId
} from '../../../utils/services/sourceAdmin'

export default defineEventHandler(
  async (event): Promise<AdminSourceDeleteResponseDTO> => {
    requireAdminSession(event)

    const id = parseSourceId(event.context.params?.id)
    return deleteSourceOrchestrated(id)
  }
)
