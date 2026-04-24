// server/api/prune.post.ts
// Deletes Article rows older than the retention window (90 days; spec § 4).

import type { PruneResponseDTO } from '~/types/dto'
import { requireIngestSecret } from '../utils/auth'
import { pruneOlderThan } from '../utils/repositories/articles'

const RETENTION_DAYS = 90

export default defineEventHandler(async (event): Promise<PruneResponseDTO> => {
  requireIngestSecret(event)
  const { deleted, cutoff } = await pruneOlderThan(RETENTION_DAYS)
  return { deleted, cutoff: cutoff.toISOString() }
})
