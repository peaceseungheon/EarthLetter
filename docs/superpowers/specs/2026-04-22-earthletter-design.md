# EarthLetter — Design Spec

**Date:** 2026-04-22
**Status:** Approved (pending spec-review)
**Audience target:** English-speaking readers
**Monetization goal:** Display-ad revenue (AdSense / Ezoic-ready)

---

## 1. Product Summary

EarthLetter is a Nuxt 3 SSR web app where users click a country on a world
map and read curated English-language news for three geopolitical topics:

- **Military / Security**
- **Economy**
- **Politics**

News is ingested from a curated list of RSS feeds (one per country × topic).
The site renders server-side for SEO and is designed to slot display ads
into content pages once AdSense approval is granted.

The MVP ships with ~10 launch countries and is architected so that new
countries expand via a seed file, not a code change.

---

## 2. Scope

### In scope (MVP)

1. Interactive world map (SVG, country-level click targets).
2. Country detail pages showing the 3 topic sections.
3. Per-(country, topic) article list page with pagination (SEO primary).
4. Hourly RSS ingestion via GitHub Actions cron → Nitro endpoint.
5. Source-curated topic classification (no NLP/LLM in MVP).
6. Responsive layout + dark mode.
7. SEO foundations: SSR, sitemap, robots, JSON-LD, OG/Twitter tags.
8. Ad-slot placeholders (AdSense script injected via env var; disabled until approval).
9. About / Privacy / Terms pages (required for AdSense approval).

### Out of scope (v1)

- User authentication, bookmarks, newsletter subscriptions.
- Full-text article search.
- Per-country AI summaries or translation.
- User comments, ratings, or social sharing auth.
- i18n beyond English.
- Real-time updates (WebSocket/SSE) — hourly cron is sufficient.

---

## 3. High-Level Architecture

```
[GitHub Actions cron]  ──POST──►  [Nitro /api/ingest]
  (hourly)                              │
                                        ▼
                        [RSS fetch → dedup → upsert]
                                        │
                                        ▼
                               [Supabase Postgres]
                                        ▲
                                        │
[Browser] ──SSR HTML──► [Nuxt pages]
                                        └─ AdSlot.vue (env-gated script)
```

- **Framework:** Nuxt 3, TypeScript, SSR mode.
- **Hosting:** Vercel (Node runtime).
- **Database:** Supabase Postgres (via Prisma).
- **Scheduler:** GitHub Actions `schedule` → authenticated POST to Nitro.
- **No public write endpoints.** Ingestion is secret-gated.

---

## 4. Data Model (Prisma)

```prisma
model Country {
  code     String    @id   // ISO-3166 alpha-2: "US", "KR", ...
  nameEn   String
  nameKo   String?
  sources  Source[]
}

model Topic {
  slug     String    @id   // "military", "economy", "politics"
  label    String
  sources  Source[]
}

model Source {
  id           Int       @id @default(autoincrement())
  countryCode  String
  topicSlug    String
  name         String                // e.g. "Defense News"
  feedUrl      String    @unique
  enabled      Boolean   @default(true)
  country      Country   @relation(fields: [countryCode], references: [code])
  topic        Topic     @relation(fields: [topicSlug], references: [slug])
  articles     Article[]

  @@index([countryCode, topicSlug])
}

model Article {
  id           String    @id          // sha256(link)
  sourceId     Int
  title        String
  summary      String?
  link         String    @unique
  imageUrl     String?
  publishedAt  DateTime
  fetchedAt    DateTime  @default(now())
  source       Source    @relation(fields: [sourceId], references: [id])

  @@index([sourceId, publishedAt(sort: Desc)])
}
```

### Seed content (MVP launch set)

- **Countries (10):** US, UK, China, Russia, Japan, South Korea, Germany,
  France, Israel, India.
- **Topics (3):** `military`, `economy`, `politics`.
- **Sources:** 2–3 curated English-language RSS feeds per (country × topic)
  cell where available. The seed file lives at `prisma/seed.ts` and is the
  source of truth for coverage. Missing cells are acceptable — the UI
  shows an "no feeds yet" empty state.

### Retention

Articles older than 90 days are pruned by a daily GitHub Actions job
(`POST /api/prune`). Justification: keeps DB size bounded within the
Supabase free tier; geopolitical news loses relevance quickly.

---

## 5. Ingestion Pipeline

### Trigger

- GitHub Actions workflow `.github/workflows/ingest.yml`
- Schedule: `0 * * * *` (hourly, UTC).
- Manual trigger: `workflow_dispatch`.

### Endpoint: `POST /api/ingest`

- **Auth:** `Authorization: Bearer ${INGEST_SECRET}` — rejects otherwise (401).
- **Behavior:**
  1. `Source.findMany({ where: { enabled: true } })`.
  2. For each source (concurrency 10, `p-limit`):
     - `fetch(feedUrl)` with 10s timeout.
     - Parse via `rss-parser`.
     - Build `Article` rows: `id = sha256(link)`.
     - `prisma.article.upsert({ where: { id } })` for each item.
  3. Per-source failures are caught and logged; they do not abort the run.
  4. Respond with `{ fetched, inserted, updated, failedSources: [{id, error}] }`.
- **Idempotent:** re-running the same hour is safe (upsert by link hash).

### Failure auto-disable (deferred, noted for v1.1)

If a source fails N consecutive runs, flag `enabled=false`. Not in MVP.

---

## 6. Frontend

### Routes

| Path | Purpose |
|------|---------|
| `/` | World map; click country → `/country/[code]`. Featured articles strip. |
| `/country/[code]` | Country overview; 3 topic sections (latest N each). |
| `/country/[code]/[topic]` | Paginated article list for one (country, topic). **Primary SEO surface.** |
| `/about` | Site mission — required for AdSense. |
| `/privacy` | Privacy policy — required. |
| `/terms` | Terms of use — required. |

### Components

| Component | Responsibility |
|-----------|----------------|
| `WorldMap.vue` | Renders `world-atlas@2` TopoJSON via `d3-geo` as SVG. Emits `country-click`. Hover tooltip. |
| `ArticleCard.vue` | Thumbnail, title, source name, relative time. |
| `AdSlot.vue` | `<div data-ad-slot="...">`; injects AdSense `<script>` only when `runtimeConfig.public.adsenseClient` is set. |
| `TopicTabs.vue` | Military / Economy / Politics tabs. |
| `CountryHeader.vue` | Flag, country name, source count. |
| `ThemeToggle.vue` | Light/dark toggle via `@nuxt/color-mode`. |
| `EmptyState.vue` | Shown when no feeds for (country, topic). |
| `CountrySelector.vue` | Searchable dropdown of countries; accessibility + fallback for small map targets. |

### State (Pinia)

- `useCountriesStore` — cached country list.
- `useArticlesStore` — cached current (country, topic) page.

### Data fetching

- `useFetch('/api/articles', { query, key })` for SSR hydration.
- Pages are cached with route-based Nitro cache rules:
  `routeRules = { '/country/**': { swr: 600 } }` (10-minute stale-while-revalidate).

### Map interaction contract

- `WorldMap.vue` consumes `Country[]` (code → has-sources boolean).
- Countries without any enabled source render dimmer and are not clickable.
- Click emits `{ code: 'US' }` → router navigates to `/country/US`.

---

## 7. API Contract

| Method | Path | Query / Body | Response |
|--------|------|--------------|----------|
| GET | `/api/countries` | — | `{ items: Array<{code, nameEn, hasSources}> }` |
| GET | `/api/articles` | `country`, `topic`, `page?=1`, `pageSize?=20` | `{ items: Article[], total: number, page: number }` |
| GET | `/api/home` | — | `{ featured: Article[] }` (latest across all sources, max 12) |
| POST | `/api/ingest` | header: `Authorization: Bearer $INGEST_SECRET` | `{ fetched, inserted, updated, failedSources: Array<{id, error}> }` |
| POST | `/api/prune` | header: `Authorization: Bearer $INGEST_SECRET` | `{ deleted: number }` |

### DTO shapes (serialized to frontend)

```ts
type ArticleDTO = {
  id: string;
  title: string;
  summary: string | null;
  link: string;
  imageUrl: string | null;
  publishedAt: string;   // ISO
  source: { id: number; name: string; countryCode: string; topicSlug: string };
};
```

Frontend types must match this exactly — QA verifies.

---

## 8. Ads & SEO

### Ad placement

On article-list and country pages only (not home, not legal pages):

- Leaderboard slot directly under the page header.
- In-feed slot after every 5 articles.
- Sidebar (desktop ≥ lg): sticky slot near the top of the rail.

All slots render as empty `<div>` unless `NUXT_PUBLIC_ADSENSE_CLIENT` env
var is present. When present, `AdSlot.vue` injects the AdSense script
and ins tag with the configured client and slot IDs.

### SEO

- SSR across all content routes; no client-only rendering for article lists.
- `@nuxtjs/sitemap` auto-generates sitemap including every (country, topic).
- `@nuxtjs/robots` emits `robots.txt` allowing indexing.
- `useSeoMeta` on every page with OG/Twitter tags.
- JSON-LD `CollectionPage` on list pages; `ItemList` of article URLs.
- Canonical URLs set per page.

### AdSense approval prerequisites

- `/about`, `/privacy`, `/terms` must exist with real copy before submission.
- Domain must be on HTTPS (Vercel default).
- Minimum content volume — addressed by seeding 10 countries × 3 topics.

---

## 9. Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Nuxt 3 (SSR) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Theming | `@nuxt/color-mode` |
| State | Pinia |
| ORM / DB | Prisma + Supabase Postgres |
| RSS | `rss-parser` |
| Map | `d3-geo` + `world-atlas@2` TopoJSON |
| Concurrency | `p-limit` |
| SEO modules | `@nuxtjs/sitemap`, `@nuxtjs/robots` |
| Unit tests | Vitest |
| E2E tests | Playwright |
| CI | GitHub Actions (build/test + ingest + prune) |
| Deploy | Vercel |

---

## 10. Operations

### Secrets (Vercel + GitHub)

- `DATABASE_URL` — Supabase Postgres (pooler) connection string.
- `DIRECT_URL` — Supabase direct connection (for Prisma migrate).
- `INGEST_SECRET` — shared secret between GH Actions and Nitro.
- `NUXT_PUBLIC_ADSENSE_CLIENT` — set only after AdSense approval.
- `SITE_URL` — canonical base URL for sitemap/OG.

### GitHub Actions

- `ci.yml` — PR: typecheck, lint, unit tests, Playwright.
- `ingest.yml` — hourly; POSTs to `${SITE_URL}/api/ingest` with bearer.
- `prune.yml` — daily at 03:00 UTC; POSTs to `/api/prune`.

### Monitoring (MVP-minimal)

- Vercel logs for errors.
- GitHub Actions run history for ingestion failures.
- No external APM in MVP.

---

## 11. Testing Strategy

- **Unit (Vitest):** RSS parsing, dedup hashing, topic/country validators,
  pagination math, `AdSlot` env-gating logic.
- **API integration (Vitest + Prisma test DB):** `/api/articles`,
  `/api/countries`, `/api/ingest` happy + auth-fail + partial-failure paths.
- **E2E (Playwright):** home → map click → country → topic → article link.
  Dark mode toggle. Ad slot renders empty without env; renders script with env.
- **SEO smoke:** snapshot that SSR HTML contains article titles (not JS-rendered).

---

## 12. Risks & Open Questions

| Risk | Mitigation |
|------|-----------|
| RSS feeds disappear or change URL | Per-source error isolation; manual re-curation via seed update. |
| AdSense rejection due to thin content | Seed articles pre-launch; ensure About/Privacy/Terms are substantive. |
| Map click targets tiny (Pacific islands) | Add a searchable country dropdown alongside the map. |
| Supabase free-tier row limit | 90-day retention prune (§ 4). Monitor; upgrade if ceiling reached. |
| Legal: copyright of scraped headlines/summaries | Store only title + RSS-provided summary + link. Never store full article body. |

---

## 13. Non-Goals (Explicit)

- We do not translate, summarize with LLMs, or editorialize.
- We do not host full article text — always outbound link to source.
- We do not collect user data in MVP (no cookies beyond theme preference).
- We do not build a CMS — curation happens via Prisma seed + PRs.
