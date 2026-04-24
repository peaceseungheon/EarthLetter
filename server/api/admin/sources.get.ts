// server/api/admin/sources.get.ts
//
// GET /api/admin/sources — list sources with filters. Cookie-gated.

import { createError, defineEventHandler, getQuery } from 'h3'
import { isTopicSlug } from '~/types/domain'
import type {
  AdminSourcesQueryDTO,
  AdminSourcesResponseDTO
} from '~/types/dto'
import { requireAdminSession } from '../../utils/auth'
import { listAdminSources } from '../../utils/repositories/sources'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const ENABLED_VALUES = new Set(['true', 'false', 'all'])
const DISABLED_VALUES = new Set(['auto', 'manual', 'any'])

function bad(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: 'BAD_REQUEST',
    data: { statusCode: 400, statusMessage: 'BAD_REQUEST', message }
  })
}

export default defineEventHandler(
  async (event): Promise<AdminSourcesResponseDTO> => {
    requireAdminSession(event)

    const query = getQuery(event)
    const filters: AdminSourcesQueryDTO = {}

    if (query.country !== undefined && query.country !== '') {
      const code = String(query.country).toUpperCase()
      if (!ISO_ALPHA2.test(code)) {
        throw bad('Query param "country" must be ISO-3166 alpha-2.')
      }
      filters.country = code
    }

    if (query.topic !== undefined && query.topic !== '') {
      const topic = String(query.topic)
      if (!isTopicSlug(topic)) {
        throw bad('Query param "topic" must be one of military|economy|politics.')
      }
      filters.topic = topic
    }

    if (query.enabled !== undefined && query.enabled !== '') {
      const value = String(query.enabled)
      if (!ENABLED_VALUES.has(value)) {
        throw bad('Query param "enabled" must be one of true|false|all.')
      }
      filters.enabled = value as 'true' | 'false' | 'all'
    }

    if (query.disabled !== undefined && query.disabled !== '') {
      const value = String(query.disabled)
      if (!DISABLED_VALUES.has(value)) {
        throw bad('Query param "disabled" must be one of auto|manual|any.')
      }
      filters.disabled = value as 'auto' | 'manual' | 'any'
    }

    return listAdminSources(filters)
  }
)
