# Phase 2b — Backend Completion Report

**Date:** 2026-04-22
**Status:** Files created. `pnpm install` and database migration not yet run.

## Files created

### Prisma
- `prisma/schema.prisma`
- `prisma/seed.ts` (10 countries × 3 topics, curated English RSS feeds)

### Server utilities
- `server/utils/prisma.ts` — `PrismaClient` singleton
- `server/utils/hash.ts` — `sha256(str)` via node:crypto
- `server/utils/rss.ts` — `fetchFeed`, `parallel` (p-limit bounded)
- `server/utils/auth.ts` — `requireIngestSecret` with timing-safe compare
- `server/utils/repositories/articles.ts` — `findArticles`, `findLatestAcrossSources`, `upsertArticle`, `pruneOlderThan`
- `server/utils/repositories/countries.ts` — `listCountriesWithHasSources`, `countryExists`
- `server/utils/repositories/sources.ts` — `listEnabledSources`
- `server/utils/services/ingest.ts` — `runIngestion()` orchestration

### Server routes (all typed to `types/dto.ts`)
- `server/api/countries.get.ts` → `CountriesResponseDTO`
- `server/api/articles.get.ts` → `ArticlesResponseDTO` (query validation: country, topic, page, pageSize)
- `server/api/home.get.ts` → `HomeResponseDTO` (latest 12)
- `server/api/ingest.post.ts` → `IngestResponseDTO` (bearer-gated)
- `server/api/prune.post.ts` → `PruneResponseDTO` (bearer-gated, 90-day retention)
- `server/api/__sitemap__/urls.get.ts` — feeds `@nuxtjs/sitemap`

### GitHub Actions
- `.github/workflows/ci.yml` — PR/push: install → prisma:generate → typecheck → lint → unit → build → E2E
- `.github/workflows/ingest.yml` — hourly cron + manual; POSTs `/api/ingest`
- `.github/workflows/prune.yml` — daily 03:00 UTC; POSTs `/api/prune`

## DB schema key decisions
- `Article.id = sha256(link)` → idempotent upserts, natural dedup
- Composite index `(sourceId, publishedAt DESC)` for per-source queries
- Secondary index `(publishedAt DESC)` for home featured query
- `Source.feedUrl @unique` prevents duplicate feed registration within seed

## Seed RSS URLs — REVIEW flagged
Several English-language geopolitical RSS URLs were curated from publicly
advertised feeds. Before production seed-run, a human should sanity-check:
- Chinese / Russian English-language outlets (state-affiliated) — intentional
  for coverage; editorial caveat may belong in /about copy.
- Any feed returning 301/302 persistently should be updated to the final URL.

## Known weak points (for QA)
1. **`runIngestion` failure semantics** — per-source try/catch, per-item silent
   ignore on DB write failure. A degenerate feed with malformed dates still
   surfaces `publishedAt = now()` fallback from `rss.ts`. QA should confirm
   this is acceptable (can cause "new" articles that aren't actually new).
2. **Pagination boundary** — `articles.get.ts` rejects `page < 1` and
   `pageSize > 50`. `totalPages` may be 0 when `total = 0`; frontend should
   handle `page > totalPages` as empty (no redirect).
3. **Bearer timing-safe compare** assumes UTF-8 byte equality; not an issue
   for ASCII secrets but document in README if someone uses unicode.
4. **Sitemap query** runs on every sitemap cache miss — with 10 countries
   this is trivial, but scale to 50+ should move to a cached JSON blob.

## Contract adherence
All routes return exactly the shapes in `types/dto.ts`. No envelope wrapper.
`publishedAt` always serialized as ISO-8601 string (Date → `.toISOString()`).
Error responses use `createError({ statusCode, statusMessage, data })` where
`data` matches `ApiErrorDTO`.

## Open items (not blocking QA)
- `eslint.config.mjs` sitting at Day 0 default — if backend files trip it,
  we should defer to frontend-dev's config owner (architecture § 3.3).
- No rate limiting on `/api/ingest` beyond the bearer (spec § 5 defers).

## Patch — 2026-04-24 (m-2 bug fix)

- **m-2 fixed** `server/utils/rss.ts`: 날짜(`isoDate`/`pubDate`) 없는 RSS 아이템은 `continue`로 skip — `new Date()` 할당 제거
