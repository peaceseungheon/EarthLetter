// server/api/ingest.post.ts
// Bearer-gated ingestion entrypoint triggered by GitHub Actions cron.

import { createError } from 'h3'
import type { IngestResponseDTO } from '~/types/dto'
import { requireIngestSecret } from '../utils/auth'
import { runIngestion } from '../utils/services/ingest'

// 270 s leaves a 30 s buffer before the GitHub Actions curl --max-time 300
// so the server always sends a response instead of letting curl time out silently.
const BUDGET_MS = 270_000

export default defineEventHandler(async (event): Promise<IngestResponseDTO> => {
  requireIngestSecret(event)

  return Promise.race([
    runIngestion(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(
            createError({ statusCode: 504, statusMessage: 'Ingest budget exceeded' })
          ),
        BUDGET_MS
      )
    )
  ])
})
