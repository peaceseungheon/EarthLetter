# EarthLetter — Architecture Blueprint (Phase 1 Output)

**Author:** architect agent
**Date:** 2026-04-21
**Source spec:** `docs/superpowers/specs/2026-04-22-earthletter-design.md`
**Status:** Ready for parallel implementation by frontend-dev + backend-dev.

This document is the single source of truth for the Phase 2 implementation.
Any deviation requires architect sign-off. DTOs in § 4 are contract-frozen —
frontend and backend may NOT drift from them without synchronized PR.

---

## 1. Directory Structure

```
EarthLetter/
├── .github/
│   └── workflows/
│       ├── ci.yml                     # PR: typecheck, lint, unit, e2e
│       ├── ingest.yml                 # hourly RSS ingestion
│       └── prune.yml                  # daily 90-day retention prune
├── .claude/                           # (existing) harness config
├── _workspace/                        # architect/dev handoff docs (this file)
│   └── 00_architecture.md
├── docs/
│   └── superpowers/specs/2026-04-22-earthletter-design.md
├── prisma/
│   ├── schema.prisma                  # models per spec § 4
│   ├── seed.ts                        # 10 countries × 3 topics × 2–3 sources
│   └── migrations/                    # created by `prisma migrate dev`
├── public/
│   ├── favicon.ico
│   ├── og-default.png                 # 1200×630 OG fallback
│   └── robots.txt                     # emitted by @nuxtjs/robots (verify override)
├── server/
│   ├── api/
│   │   ├── countries.get.ts           # GET /api/countries
│   │   ├── articles.get.ts            # GET /api/articles
│   │   ├── home.get.ts                # GET /api/home
│   │   ├── ingest.post.ts             # POST /api/ingest (bearer auth)
│   │   └── prune.post.ts              # POST /api/prune  (bearer auth)
│   ├── repositories/
│   │   ├── countryRepository.ts       # Country/Source aggregations
│   │   ├── articleRepository.ts       # paginated article queries
│   │   └── sourceRepository.ts        # ingestion-time source enumeration
│   ├── services/
│   │   ├── ingestionService.ts        # RSS fetch → parse → upsert pipeline
│   │   └── pruneService.ts            # retention cutoff deletion
│   ├── utils/
│   │   ├── prisma.ts                  # singleton PrismaClient (HMR-safe)
│   │   ├── auth.ts                    # assertBearer(event, INGEST_SECRET)
│   │   ├── hash.ts                    # sha256(link) → Article.id
│   │   ├── rss.ts                     # rss-parser wrapper + item normalizer
│   │   ├── dto.ts                     # toArticleDTO, toCountryDTO mappers
│   │   └── errors.ts                  # createApiError helpers
│   └── plugins/
│       └── prisma-shutdown.ts         # graceful disconnect on Nitro close
├── app/                               # (Nuxt 3 app dir — opt-in; see § 2.1)
│   ├── app.vue
│   └── error.vue
├── layouts/
│   ├── default.vue                    # header + nav + theme toggle + footer
│   └── legal.vue                      # narrower content width for /about /privacy /terms
├── pages/
│   ├── index.vue                      # world map + featured strip
│   ├── country/
│   │   ├── [code].vue                 # country overview (3 topic sections)
│   │   └── [code]/
│   │       └── [topic].vue            # paginated list (primary SEO surface)
│   ├── about.vue
│   ├── privacy.vue
│   └── terms.vue
├── components/
│   ├── WorldMap.vue                   # Container: d3-geo SVG, emits country-click
│   ├── WorldMapPath.vue               # Presenter: single <path> with a11y attrs
│   ├── CountrySelector.vue            # Searchable dropdown (a11y fallback for map)
│   ├── CountryHeader.vue              # flag + name + source count
│   ├── TopicTabs.vue                  # military / economy / politics
│   ├── ArticleList.vue                # Container: paginates ArticleDTO[]
│   ├── ArticleCard.vue                # Presenter: single card
│   ├── Pagination.vue                 # page controls (prev/next + numeric)
│   ├── AdSlot.vue                     # env-gated AdSense injection
│   ├── EmptyState.vue                 # no-feeds placeholder
│   ├── ThemeToggle.vue                # @nuxt/color-mode toggle
│   └── JsonLd.vue                     # renders <script type="application/ld+json">
├── composables/
│   ├── useCountries.ts                # wraps useFetch('/api/countries') + store
│   ├── useArticles.ts                 # wraps useFetch('/api/articles') w/ pagination
│   ├── useHomeFeatured.ts             # wraps useFetch('/api/home')
│   ├── useRelativeTime.ts             # publishedAt → "3 hours ago" (Intl.RelativeTimeFormat)
│   ├── useCanonical.ts                # returns canonical URL for current route
│   └── useAdsenseConfig.ts            # reads runtimeConfig.public.adsenseClient
├── stores/
│   ├── countries.ts                   # useCountriesStore (Pinia)
│   └── articles.ts                    # useArticlesStore (Pinia)
├── plugins/
│   └── adsense.client.ts              # one-time <script> injection when enabled
├── middleware/
│   └── country-guard.global.ts        # 404 for unknown ISO-2 codes
├── assets/
│   ├── css/
│   │   └── tailwind.css               # @tailwind directives + tokens
│   └── geo/
│       └── countries-110m.json        # world-atlas@2 TopoJSON (bundled, ~100KB)
├── types/
│   ├── dto.ts                         # ArticleDTO, CountryDTO, *ResponseDTO
│   └── domain.ts                      # TopicSlug union, IsoCountryCode brand
├── tests/
│   ├── unit/
│   │   ├── hash.spec.ts
│   │   ├── rss-parse.spec.ts
│   │   ├── pagination.spec.ts
│   │   ├── adslot.spec.ts
│   │   └── dto-mapper.spec.ts
│   ├── api/
│   │   ├── countries.spec.ts
│   │   ├── articles.spec.ts
│   │   └── ingest.spec.ts             # happy + 401 + partial-failure
│   └── e2e/
│       ├── navigation.spec.ts         # home → map → country → topic → link
│       ├── theme.spec.ts
│       └── ads.spec.ts                # env-off vs env-on
├── .env.example                       # all required env vars, no secrets
├── .eslintrc.cjs
├── .gitignore
├── .prettierrc
├── nuxt.config.ts                     # modules, routeRules, runtimeConfig
├── package.json
├── playwright.config.ts
├── tailwind.config.ts
├── tsconfig.json                      # extends .nuxt/tsconfig, strict: true
├── vitest.config.ts
└── README.md
```

### 1.1 Notes

- `app/` dir (not `srcDir`) is used only if Nuxt 4 defaults are adopted; for
  Nuxt 3 we keep files at project root (`pages/`, `components/`, etc.). **Decision:
  Nuxt 3 layout — do not create `app/app.vue`; use root-level `app.vue`.**
- `assets/geo/countries-110m.json` is bundled so SSR can render map paths
  without a runtime fetch. Source: `world-atlas@2` npm package (copy during
  postinstall or commit once).
- No `middleware/auth.ts` — there is no end-user auth in MVP. `country-guard`
  is the only global middleware.

---

## 2. Core Design Patterns & Justification

### 2.1 Repository pattern (server side)

**Where:** `server/repositories/*`
**Why:** Nitro route handlers should be thin. Concentrating Prisma calls
inside repositories (a) makes unit testing route handlers trivial via DI
substitution, (b) isolates schema changes from API shapes, and (c) gives a
single seam for future caching (Redis/KV) without touching routes.

**Rejected alternative:** Calling `prisma` directly from each handler —
convenient for 5 routes today but produces duplicated query logic (e.g. the
"has enabled sources" join appears in both `/api/countries` and home
featured query).

### 2.2 Service layer for pipelines

**Where:** `server/services/ingestionService.ts`, `pruneService.ts`
**Why:** Ingestion is multi-step (fetch → parse → dedup → upsert) with fan-out
concurrency. Keeping this out of the route handler lets Vitest call
`runIngestion({ fetch: mockFetch, prisma: testPrisma })` with seams.

### 2.3 Composable pattern (client side)

**Where:** `composables/use*.ts`
**Why:** Idiomatic Nuxt; auto-imported; wraps `useFetch` with correct
`key`/`watch` so hydration matches SSR. Each composable encapsulates cache
key strategy, which is how Nuxt dedupes parallel SSR calls on the same page.

### 2.4 Container / Presenter split for map + lists

**Where:**
- `WorldMap.vue` (container) + `WorldMapPath.vue` (presenter).
- `ArticleList.vue` (container: pagination state + data) + `ArticleCard.vue`
  (presenter: pure props → markup).

**Why:** The map presenter is a pure `<path>` renderer that takes
`d`, `isClickable`, `countryName` and emits `click`. This makes it testable
with a snapshot of SVG markup and keeps container free to swap d3
projections without breaking presentation.

### 2.5 Strategy pattern for ad rendering

**Where:** `components/AdSlot.vue` + `plugins/adsense.client.ts`
**Why:** Spec § 8 requires the same `<AdSlot>` call sites to render either
an empty placeholder (pre-approval) or a real AdSense `<ins>` tag
(post-approval) based on `runtimeConfig.public.adsenseClient`. Strategy
is selected once at runtime; templates don't branch everywhere.

### 2.6 Facade for SEO meta

**Where:** `composables/useCanonical.ts` + in-page `useSeoMeta()` calls
**Why:** Centralizes canonical-URL math (siteUrl + route) and gives QA a
single spot to snapshot-test meta presence.

### 2.7 DTO mapper pattern

**Where:** `server/utils/dto.ts`
**Why:** Prisma model shapes (e.g. Date objects, nullable fields as `null`
vs `undefined`) differ from what the wire protocol promises. Enforcing
`toArticleDTO(prismaArticle): ArticleDTO` at the serialization boundary
guarantees the contract in § 4 holds regardless of ORM changes.

---

## 3. Agent Work Scopes

### 3.1 frontend-dev — files to create

**Pages (5)**
- `pages/index.vue`
- `pages/country/[code].vue`
- `pages/country/[code]/[topic].vue`
- `pages/about.vue`
- `pages/privacy.vue`
- `pages/terms.vue`

**Layouts (2)**
- `layouts/default.vue`
- `layouts/legal.vue`

**Components (12)**
- `components/WorldMap.vue`
- `components/WorldMapPath.vue`
- `components/CountrySelector.vue`
- `components/CountryHeader.vue`
- `components/TopicTabs.vue`
- `components/ArticleList.vue`
- `components/ArticleCard.vue`
- `components/Pagination.vue`
- `components/AdSlot.vue`
- `components/EmptyState.vue`
- `components/ThemeToggle.vue`
- `components/JsonLd.vue`

**Composables (6)**
- `composables/useCountries.ts`
- `composables/useArticles.ts`
- `composables/useHomeFeatured.ts`
- `composables/useRelativeTime.ts`
- `composables/useCanonical.ts`
- `composables/useAdsenseConfig.ts`

**Stores (2)**
- `stores/countries.ts`
- `stores/articles.ts`

**Plugins / Middleware (2)**
- `plugins/adsense.client.ts`
- `middleware/country-guard.global.ts`

**Assets / types**
- `assets/css/tailwind.css`
- `assets/geo/countries-110m.json` (copy from `world-atlas@2`)
- `types/dto.ts` (shared — but frontend is primary consumer; backend imports same file)
- `types/domain.ts`

**Config (frontend-owned)**
- `tailwind.config.ts`
- `nuxt.config.ts` — frontend-dev writes the app/module config; backend-dev
  extends only the `nitro` and `runtimeConfig` blocks via a small patch PR.
  (Decision: single file, single owner. frontend-dev holds the pen.)

**Tests (frontend)**
- `tests/unit/adslot.spec.ts`
- `tests/unit/pagination.spec.ts`
- `tests/e2e/navigation.spec.ts`
- `tests/e2e/theme.spec.ts`
- `tests/e2e/ads.spec.ts`
- `playwright.config.ts`

### 3.2 backend-dev — files to create

**Prisma**
- `prisma/schema.prisma`
- `prisma/seed.ts`

**Server routes (5)**
- `server/api/countries.get.ts`
- `server/api/articles.get.ts`
- `server/api/home.get.ts`
- `server/api/ingest.post.ts`
- `server/api/prune.post.ts`

**Repositories (3)**
- `server/repositories/countryRepository.ts`
- `server/repositories/articleRepository.ts`
- `server/repositories/sourceRepository.ts`

**Services (2)**
- `server/services/ingestionService.ts`
- `server/services/pruneService.ts`

**Server utils (6)**
- `server/utils/prisma.ts`
- `server/utils/auth.ts`
- `server/utils/hash.ts`
- `server/utils/rss.ts`
- `server/utils/dto.ts`
- `server/utils/errors.ts`

**Plugins (server)**
- `server/plugins/prisma-shutdown.ts`

**GitHub Actions (3)**
- `.github/workflows/ci.yml`
- `.github/workflows/ingest.yml`
- `.github/workflows/prune.yml`

**Env & docs**
- `.env.example`
- `.gitignore` (minimal — node_modules, .output, .nuxt, .env*, prisma/migrations untouched)

**Tests (backend)**
- `tests/unit/hash.spec.ts`
- `tests/unit/rss-parse.spec.ts`
- `tests/unit/dto-mapper.spec.ts`
- `tests/api/countries.spec.ts`
- `tests/api/articles.spec.ts`
- `tests/api/ingest.spec.ts`
- `vitest.config.ts`

### 3.3 Shared (either agent — assign to frontend-dev)

- `types/dto.ts` — contract file; both sides import. **frontend-dev writes
  this first**, commits before backend-dev starts route handlers. Backend
  imports via path alias.
- `package.json` — frontend-dev initializes with `nuxi init`, backend-dev
  adds `prisma`, `@prisma/client`, `rss-parser`, `p-limit` in a follow-up commit.
- `tsconfig.json` — generated by `nuxi init`; both agents extend if needed.

### 3.4 Boundary rule

- frontend-dev MUST NOT touch `server/**` or `prisma/**`.
- backend-dev MUST NOT touch `pages/**`, `components/**`, `composables/**`, `stores/**`.
- Both read-only on `types/dto.ts` once merged.

---

## 4. API Contract (Frozen TypeScript DTOs)

File: `types/dto.ts`. This is the wire contract.

```ts
// types/dto.ts

export type TopicSlug = 'military' | 'economy' | 'politics';

export type IsoCountryCode = string; // ISO-3166 alpha-2; runtime validated

// ---------- Article ----------

export interface ArticleSourceDTO {
  id: number;
  name: string;
  countryCode: IsoCountryCode;
  topicSlug: TopicSlug;
}

export interface ArticleDTO {
  id: string;                 // sha256(link)
  title: string;
  summary: string | null;
  link: string;               // absolute outbound URL
  imageUrl: string | null;
  publishedAt: string;        // ISO-8601 UTC
  source: ArticleSourceDTO;
}

// ---------- Country ----------

export interface CountryDTO {
  code: IsoCountryCode;
  nameEn: string;
  nameKo: string | null;
  hasSources: boolean;        // false → map renders dimmed + non-clickable
  sourceCount: number;        // optional UX hint, always present
}

// ---------- Response envelopes ----------

export interface CountriesResponseDTO {
  items: CountryDTO[];
}

export interface ArticlesQueryDTO {
  country: IsoCountryCode;
  topic: TopicSlug;
  page?: number;              // 1-indexed; default 1
  pageSize?: number;          // default 20, max 50
}

export interface ArticlesResponseDTO {
  items: ArticleDTO[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;         // ceil(total / pageSize)
}

export interface HomeResponseDTO {
  featured: ArticleDTO[];     // max 12, newest first across all sources
}

// ---------- Write endpoints (server-only callers) ----------

export interface IngestFailure {
  sourceId: number;
  feedUrl: string;
  error: string;              // short message; no stack
}

export interface IngestResponseDTO {
  fetched: number;            // feeds successfully fetched
  inserted: number;           // new Article rows
  updated: number;            // upserts that replaced existing row
  failedSources: IngestFailure[];
  durationMs: number;
}

export interface PruneResponseDTO {
  deleted: number;
  cutoff: string;             // ISO-8601 — articles with publishedAt < cutoff removed
}

// ---------- Error envelope (all 4xx/5xx) ----------

export interface ApiErrorDTO {
  statusCode: number;
  statusMessage: string;      // short code, e.g. "UNAUTHORIZED"
  message: string;            // human-readable
}
```

### 4.1 Query validation rules (backend enforces, frontend assumes)

- `country` — must match `/^[A-Z]{2}$/` and exist in `Country` table (else 404).
- `topic` — must be one of the three `TopicSlug` literals (else 400).
- `page` — integer ≥ 1 (else 400).
- `pageSize` — integer, 1 ≤ n ≤ 50 (else 400).

### 4.2 Error response conventions

- 400 `BAD_REQUEST` — validation failure.
- 401 `UNAUTHORIZED` — ingest/prune bearer missing or wrong.
- 404 `NOT_FOUND` — unknown country code or topic.
- 500 `INTERNAL_ERROR` — unexpected; never leak stack trace.

All errors use Nitro's `createError({ statusCode, statusMessage, data })`
where `data` conforms to `ApiErrorDTO`. Frontend renders from `error.data`.

---

## 5. Rendering Strategy (per page)

| Route | Strategy | Cache/TTL | Why |
|-------|----------|-----------|-----|
| `/` | **SSR** + SWR 5 min | `swr: 300` | Featured strip changes hourly post-ingest; map is static but co-renders. SWR hides DB latency. |
| `/country/[code]` | **SSR** + SWR 10 min | `swr: 600` | Moderate dynamism (3 topic sections, latest 5 each). 10-min SWR matches spec § 6. |
| `/country/[code]/[topic]` | **SSR** + SWR 10 min | `swr: 600` | **Primary SEO surface.** Must be server-rendered for crawlers. |
| `/about` | **SSG (prerender)** | — | Static copy; render at build time. |
| `/privacy` | **SSG (prerender)** | — | Static. |
| `/terms` | **SSG (prerender)** | — | Static. |
| `/api/**` | **dynamic** | per-route | Data endpoints; no route-level cache (handlers may add `setResponseHeader` for CDN). |
| `/sitemap.xml` | **SSG-ish (regenerated via SWR)** | `swr: 3600` | Generated by `@nuxtjs/sitemap`; cheap to recompute. |
| `/robots.txt` | static | — | Emitted by `@nuxtjs/robots`. |

### 5.1 ISR note

Vercel supports ISR via Nitro `isr` routeRule. We use `swr` instead because
(a) Supabase free-tier latency (~100–300ms) is already tolerable, and (b)
SWR gives instant responses from stale cache without the background
revalidation semantics that ISR adds. **Decision: SWR, not ISR**, revisit
if we observe cold-start jank post-launch.

---

## 6. Nitro `routeRules` Draft

To be placed in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  // ... modules, runtimeConfig omitted

  routeRules: {
    // Home: SSR + short SWR.
    '/': {
      swr: 300,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=600' },
    },

    // Country pages: SSR + 10-min SWR per spec § 6.
    '/country/**': {
      swr: 600,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=600, stale-while-revalidate=1800' },
    },

    // Legal pages: fully prerendered.
    '/about':    { prerender: true },
    '/privacy':  { prerender: true },
    '/terms':    { prerender: true },

    // API: no route-level cache; handlers decide per-request.
    '/api/**': { cors: false },

    // Ingestion & prune: never cache, never indexed.
    '/api/ingest': { cors: false, robots: false },
    '/api/prune':  { cors: false, robots: false },

    // Sitemap: cheap regen.
    '/sitemap.xml': { swr: 3600 },
  },
});
```

Notes for backend-dev:
- Do NOT add `isr: true` — we chose `swr`.
- `robots: false` on write endpoints requires `@nuxtjs/robots` to honor
  per-rule flags; verify with module docs at implementation time.

---

## 7. Pinia Store Design

### 7.1 `stores/countries.ts` — `useCountriesStore`

```ts
// stores/countries.ts
import { defineStore } from 'pinia';
import type { CountryDTO } from '~/types/dto';

interface CountriesState {
  items: CountryDTO[];
  lastFetched: number | null;   // epoch ms
  loading: boolean;
  error: string | null;
}

export const useCountriesStore = defineStore('countries', {
  state: (): CountriesState => ({
    items: [],
    lastFetched: null,
    loading: false,
    error: null,
  }),

  getters: {
    byCode: (state) => (code: string) =>
      state.items.find((c) => c.code === code.toUpperCase()) ?? null,

    clickable: (state) => state.items.filter((c) => c.hasSources),

    totalSourcesCovered: (state) =>
      state.items.reduce((sum, c) => sum + c.sourceCount, 0),

    isStale: (state) => (ttlMs = 5 * 60 * 1000) =>
      state.lastFetched === null || Date.now() - state.lastFetched > ttlMs,
  },

  actions: {
    async fetchIfStale(): Promise<void> {
      if (!this.isStale()) return;
      await this.refresh();
    },

    async refresh(): Promise<void> {
      this.loading = true;
      this.error = null;
      try {
        const { data } = await useFetch<CountriesResponseDTO>(
          '/api/countries',
          { key: 'countries-all' },
        );
        this.items = data.value?.items ?? [];
        this.lastFetched = Date.now();
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to load countries';
      } finally {
        this.loading = false;
      }
    },
  },
});
```

### 7.2 `stores/articles.ts` — `useArticlesStore`

```ts
// stores/articles.ts
import { defineStore } from 'pinia';
import type { ArticleDTO, TopicSlug } from '~/types/dto';

interface ArticlesPageKey {
  country: string;
  topic: TopicSlug;
  page: number;
}

interface ArticlesState {
  // cache of page results keyed by `${country}:${topic}:${page}`
  pages: Record<string, { items: ArticleDTO[]; total: number; totalPages: number; fetchedAt: number }>;
  currentKey: string | null;
  loading: boolean;
  error: string | null;
}

export const useArticlesStore = defineStore('articles', {
  state: (): ArticlesState => ({
    pages: {},
    currentKey: null,
    loading: false,
    error: null,
  }),

  getters: {
    current: (state) => state.currentKey ? state.pages[state.currentKey] ?? null : null,

    keyFor: () => ({ country, topic, page }: ArticlesPageKey) =>
      `${country.toUpperCase()}:${topic}:${page}`,
  },

  actions: {
    async load(params: ArticlesPageKey): Promise<void> {
      const key = this.keyFor(params);
      this.currentKey = key;

      // cache hit fresh within 2 min — skip
      const hit = this.pages[key];
      if (hit && Date.now() - hit.fetchedAt < 120_000) return;

      this.loading = true;
      this.error = null;
      try {
        const { data } = await useFetch<ArticlesResponseDTO>('/api/articles', {
          query: params,
          key: `articles:${key}`,
        });
        const res = data.value;
        if (res) {
          this.pages[key] = {
            items: res.items,
            total: res.total,
            totalPages: res.totalPages,
            fetchedAt: Date.now(),
          };
        }
      } catch (e: unknown) {
        this.error = e instanceof Error ? e.message : 'Failed to load articles';
      } finally {
        this.loading = false;
      }
    },

    clear(): void {
      this.pages = {};
      this.currentKey = null;
    },
  },
});
```

### 7.3 Rationale for Pinia over plain composables

Countries are used on home (map) AND every country page (header). Pinia
gives us a single instance across the page tree with SSR hydration out of
the box (`@pinia/nuxt`). Article pages benefit from cross-page cache
(back-button returns hit cached page) without re-issuing network calls.

---

## 8. Map Rendering Strategy

### 8.1 Data pipeline

1. **Bundle** `world-atlas@2` TopoJSON at `assets/geo/countries-110m.json` (≈ 100 KB minified — acceptable).
2. In `WorldMap.vue` (container), on setup:
   - `import topo from '~/assets/geo/countries-110m.json'` — import, not fetch (SSR-friendly).
   - `feature(topo, topo.objects.countries).features` via `topojson-client` → `GeoJSON.Feature[]`.
   - `geoPath(geoNaturalEarth1().fitSize([width, height], featureCollection))` via `d3-geo`.
3. Iterate features, produce `{ code, name, d }` records.
4. Merge with `useCountriesStore.items` to attach `hasSources`.

### 8.2 SSR output

- Paths rendered as server-side SVG — no hydration needed for pixels. Client
  hydrates only click handlers.
- `<svg role="img" aria-label="World map; click a country to read news">`.
- Each country `<path>` produced by `<WorldMapPath>` presenter with:
  - `d={d}`
  - `data-code={code}`
  - `class` toggling `fill-muted` if `!hasSources`, `fill-active` otherwise.
  - `tabindex={hasSources ? 0 : -1}`
  - `role="button"`
  - `aria-label={hasSources ? `${name} — view news` : `${name} — no feeds yet`}`
  - `aria-disabled={!hasSources}`

### 8.3 Interaction

- **Mouse/Touch:** `@click` on each path → `emit('country-click', { code })`.
  Parent navigates via `useRouter().push(/country/${code})`.
- **Keyboard:** `@keydown.enter` and `@keydown.space.prevent` trigger same emit.
- **Hover tooltip:** small Vue teleport to `body` showing `name`; position
  from `MouseEvent.clientX/Y`. Hidden on mobile (`pointer: coarse` media query).
- **Touch:** tap triggers navigation; no hover. For tiny island countries,
  spec § 12 mandates `<CountrySelector>` as fallback — always visible on
  mobile, collapsed behind an "Or search for a country" disclosure on desktop.

### 8.4 Accessibility & fallback

- `<CountrySelector>` (searchable listbox per WAI-ARIA Combobox pattern)
  is always in the DOM. Screen readers don't need the SVG; selector is
  primary.
- Focus ring visible via `focus-visible` styles on `<path>`.
- `prefers-reduced-motion: reduce` → disable any hover scale transitions.

### 8.5 Projection & dimensions

- **Projection:** `geoNaturalEarth1` — good overall shape preservation, friendly.
- **ViewBox:** `0 0 960 500` fixed; responsive via `width:100%; height:auto`.
- **Dark-mode colors** supplied via CSS custom properties:
  `--map-fill-active`, `--map-fill-muted`, `--map-stroke`. Defined in
  `tailwind.css` with `@media (prefers-color-scheme: dark)` + `.dark` selector
  to match `@nuxt/color-mode`.

---

## 9. Ad Slot Contract

### 9.1 `AdSlot.vue` props

```ts
interface AdSlotProps {
  slotId: string;                              // AdSense ad unit ID, e.g. "1234567890"
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal';  // default 'auto'
  responsive?: boolean;                         // default true; sets data-full-width-responsive
  layoutKey?: string;                          // for in-feed ads; optional
  minHeightPx?: number;                        // reserve space to prevent CLS; default 90
  label?: string;                              // aria-label; default "Advertisement"
}
```

### 9.2 Render contract

```
IF runtimeConfig.public.adsenseClient IS empty OR undefined:
  Render: <div class="ad-placeholder" :style="{ minHeight: minHeightPx + 'px' }" aria-hidden="true" />
  Effect: reserves vertical space so layout pre/post-approval is identical.

IF runtimeConfig.public.adsenseClient IS a non-empty string (e.g. "ca-pub-XXXX"):
  Render:
    <ins class="adsbygoogle"
         :style="{ display: 'block', minHeight: minHeightPx + 'px' }"
         :data-ad-client="client"
         :data-ad-slot="slotId"
         :data-ad-format="format"
         :data-full-width-responsive="responsive ? 'true' : 'false'"
         aria-label="Advertisement" />
  Also: on mounted, call `(window.adsbygoogle = window.adsbygoogle || []).push({})`.
```

### 9.3 One-time script injection

`plugins/adsense.client.ts` — runs once on first client-side mount:

- Reads `runtimeConfig.public.adsenseClient`.
- If empty → no-op.
- Else → append `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}" crossorigin="anonymous">` to `<head>` idempotently (guard by `data-adsense-loaded` attribute).

### 9.4 Placement rules (per spec § 8)

- `/country/[code]`, `/country/[code]/[topic]`:
  - **Leaderboard**: `<AdSlot slot-id="..." format="horizontal" :min-height-px="90" />` directly under page header.
  - **In-feed**: after every 5th article (`ArticleList` inserts).
  - **Sidebar** (≥ `lg` only): `<AdSlot slot-id="..." format="vertical" :min-height-px="600" />` with `position: sticky; top: 80px;`.
- `/` and legal pages — **no ad slots**.

### 9.5 Testing

- `tests/unit/adslot.spec.ts` — renders placeholder when `runtimeConfig` empty; renders `<ins>` when set.
- `tests/e2e/ads.spec.ts` — two Playwright configs (`ADSENSE_CLIENT=""` and `="ca-pub-test"`) assert DOM differences.

---

## 10. SEO Implementation

### 10.1 `useSeoMeta` usage matrix

| Page | title | description | og:image | canonical |
|------|-------|-------------|----------|-----------|
| `/` | "EarthLetter — World news by country" | site tagline | `/og-default.png` | `${siteUrl}/` |
| `/country/[code]` | "{CountryName} news — military, economy, politics" | latest update timestamp | `/og-default.png` | `${siteUrl}/country/{code}` |
| `/country/[code]/[topic]` | "{CountryName} {TopicLabel} news — page {n}" | "Latest {topic} headlines from {country}" | `/og-default.png` | `${siteUrl}/country/{code}/{topic}?page={n}` |
| `/about`, `/privacy`, `/terms` | page-specific | page-specific | default | self |

### 10.2 Canonical URL

`composables/useCanonical.ts`:

```ts
export function useCanonical(pathOverride?: string) {
  const route = useRoute();
  const config = useRuntimeConfig();
  const base = (config.public.siteUrl as string).replace(/\/$/, '');
  return `${base}${pathOverride ?? route.path}`;
}
```

Paginated list pages: canonical strips `?page=1` but keeps `?page=2+` (self-canonical).

### 10.3 JSON-LD templates

**List page (`/country/[code]/[topic]`):**

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "{CountryName} {TopicLabel} news",
  "url": "{canonical}",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "url": "{article.link}", "name": "{article.title}" },
      ...
    ]
  }
}
```

**Country overview (`/country/[code]`):** `CollectionPage` with `about: Country`.
**Home (`/`):** `WebSite` with `SearchAction` omitted (no search in MVP).

Rendered via `<JsonLd :data="..." />` component which wraps
`useHead({ script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }] })`.

### 10.4 Sitemap

`@nuxtjs/sitemap` config in `nuxt.config.ts`:

```ts
sitemap: {
  siteUrl: process.env.SITE_URL,
  sources: ['/api/__sitemap__/urls'],  // dynamic URLs from DB
},
```

Backend-dev provides `server/api/__sitemap__/urls.get.ts` that returns every
`(country, topic)` combo + country overview pages. Static routes auto-discovered.

### 10.5 `robots.txt`

`@nuxtjs/robots` config:

```ts
robots: {
  allow: '/',
  disallow: ['/api/'],
  sitemap: `${process.env.SITE_URL}/sitemap.xml`,
},
```

---

## 11. Secrets & Security Matrix

| Secret | Vercel (prod) | Vercel (preview) | GH Actions | Local `.env` | Notes |
|--------|:---:|:---:|:---:|:---:|-------|
| `DATABASE_URL` | required | required (separate DB ideally) | required (for `prisma generate` in CI only) | required | Supabase pooled URL. |
| `DIRECT_URL` | optional | optional | required (for `migrate deploy`) | required | Direct DB connection for Prisma migrate. |
| `INGEST_SECRET` | required | required | required | optional | Bearer shared GH Actions ↔ Nitro. Rotate on leak. |
| `NUXT_PUBLIC_ADSENSE_CLIENT` | optional (set post-approval) | **empty** | — | optional | **Never** set in preview/CI to avoid invalid impressions. |
| `SITE_URL` | required (`https://earthletter.app` or actual) | required (`https://{preview-url}`) | required (for ingest target) | required (`http://localhost:3000`) | Used by sitemap, canonical, JSON-LD. |
| `NODE_ENV` | auto | auto | auto | auto | — |

### 11.1 Hardening rules

- `INGEST_SECRET` compared via timing-safe equality in `server/utils/auth.ts`:
  `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` after length check.
- `/api/ingest` and `/api/prune`:
  - Reject non-POST (405).
  - Reject missing/malformed `Authorization` header (401).
  - Set `X-Robots-Tag: noindex` response header.
- Prisma queries use parameterized methods (no `$queryRawUnsafe`).
- No CORS allowed on `/api/**` (Nitro default: same-origin). Map renders and
  calls fetch from SSR/same host, so no cross-origin is needed.
- RSS fetches in `ingestionService` use a 10s AbortController timeout AND
  a `maxContentLength` equivalent (truncate after 2MB).
- Store-only-summary rule (spec § 12): ingestion pipeline enforces
  `summary = rssItem.contentSnippet?.slice(0, 500) ?? null` — never body.

---

## 12. Risks & Architectural Concerns

### 12.1 From spec § 12 (reaffirmed)

- RSS feed rot → per-source try/catch; `failedSources` in response; v1.1 auto-disable.
- AdSense rejection → seed DB pre-launch; legal pages ship with real copy.
- Tiny map targets → `<CountrySelector>` always available.
- Supabase free-tier row ceiling → 90-day prune job.
- Copyright on RSS content → title + provided summary only; outbound link.

### 12.2 New risks identified during design

| # | Risk | Mitigation |
|---|------|-----------|
| A | **SSR/hydration mismatch on map**: d3's `geoPath` is deterministic, but any `Math.random`, `Date.now`, or `window`-dependent branch in `WorldMap.vue` will desync. | Forbid `window`/`Date.now` during render; put interaction logic in `onMounted`. CI snapshot test of SSR SVG output. |
| B | **TopoJSON bundle size**: `countries-110m.json` adds ~100 KB to SSR payload if naively inlined into every route. | Dynamic import `await import('~/assets/geo/countries-110m.json')` only inside `WorldMap.vue`. Non-home routes never load it. |
| C | **useFetch double-fetch on client**: if `query` object identity changes each render, Nuxt re-fires. | Always pass a stable `key` derived from `${country}:${topic}:${page}` and use `watch: []` or explicit query refs. |
| D | **Pagination drift**: backend `totalPages` computed once; if new articles arrive mid-session, page N may become out of range. | Frontend clamps `page` to `[1, totalPages]` on response; backend returns empty `items` for overshoot without 404. |
| E | **Prisma connection pool exhaustion on Vercel**: serverless cold starts + Supabase pooler can hit limits during an ingest spike. | `server/utils/prisma.ts` uses `globalThis.__prisma` singleton; ingest uses `p-limit(10)` to cap concurrent connections. |
| F | **AdSense invalid traffic from preview deploys**: if `NUXT_PUBLIC_ADSENSE_CLIENT` leaks to preview, clicks violate terms. | Vercel env var scoped to "Production" only. Documented in `.env.example`. |
| G | **ISO code mismatch between `world-atlas` (numeric IDs) and our ISO-2**: `world-atlas@2` uses ISO-3166 numeric; we store alpha-2. | `server/utils/` adds a bundled numeric→alpha-2 map, OR use `i18n-iso-countries` for conversion at build time. **Decision: backend exposes alpha-2 only; frontend map converts numeric → alpha-2 at SVG render time.** |
| H | **Route collision with Nuxt dynamic segments**: `/country/[code]/[topic]` vs `/country/[code]`: both must be explicit files in `pages/country/`. | Directory structure in § 1 is correct; double-check Nuxt resolves `[code].vue` and `[code]/[topic].vue` without collision (they don't — Nuxt treats the nested dir as child route). |
| I | **Sitemap size on growth**: 10 countries × 3 topics × ~10 pages = ~300 URLs now; scales linearly. | Fine for MVP. Revisit if ≥ 50k URLs. |
| J | **Color-mode FOUC on SSR**: `@nuxt/color-mode` sets class via cookie; first paint may flash. | Module already handles via `<ColorScheme>` + script tag injection. Accept as known limitation. |
| K | **Prerender failing on `/about` if it imports DB-touching composable**: static pages must not call `useFetch('/api/...')`. | Code review guard: legal pages import no composables that hit the DB. |

### 12.3 Spec conflicts found

**None blocking.** One clarification filed below:

- Spec § 6 says `routeRules = { '/country/**': { swr: 600 } }`. Spec § 8 also lists home page as an ad-free surface. Our routeRules (§ 6 of this doc) add `swr: 300` for `/`. This is an additive decision, not a conflict — architect marks as resolved.

---

## 13. Implementation Sequencing Hint (for orchestrator)

Phase 2 parallelization plan:

1. **Day 0 (serial):** frontend-dev commits `package.json`, `nuxt.config.ts`, `tsconfig.json`, `types/dto.ts`, `tailwind.config.ts`, `.env.example`. Backend-dev blocks.
2. **Day 1+ (parallel):**
   - frontend-dev: components + pages + stores + composables against mocked `/api/*` (MSW or Vitest `vi.stubGlobal`).
   - backend-dev: `prisma/schema.prisma`, repositories, services, routes; seed DB; workflows.
3. **Convergence:** run dev server + ingestion once; QA agent runs contract match test (Vitest asserts `ArticleDTO` shape equality between route response and `types/dto.ts`).

---

## 14. Open Questions for Human Review

- **Map projection preference:** Natural Earth vs. Equal Earth vs. Robinson? Default Natural Earth (§ 8.5); flag if user prefers Equal Earth for newer aesthetic.
- **Featured strip composition (§ 6 home):** spec says "max 12, newest first across all sources." Confirm: no topic diversity rule? Current design takes top 12 by `publishedAt` DESC only. Reasonable but may be military-heavy if that topic fires more often.
- **Sitemap frequency metadata:** `<changefreq>` per entry — set `daily` for list pages, `weekly` for country overview, `monthly` for legal. Default reasonable; confirm.

---

**End of blueprint.** Phase 2 may begin. Any ambiguity — return to architect.
