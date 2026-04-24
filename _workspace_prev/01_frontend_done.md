# Phase 2b — Frontend Completion Report

**Date:** 2026-04-22
**Status:** Files created. `pnpm install` and visual smoke test not yet run.

## Files created

### Pages (all use `useSiteSeo` + canonical)
- `pages/index.vue` — world map + CountrySelector fallback + featured strip
- `pages/country/[code]/index.vue` — 3 topic sections (latest 5 each, parallel fetch)
- `pages/country/[code]/[topic].vue` — paginated list (primary SEO surface) + JSON-LD
- `pages/about.vue`, `pages/privacy.vue`, `pages/terms.vue` — legal/static (prerendered via routeRules)

### Layouts
- `layouts/default.vue` — header/main/footer shell. Ads placed in pages, not layout (spec § 8).

### Components
- `WorldMap.vue` — SSR-rendered d3-geo SVG, TopoJSON async import, keyboard+click a11y, hover tooltip
- `CountrySelector.vue` — searchable dropdown fallback
- `CountryHeader.vue`, `TopicTabs.vue`, `ArticleList.vue`, `ArticleCard.vue`
- `Pagination.vue` — uses `makeUrl(n)` prop so the same component serves any list page
- `AdSlot.vue` — env-gated (`runtimeConfig.public.adsenseClient`); renders placeholder when unset
- `EmptyState.vue`, `ThemeToggle.vue`, `JsonLd.vue`, `SiteHeader.vue`, `SiteFooter.vue`

### Composables
- `useCountries.ts`, `useArticles.ts`, `useHomeFeatured.ts`
- `useRelativeTime.ts` (Intl.RelativeTimeFormat), `useCanonical.ts`, `useSiteSeo.ts`
- `useAdsenseConfig.ts` — reads `runtimeConfig.public.adsenseClient`
- `useCountryIdMap.ts` — numeric ISO → alpha-2 lookup for TopoJSON features

### Stores (Pinia)
- `stores/countries.ts` — `fetchIfStale`, `byCode`, 10-minute freshness
- `stores/articles.ts` — page-keyed cache, 2-minute freshness, `current` getter

### Infrastructure
- `plugins/adsense.client.ts` — one-time `<script>` injection when enabled
- `middleware/country-guard.global.ts` — 404 on unknown ISO-2 codes
- `nuxt.config.ts` — routeRules (SWR for /, /country/**; prerender for /about /privacy /terms), sitemap + robots modules, runtimeConfig matrix, Tailwind + color-mode

### Types (shared)
- `types/dto.ts` — contract-frozen DTOs; both client and server import from `~/types/dto`
- `types/domain.ts` — `TopicSlug`, `TOPIC_META`, `TOPIC_SLUGS`, `isTopicSlug`, `isIsoCountryCode`

## Contract adherence
- All `useFetch` generics reference `~/types/dto` types — no shape redeclaration
- `articles` store forwards `country`, `topic`, `page`, `pageSize` query params exactly as backend expects
- `publishedAt` consumed as ISO-8601 string; `useRelativeTime` wraps `Intl.RelativeTimeFormat`
- Route `pages/country/[code]/[topic].vue` uppercases `code` before validation → matches backend expectation

## Rendering strategy
- `/` — SWR 300s (map + featured strip)
- `/country/**` — SWR 600s
- `/about`, `/privacy`, `/terms` — prerendered
- Ads only on `/country/*` surfaces (§ 8); home and legal pages show no ads

## Known weak points (for QA)
1. **TopoJSON async import** — `WorldMap.vue` imports `~/assets/geo/countries-110m.json` via dynamic `import()` inside `<script setup>` top-level `await`. If the file is missing, it falls back to a dashed placeholder. QA: confirm the file exists at `assets/geo/countries-110m.json` and that the shapes render on first paint (no FOUC).
2. **`[code]/index.vue` triple fetch** — calls `/api/articles` three times in parallel (one per topic, pageSize=5). Nitro route cache should absorb this, but on cold SSR the p95 could spike. QA should measure.
3. **Hover tooltip on mobile** — suppressed via `@media (pointer: coarse)`. QA: verify on iPad/iPhone simulator that the tooltip doesn't stick.
4. **`useArticles` watch** — fires `immediate: true` which means page `[topic].vue` triggers an extra client-side fetch on hydration even when SSR already populated. Intentional (keeps store warm) but adds one redundant request per navigation.
5. **Ad layout shift** — `AdSlot` reserves `minHeightPx` (default 90) to prevent CLS. Ad networks may still render smaller; visual regression would surface this.
6. **Pagination URL builder** — receives a `makeUrl(n)` callback. If a page forgets to encode its query params, bookmarkable deep links could break. Covered only on `[topic].vue` today.

## Open items (not blocking QA)
- No skeletons on `ArticleList` during `loading=true`. EmptyState covers the error/no-data path only.
- `CountrySelector` uses native `<select>` — intentional for a11y. If design later wants a combobox, swap to a headless component.
- Theme toggle persists to `localStorage` via `@nuxt/color-mode` (`earthletter-color-mode` key, documented in privacy.vue).

## Patch — 2026-04-24 (M-1, M-2 bug fixes)

- **M-1 fixed** `components/ArticleCard.vue`: `computed` 래퍼 제거 → `useRelativeTime` 직접 호출
- **M-2 fixed** `stores/articles.ts`, `stores/countries.ts`: catch 블록에서 `e.data?.message` 우선 참조, 폴백으로 `e.message`
