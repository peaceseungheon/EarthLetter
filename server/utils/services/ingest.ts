// server/utils/services/ingest.ts
//
// Orchestrates the hourly ingestion run: enumerate enabled sources, fetch each
// feed in parallel (bounded), dedupe-by-link, upsert, and return aggregate
// counts shaped as IngestResponseDTO.

import type { IngestFailure, IngestResponseDTO } from '~/types/dto'
import { sha256 } from '../hash'
import { fetchFeed, parallel } from '../rss'
import {
  upsertArticle,
  type UpsertArticleInput
} from '../repositories/articles'
import { listEnabledSources } from '../repositories/sources'

const FETCH_CONCURRENCY = 10

export async function runIngestion(): Promise<IngestResponseDTO> {
  const startedAt = Date.now()

  const sources = await listEnabledSources()

  let fetched = 0
  let inserted = 0
  let updated = 0
  const failedSources: IngestFailure[] = []

  const results = await parallel(FETCH_CONCURRENCY, sources, async (source) => {
    try {
      const feed = await fetchFeed(source.feedUrl)
      fetched += 1

      // Per-item upsert — a single bad row shouldn't drop the whole feed.
      let sourceInserted = 0
      let sourceUpdated = 0
      for (const item of feed.items) {
        const link = item.link.trim()
        if (!link) continue

        const input: UpsertArticleInput = {
          id: sha256(link),
          sourceId: source.id,
          title: item.title,
          summary: item.contentSnippet,
          link,
          imageUrl: item.enclosureUrl,
          publishedAt: item.publishedAt
        }

        try {
          const res = await upsertArticle(input)
          if (res.kind === 'inserted') sourceInserted += 1
          else sourceUpdated += 1
        } catch {
          // Ignore single-item DB write failures; they self-heal next run.
        }
      }

      return { sourceInserted, sourceUpdated }
    } catch (err: unknown) {
      failedSources.push({
        sourceId: source.id,
        feedUrl: source.feedUrl,
        error: err instanceof Error ? err.message : 'fetch failed'
      })
      return null
    }
  })

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      inserted += r.value.sourceInserted
      updated += r.value.sourceUpdated
    }
  }

  return {
    fetched,
    inserted,
    updated,
    failedSources,
    durationMs: Date.now() - startedAt
  }
}
