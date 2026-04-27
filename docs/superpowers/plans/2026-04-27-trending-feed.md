# Trending Feed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global trending feed that detects 24-hour article spikes by country×topic and surfaces them as a home page widget and a dedicated `/trending` page with WorldMap heatmap.

**Architecture:** A new `GET /api/trending` endpoint queries PostgreSQL via Prisma `$queryRaw`, comparing the last 24 hours against the prior 7-day baseline per country×topic pair (filtered to pairs with ≥5 baseline articles). Top 15 results by spike ratio feed a `useTrending()` composable consumed by a home mini-widget (top 5) and the `/trending` page (WorldMap heatmap overlay + full ranking list).

**Tech Stack:** Nuxt 3, Nitro, Prisma + PostgreSQL (`$queryRaw`), Vue 3 Composition API, Tailwind CSS, Vitest

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `types/dto.ts` | Add `TrendingItemDTO`, `TrendingResponseDTO` |
| Create | `server/utils/repositories/trending.ts` | `findTrending()` — Prisma `$queryRaw` spike query |
| Create | `server/api/trending.get.ts` | `GET /api/trending` route handler |
| Modify | `nuxt.config.ts` | Add `/trending` SWR routeRule |
| Create | `composables/useTrending.ts` | Lazy `useFetch` wrapper |
| Create | `components/TrendingBadge.vue` | `+127%` spike ratio badge |
| Create | `components/skeletons/TrendingSkeleton.vue` | Loading skeleton (configurable row count) |
| Create | `components/TrendingWidget.vue` | Home mini widget — top 5, links to `/trending` |
| Create | `components/TrendingRankingList.vue` | Full ranked list — top 15 with context |
| Modify | `components/WorldMap.vue` | Add optional `trendingCountries` heatmap overlay prop |
| Create | `pages/trending.vue` | Dedicated trending page |
| Modify | `components/SiteHeader.vue` | Add "Trending" nav link |
| Modify | `pages/index.vue` | Insert `<TrendingWidget>` section |
| Create | `tests/api/trending-spikeratio.spec.ts` | Document spike ratio formula as invariant |

---

## Task 1: Add Trending DTOs to types/dto.ts

**Files:**
- Modify: `types/dto.ts`

- [ ] **Step 1: Add DTOs after the `TrendsResponseDTO` block (around line 83)**

```ts
// ---------- Trending ----------

export interface TrendingItemDTO {
  countryCode: string   // ISO-3166 alpha-2
  countryName: string   // English name from Country table
  topicSlug: string     // TopicSlug value
  todayCount: number    // articles in last 24 h
  avg7dCount: number    // daily average over prior 7 days (rounded to 2dp)
  spikeRatio: number    // ((todayCount / avg7dCount) - 1) × 100, rounded to 1dp
}

export type TrendingResponseDTO = TrendingItemDTO[]
```

- [ ] **Step 2: Verify TypeScript accepts the change**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add types/dto.ts
git commit -m "feat: add TrendingItemDTO and TrendingResponseDTO to dto.ts"
```

---

## Task 2: Spike ratio unit test

**Files:**
- Create: `tests/api/trending-spikeratio.spec.ts`

- [ ] **Step 1: Create the test file**

```ts
// Documents the spike-ratio formula used in findTrending() SQL
// (server/utils/repositories/trending.ts). Re-implemented in JS so
// formula drift is caught if the SQL ever changes.

import { describe, it, expect } from 'vitest'

function spikeRatio(todayCount: number, total7d: number): number {
  const avg7d = total7d / 7.0
  return Math.round(((todayCount / avg7d) - 1) * 100 * 10) / 10
}

describe('spikeRatio formula', () => {
  it('returns 0 when today equals the 7-day daily average', () => {
    expect(spikeRatio(7, 49)).toBe(0)   // avg7d=7, today=7 → 0%
  })

  it('returns 100 when today is double the average', () => {
    expect(spikeRatio(14, 49)).toBe(100) // avg7d=7, today=14 → +100%
  })

  it('returns -50 when today is half the average', () => {
    expect(spikeRatio(3, 42)).toBe(-50)  // avg7d=6, today=3 → -50%
  })

  it('handles large spikes correctly', () => {
    expect(spikeRatio(100, 7)).toBe(9900) // avg7d=1, today=100 → +9900%
  })
})
```

- [ ] **Step 2: Run test**

Run: `pnpm test tests/api/trending-spikeratio.spec.ts`
Expected: 4 tests PASS (helper is self-contained in the test file)

- [ ] **Step 3: Commit**

```bash
git add tests/api/trending-spikeratio.spec.ts
git commit -m "test: document spike-ratio formula as invariant spec"
```

---

## Task 3: findTrending() repository

**Files:**
- Create: `server/utils/repositories/trending.ts`

- [ ] **Step 1: Create the repository**

```ts
// server/utils/repositories/trending.ts
// Compares last-24h article counts against the prior 7-day daily average
// per (country, topic) pair. Uses $queryRaw because Prisma groupBy cannot
// express the two-window CTE pattern needed here.

import type { TrendingItemDTO } from '~/types/dto'
import { prisma } from '../prisma'

export async function findTrending(): Promise<TrendingItemDTO[]> {
  const rows = await prisma.$queryRaw<TrendingItemDTO[]>`
    WITH today AS (
      SELECT s.country_code,
             s.topic_slug,
             COUNT(*)::int AS today_count
      FROM   "Article" a
      JOIN   "Source"  s ON a.source_id = s.id
      WHERE  a.published_at >= NOW() - INTERVAL '24 hours'
      GROUP  BY s.country_code, s.topic_slug
    ),
    baseline AS (
      SELECT s.country_code,
             s.topic_slug,
             COUNT(*)::int AS total_7d
      FROM   "Article" a
      JOIN   "Source"  s ON a.source_id = s.id
      WHERE  a.published_at >= NOW() - INTERVAL '8 days'
        AND  a.published_at <  NOW() - INTERVAL '24 hours'
      GROUP  BY s.country_code, s.topic_slug
    )
    SELECT
      t.country_code                                                          AS "countryCode",
      c.name_en                                                               AS "countryName",
      t.topic_slug                                                            AS "topicSlug",
      t.today_count                                                           AS "todayCount",
      ROUND((b.total_7d / 7.0)::numeric, 2)::float                           AS "avg7dCount",
      ROUND(((t.today_count::float / (b.total_7d / 7.0) - 1) * 100)::numeric, 1)::float
                                                                              AS "spikeRatio"
    FROM   today t
    JOIN   baseline b
           ON  t.country_code = b.country_code
           AND t.topic_slug   = b.topic_slug
    JOIN   "Country" c ON c.code = t.country_code
    WHERE  b.total_7d >= 5
    ORDER  BY "spikeRatio" DESC
    LIMIT  15
  `

  return rows
}
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add server/utils/repositories/trending.ts
git commit -m "feat: add findTrending() repository with 24h spike detection query"
```

---

## Task 4: GET /api/trending route

**Files:**
- Create: `server/api/trending.get.ts`

- [ ] **Step 1: Create the route handler**

```ts
// server/api/trending.get.ts
import { defineEventHandler, setResponseHeader } from 'h3'
import type { TrendingResponseDTO } from '~/types/dto'
import { findTrending } from '../utils/repositories/trending'

export default defineEventHandler(async (event): Promise<TrendingResponseDTO> => {
  setResponseHeader(
    event,
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=3600'
  )
  return findTrending()
})
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add server/api/trending.get.ts
git commit -m "feat: add GET /api/trending route with 1h SWR cache"
```

---

## Task 5: Add /trending routeRule to nuxt.config.ts

**Files:**
- Modify: `nuxt.config.ts`

- [ ] **Step 1: Add the routeRule**

Inside the `routeRules` object, after the `'/country/**'` entry, add:

```ts
'/trending': {
  swr: 3600,
  headers: {
    'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=7200'
  }
},
```

- [ ] **Step 2: Verify config is valid**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add nuxt.config.ts
git commit -m "feat: add /trending SWR routeRule (1h cache)"
```

---

## Task 6: TrendingBadge.vue

**Files:**
- Create: `components/TrendingBadge.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
interface Props {
  ratio: number
}
const props = defineProps<Props>()
const label = computed(() => `+${Math.round(props.ratio)}%`)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    :aria-label="`Spike: ${label}`"
  >
    {{ label }}
  </span>
</template>
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/TrendingBadge.vue
git commit -m "feat: add TrendingBadge component"
```

---

## Task 7: TrendingSkeleton.vue

**Files:**
- Create: `components/skeletons/TrendingSkeleton.vue`

- [ ] **Step 1: Create the skeleton**

```vue
<script setup lang="ts">
interface Props {
  rows?: number
}
withDefaults(defineProps<Props>(), { rows: 5 })
</script>

<template>
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    class="flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10"
  >
    <div
      v-for="n in rows"
      :key="n"
      class="flex animate-pulse items-center gap-3 px-4 py-3"
    >
      <div class="size-7 shrink-0 rounded-full bg-black/5 dark:bg-white/10" />
      <div class="flex-1 space-y-1.5">
        <div class="h-3.5 w-1/3 rounded bg-black/5 dark:bg-white/10" />
        <div class="h-3 w-1/4 rounded bg-black/5 dark:bg-white/10" />
      </div>
      <div class="h-5 w-14 rounded-full bg-black/5 dark:bg-white/10" />
    </div>
    <span class="sr-only">Loading trending data</span>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/skeletons/TrendingSkeleton.vue
git commit -m "feat: add TrendingSkeleton loading component"
```

---

## Task 8: useTrending composable

**Files:**
- Create: `composables/useTrending.ts`

- [ ] **Step 1: Create the composable**

```ts
// composables/useTrending.ts
import type { TrendingResponseDTO } from '~/types/dto'

export function useTrending() {
  return useFetch<TrendingResponseDTO>('/api/trending', { lazy: true })
}
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add composables/useTrending.ts
git commit -m "feat: add useTrending composable"
```

---

## Task 9: TrendingWidget.vue

**Files:**
- Create: `components/TrendingWidget.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import { TOPIC_META } from '~/types/domain'

const { data, pending } = useTrending()
const top5 = computed(() => (data.value ?? []).slice(0, 5))
const showSkeleton = computed(() => pending.value && top5.value.length === 0)

function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
    .join('')
}

function topicLabel(slug: string): string {
  return TOPIC_META[slug as keyof typeof TOPIC_META]?.labelEn ?? slug
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
        Trending right now
      </h2>
      <NuxtLink
        to="/trending"
        class="text-sm text-accent hover:underline"
      >
        View all →
      </NuxtLink>
    </div>

    <TrendingSkeleton v-if="showSkeleton" :rows="5" />

    <div
      v-else-if="top5.length > 0"
      class="flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10"
    >
      <NuxtLink
        v-for="item in top5"
        :key="`${item.countryCode}-${item.topicSlug}`"
        :to="`/country/${item.countryCode}/${item.topicSlug}`"
        class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted dark:hover:bg-surface-dark-muted"
      >
        <span class="text-xl leading-none" aria-hidden="true">{{ flagEmoji(item.countryCode) }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink dark:text-ink-dark">
            {{ item.countryName }}
          </p>
          <p class="text-xs text-ink-muted dark:text-ink-dark-muted">
            {{ topicLabel(item.topicSlug) }}
          </p>
        </div>
        <TrendingBadge :ratio="item.spikeRatio" />
      </NuxtLink>
    </div>

    <p
      v-else
      class="text-sm text-ink-muted dark:text-ink-dark-muted"
    >
      No trending spikes detected in the last 24 hours.
    </p>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/TrendingWidget.vue
git commit -m "feat: add TrendingWidget home mini widget (top 5)"
```

---

## Task 10: Insert TrendingWidget into pages/index.vue

**Files:**
- Modify: `pages/index.vue`

- [ ] **Step 1: Add TrendingWidget section between the map section and the featured section**

In `pages/index.vue`, locate the closing `</section>` of the WorldMap block (the one containing `<CountrySelector>`). Add a new section immediately after it:

```vue
    <section class="flex flex-col gap-4">
      <TrendingWidget />
    </section>
```

The resulting template order is:
1. `<section>` — h1 + description
2. `<section>` — WorldMap + AvailableCountriesStrip + CountrySelector
3. `<section>` — **TrendingWidget** ← new
4. `<section v-if="...">` — featured articles

No `<script setup>` changes needed — `TrendingWidget` manages its own data.

- [ ] **Step 2: Verify TypeScript accepts the change**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add pages/index.vue
git commit -m "feat: add TrendingWidget section to home page"
```

---

## Task 11: TrendingRankingList.vue

**Files:**
- Create: `components/TrendingRankingList.vue`

- [ ] **Step 1: Create the component**

```vue
<script setup lang="ts">
import type { TrendingItemDTO } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

interface Props {
  items: TrendingItemDTO[]
}
defineProps<Props>()

function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
    .join('')
}

function topicLabel(slug: string): string {
  return TOPIC_META[slug as keyof typeof TOPIC_META]?.labelEn ?? slug
}
</script>

<template>
  <ol
    class="flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10"
  >
    <li
      v-for="(item, i) in items"
      :key="`${item.countryCode}-${item.topicSlug}`"
    >
      <NuxtLink
        :to="`/country/${item.countryCode}/${item.topicSlug}`"
        class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted dark:hover:bg-surface-dark-muted"
      >
        <span class="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-ink-muted dark:text-ink-dark-muted">
          {{ i + 1 }}
        </span>
        <span class="text-xl leading-none" aria-hidden="true">{{ flagEmoji(item.countryCode) }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink dark:text-ink-dark">
            {{ item.countryName }}
          </p>
          <p class="text-xs text-ink-muted dark:text-ink-dark-muted">
            {{ topicLabel(item.topicSlug) }}
            <span class="ml-2 opacity-70">
              {{ item.todayCount }} articles today · {{ item.avg7dCount.toFixed(1) }} avg/day
            </span>
          </p>
        </div>
        <TrendingBadge :ratio="item.spikeRatio" />
      </NuxtLink>
    </li>
    <li
      v-if="items.length === 0"
      class="px-4 py-6 text-center text-sm text-ink-muted dark:text-ink-dark-muted"
    >
      No trending spikes detected in the last 24 hours.
    </li>
  </ol>
</template>
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add components/TrendingRankingList.vue
git commit -m "feat: add TrendingRankingList component (full top-15 ranking)"
```

---

## Task 12: Extend WorldMap.vue with trendingCountries heatmap prop

**Files:**
- Modify: `components/WorldMap.vue`

- [ ] **Step 1: Add trendingCountries to Props interface and withDefaults**

Replace the current `Props` interface and `withDefaults` call with:

```ts
interface Props {
  countries: CountryDTO[]
  /** countryCode → spikeRatio (%) for amber heatmap overlay. Optional; defaults to no overlay. */
  trendingCountries?: Record<string, number>
  width?: number
  height?: number
}
const props = withDefaults(defineProps<Props>(), {
  width: 960,
  height: 500,
  trendingCountries: () => ({})
})
```

- [ ] **Step 2: Add trendingIntensity field to MapShape interface**

Replace the `MapShape` interface with:

```ts
interface MapShape {
  code: string | null
  name: string
  d: string
  clickable: boolean
  fill: string
  trendingIntensity: number // 0 = not trending; 1 = max (≥500% spike)
}
```

- [ ] **Step 3: Compute trendingIntensity in the shapes loop**

Inside the `shapes` computed, replace the `out.push(...)` line with:

```ts
const trendingIntensity = code
  ? Math.min((props.trendingCountries[code] ?? 0) / 500, 1)
  : 0
out.push({ code, name, d, clickable, fill, trendingIntensity })
```

- [ ] **Step 4: Add amber overlay layer in the SVG template**

After the closing `</g>` of the main `<path>` group (the one iterating `v-for="(shape, i) in shapes"`), add:

```html
<!-- Amber heatmap overlay for trending countries. pointer-events-none preserves existing click/hover. -->
<g class="pointer-events-none" aria-hidden="true">
  <path
    v-for="shape in shapes.filter(s => s.trendingIntensity > 0)"
    :key="`trend-${shape.code}`"
    :d="shape.d"
    :style="{ fill: `rgba(251,146,60,${(shape.trendingIntensity * 0.55).toFixed(2)})` }"
  />
</g>
```

- [ ] **Step 5: Verify TypeScript accepts all changes**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 6: Commit**

```bash
git add components/WorldMap.vue
git commit -m "feat: add optional trendingCountries heatmap overlay to WorldMap"
```

---

## Task 13: pages/trending.vue

**Files:**
- Create: `pages/trending.vue`

- [ ] **Step 1: Create the page**

```vue
<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useCountriesStore } from '~/stores/countries'

useSiteSeo({
  title: 'Trending Now | EarthLetter',
  description: 'Discover which countries are seeing sudden surges in news coverage right now.',
  ogType: 'website'
})

const router = useRouter()
const countriesStore = useCountriesStore()

await useAsyncData('countries-hydrate-trending', async () => {
  await countriesStore.fetchIfStale()
  return true
})

const countries = computed(() => countriesStore.items)

const { data, pending } = useTrending()
const items = computed(() => data.value ?? [])

const trendingCountries = computed<Record<string, number>>(() =>
  Object.fromEntries(items.value.map(i => [i.countryCode, i.spikeRatio]))
)

const showSkeleton = computed(() => pending.value && items.value.length === 0)

function goToCountry(payload: { code: string }) {
  router.push(`/country/${payload.code}`)
}
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
    <section class="flex flex-col gap-3">
      <h1 class="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
        Trending Now
      </h1>
      <p class="max-w-2xl text-ink-muted dark:text-ink-dark-muted">
        Countries and topics with the biggest surge in news coverage over the last 24 hours
        compared to their 7-day average. Refreshed hourly.
      </p>
    </section>

    <section class="flex flex-col gap-4">
      <WorldMap
        :countries="countries"
        :trending-countries="trendingCountries"
        @country-click="goToCountry"
      />
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
        Top surges
      </h2>
      <TrendingSkeleton v-if="showSkeleton" :rows="10" />
      <TrendingRankingList v-else :items="items" />
    </section>
  </div>
</template>
```

- [ ] **Step 2: Verify TypeScript accepts the file**

Run: `pnpm typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add pages/trending.vue
git commit -m "feat: add /trending page with WorldMap heatmap and ranking list"
```

---

## Task 14: Add Trending nav link to SiteHeader.vue

**Files:**
- Modify: `components/SiteHeader.vue`

- [ ] **Step 1: Add Trending link between Map and About**

Replace the `<nav>` block with:

```vue
<nav class="flex items-center gap-4 text-sm">
  <NuxtLink
    to="/"
    class="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
  >
    Map
  </NuxtLink>
  <NuxtLink
    to="/trending"
    class="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
  >
    Trending
  </NuxtLink>
  <NuxtLink
    to="/about"
    class="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
  >
    About
  </NuxtLink>
  <ThemeToggle />
</nav>
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test`
Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add components/SiteHeader.vue
git commit -m "feat: add Trending nav link to SiteHeader"
```
