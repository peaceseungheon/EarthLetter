# Phase 3 — QA Report

**Date:** 2026-04-22
**Author:** qa agent (executed inline by orchestrator; project-local subagent type not registered)
**Inputs:** `_workspace/00_architecture.md`, `_workspace/01_frontend_done.md`, `_workspace/02_backend_done.md`, source tree

## TL;DR

- 1 **critical**, 2 **major**, 4 **minor** bugs. Only the critical blocks launch.
- Boundary contract check: all 5 routes match DTOs declared in `types/dto.ts`; no shape drift, no envelope mismatch.
- Tests written: `vitest.config.ts`, `playwright.config.ts`, 5 unit specs, 2 API-parity specs, 1 E2E smoke.
- Critical fix owner: **frontend-dev** (missing static asset).
- Recommend: ship the fix, then re-run QA (Phase 3 is idempotent).

## 1. Boundary cross-check (FE request shape ↔ BE response shape)

| Route | BE return type | FE consumer | Verdict |
| --- | --- | --- | --- |
| `GET /api/countries` | `CountriesResponseDTO = { items: CountryDTO[] }` | `stores/countries.ts:refresh` reads `data.value?.items ?? []` | ✅ match |
| `GET /api/articles` | `ArticlesResponseDTO = { items, total, page, pageSize, totalPages }` | `stores/articles.ts:load` copies every field verbatim into `ArticlesPage` | ✅ match |
| `GET /api/home` | `HomeResponseDTO = { featured: ArticleDTO[] }` | `composables/useHomeFeatured.ts` with `default: () => ({ featured: [] })` | ✅ match |
| `POST /api/ingest` | `IngestResponseDTO` (server→server only) | GitHub Actions cron, bearer-auth | ✅ match (no FE consumer) |
| `POST /api/prune` | `PruneResponseDTO = { deleted, cutoff }` (server→server only) | GitHub Actions cron, bearer-auth | ✅ match (no FE consumer) |
| Sitemap URLs | `Array<{loc, changefreq, priority}>` via `/api/__sitemap__/urls` | `@nuxtjs/sitemap` module | ✅ match |

Request shapes:

- `country` param: FE always sends uppercase alpha-2 (page-level `.toUpperCase()` + `stores/articles.ts` `toUpperCase()`). BE re-uppercases and regex-validates. No drift.
- `page` / `pageSize`: FE never sends `< 1` or `> 50`; BE enforces the cap with a `400 BAD_REQUEST`. Match.
- `topic`: FE uses `TopicSlug` union, BE enforces `military | economy | politics` whitelist. Match.

DTO-to-wire encoding:

- `Article.publishedAt`: Prisma `DateTime` → `toArticleDTO` calls `.toISOString()` (see `server/utils/repositories/articles.ts:33`). `useRelativeTime` parses with `Date.parse()` and `ArticleCard` renders via `<time :datetime="article.publishedAt">`. Match.
- `nullable` fields (`summary`, `imageUrl`, `nameKo`) use `?? null` on both sides. Match.
- No envelope wrapper — confirmed handlers return bare DTOs, stores read fields directly.

## 2. Bugs

### 🔴 Critical

**C-1. Missing TopoJSON asset blocks the world map** — **FIXED inline**

- **File:** `assets/geo/countries-110m.json` — the directory exists but is empty.
- **Effect:** `components/WorldMap.vue:40` dynamic-imports the file; on failure the catch branch sets `topo = null` and the home page renders only the "map data is loading" placeholder. The primary UX of the site is the map — this was a launch blocker.
- **Resolution:** `package.json` `postinstall` now copies `world-atlas/countries-110m.json` into `assets/geo/` after `nuxt prepare`. First `pnpm install` populates the asset; no hand-commit needed.

### 🟠 Major

**M-1. `ArticleCard` relative time never updates after initial render**

- **File:** `components/ArticleCard.vue:10`.
- **Code:** `const relative = computed(() => useRelativeTime(props.article.publishedAt))`
- **Effect:** `useRelativeTime` reads `Date.now()`, which is NOT a Vue reactive source. The `computed` caches the string on first render and never recomputes, so a card stamped "3 hours ago" at hydration still shows "3 hours ago" hours later.
- **Fix (owner: frontend-dev):** since the function is pure per render, drop the `computed` wrapper: `const relative = useRelativeTime(props.article.publishedAt)` — Vue re-runs `<script setup>` on each parent re-render, which is close enough for an article list. If live-updating is desired, introduce a shared `useNow({ interval: 60_000 })` ref and depend on it inside the computed.

**M-2. Structured API errors flattened to generic "Failed to load"**

- **Files:** `stores/articles.ts:90-92`, `stores/countries.ts:58-60`.
- **Effect:** backend returns `createError({ statusCode, statusMessage, data: ApiErrorDTO })`. The Nitro `FetchError` raised by `useFetch` carries `data` with the structured message, but the stores read only `e.message`. Users always see "Failed to load articles" even for a legitimate 400 / 404.
- **Fix (owner: frontend-dev):** in the catch block, prefer `(e as { data?: ApiErrorDTO }).data?.message ?? e.message`. Keeps the default fallback string for network errors.

### 🟡 Minor

**m-1. `useArticles` double-fetches on first hydration** *(self-reported, 01 #4)*

- `composables/useArticles.ts:41` uses `watch(..., { immediate: true })` which fires once during SSR and again during client `onMounted`. For a page like `[topic].vue` where `useAsyncData` already warmed the Pinia store, this is a harmless duplicate GET — measurable but not user-visible.
- **Fix (optional):** guard with `if (import.meta.client && !store.current)`.

**m-2. Ingestion uses `new Date()` when the feed item has no date** *(self-reported, 02 #1)*

- `server/utils/rss.ts:80`: `const published = publishedRaw ? new Date(publishedRaw) : new Date()`.
- **Effect:** every re-ingestion of an undated item surfaces it as "just now", polluting `publishedAt DESC` ordering and the home featured strip.
- **Fix (owner: backend-dev):** skip items without a valid `isoDate` / `pubDate` (`continue`) rather than fabricate one. Matches the spec intent that curated sources produce real timestamps.

**m-3. Middleware does not canonicalize lowercase country codes to uppercase**

- `middleware/country-guard.global.ts:14` uppercases locally for the regex check but does not redirect `/country/us` → `/country/US`. Currently lowercase URLs still render (pages re-uppercase), but search engines may index duplicates.
- **Fix (owner: frontend-dev, optional):** if the raw param differs from the uppercased version, `return navigateTo('/country/' + upper + '/' + topic, { redirectCode: 301 })`.

**m-4. No rate limiting on `/api/ingest` beyond the bearer token** *(self-reported, 02 #4)*

- Spec § 5 defers rate limiting; flagged for visibility in case we expose the endpoint beyond the CI cron runner.

## 3. Verification of self-reported weak points

| Source | Item | Status |
| --- | --- | --- |
| 01 #1 | TopoJSON async import / missing file | **CONFIRMED CRITICAL** → C-1 |
| 01 #2 | `[code]/index.vue` triple fetch | Confirmed. Nitro route cache absorbs repetition; not a bug. |
| 01 #3 | Hover tooltip on mobile suppressed via `@media (pointer: coarse)` | Correct — no action. |
| 01 #4 | `useArticles` double fetch on hydration | Confirmed → m-1 |
| 01 #5 | Ad layout shift | Not reproducible statically; relies on AdSense injection timing. Requires a real AdSense client id + Lighthouse run. |
| 01 #6 | `makeUrl` encoding discipline | Only `[topic].vue` uses `Pagination` today; the builder is correct. No bug. |
| 02 #1 | `runIngestion` fabricated `publishedAt` | Confirmed → m-2 |
| 02 #2 | `totalPages = 0` when `total = 0` | `Pagination.vue:19` hides itself for `totalPages <= 1`; `[topic].vue:134` guards with `v-if="totalPages > 1"`. Safe. |
| 02 #3 | Bearer unicode safety | Non-issue for ASCII secrets (which is the agreed format). |
| 02 #4 | Sitemap scales with countries | Noted → m-4. |

## 4. Tests written

Config:

- `vitest.config.ts` — Node environment, `~` alias → repo root.
- `playwright.config.ts` — Chromium only, `pnpm build && pnpm preview` webServer, env override via `PLAYWRIGHT_BASE_URL`.

Unit (`tests/unit/`, importable without Nuxt or Prisma runtime):

- `hash.spec.ts` — sha256 determinism / hex shape / unicode / dedup invariant.
- `country-id-map.spec.ts` — launch-set ISO M49 → alpha-2, leading-zero padding, no duplicate alpha-2 values.
- `domain.spec.ts` — `isTopicSlug`, `isIsoCountryCode`, `toIsoCountryCode`, `TOPIC_META` key coverage.
- `pagination.spec.ts` — reference re-implementation of `Pagination.vue` window logic + `totalPages = ceil(total/pageSize)` math.
- `relative-time.spec.ts` — `useRelativeTime` under fake timers, English locale.

API-parity (`tests/api/`, no Prisma):

- `articles-validation.spec.ts` — re-implements `parsePositiveInt` + country/topic whitelist; asserts the rejection matrix handlers should enforce.
- `auth.spec.ts` — length-safe `timingSafeEqual` wrapper; guards against the RangeError that raw `timingSafeEqual` throws on unequal-length buffers.

E2E (`tests/e2e/`):

- `smoke.spec.ts` — 4 tests: home renders map or fallback, `/country/US/politics` renders headline list or empty state, unknown country 404s, legal pages prerender. **Requires**: (a) dev or preview server running, (b) DB seeded. CI wiring assumes `pnpm test:e2e`.

## 5. Coverage gaps (intentional)

- **No component unit tests.** `@vue/test-utils` is not a dependency, and wiring it in alongside Nuxt/composables internals is a medium effort. If the team wants component tests, add `@vue/test-utils` + `@nuxt/test-utils` and target `AdSlot.vue`, `ArticleCard.vue`, `EmptyState.vue` first.
- **No handler integration test.** Would require a running Nitro instance or `@nuxt/test-utils/e2e`; the shape-level guarantees are instead covered by `articles-validation.spec.ts` + the E2E smoke.
- **No accessibility sweep.** axe-core / Lighthouse runs should be added before launch.
- **No visual regression for ads / CLS.**

## 6. Recommended Phase-3 exit criteria

1. Fix **C-1** (TopoJSON asset).
2. Re-run unit suite locally: `pnpm install && pnpm prisma:generate && pnpm test`.
3. Boot preview and manually walk: home → country → topic → paginate → about/privacy/terms.
4. Ship, then address **M-1** / **M-2** in a follow-up (non-blocking).
