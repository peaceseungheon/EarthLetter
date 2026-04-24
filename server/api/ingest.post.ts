// server/api/ingest.post.ts
// Bearer-gated ingestion entrypoint triggered by GitHub Actions cron.

import type { IngestResponseDTO } from '~/types/dto'
import { requireIngestSecret } from '../utils/auth'
import { runIngestion } from '../utils/services/ingest'

export default defineEventHandler(async (event): Promise<IngestResponseDTO> => {
  requireIngestSecret(event)
  return runIngestion()
})
