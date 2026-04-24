// server/utils/services/ingest.ts
//
// Orchestrates the hourly ingestion run: enumerate enabled sources, fetch each
// feed in parallel (bounded), dedupe-by-link, upsert, and return aggregate
// counts shaped as IngestResponseDTO.
//
// Feature F — after each per-source attempt the pipeline updates bookkeeping
// columns (failCount / lastFailedAt / disabledAt). Bookkeeping writes are
// wrapped in their own try/catch so a transient DB error can never abort the
// whole run (architecture § 10 F-2).

import type { IngestFailure, IngestResponseDTO } from '~/types/dto'
import { sha256 } from '../hash'
import { fetchFeed, parallel } from '../rss'
import {
  upsertArticle,
  type UpsertArticleInput
} from '../repositories/articles'
import {
  listEnabledSources,
  recordSourceFailure,
  recordSourceSuccess
} from '../repositories/sources'

const FETCH_CONCURRENCY = 10

/**
 * Consecutive fetch-failure threshold after which a source is auto-disabled.
 * Source: architecture § 2.4.
 */
export const AUTO_DISABLE_THRESHOLD = 5

export async function runIngestion(): Promise<IngestResponseDTO> {
  const startedAt = Date.now()

  const sources = await listEnabledSources()

  let fetched = 0
  let inserted = 0
  let updated = 0
  let autoDisabled = 0
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

      // Feed-level success — reset the consecutive-failure counter. Wrapped
      // in an inner try/catch so a DB hiccup on the bookkeeping write can
      // never abort the enclosing parallel batch.
      try {
        await recordSourceSuccess(source.id)
      } catch {
        // Healthy ingest, unhealthy side-write — swallow.
      }

      return { sourceInserted, sourceUpdated, autoDisabledDelta: 0 }
    } catch (err: unknown) {
      failedSources.push({
        sourceId: source.id,
        feedUrl: source.feedUrl,
        error: err instanceof Error ? err.message : 'fetch failed'
      })

      // Feed-level failure — bump failCount and possibly auto-disable. Again,
      // wrapped so a DB outage during bookkeeping does not cascade.
      let autoDisabledDelta = 0
      try {
        const { autoDisabled: wasDisabled } = await recordSourceFailure(
          source.id,
          AUTO_DISABLE_THRESHOLD
        )
        if (wasDisabled) autoDisabledDelta = 1
      } catch {
        // DB-down during ingest — log? caller already has failedSources entry.
      }
      return { sourceInserted: 0, sourceUpdated: 0, autoDisabledDelta }
    }
  })

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      inserted += r.value.sourceInserted
      updated += r.value.sourceUpdated
      autoDisabled += r.value.autoDisabledDelta
    }
  }

  return {
    fetched,
    inserted,
    updated,
    failedSources,
    autoDisabled,
    durationMs: Date.now() - startedAt
  }
}
