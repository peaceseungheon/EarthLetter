# 이터레이션 6 — 커버리지 확장 + 국가별 트렌드 탭 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** TopicSlug를 8개로 확장하고, 20개국을 추가하고, 국가 페이지에 토픽별 기사량 트렌드 차트 탭(`/country/[code]/trends`)을 추가한다.

**Architecture:** 타입 계층부터 확장(dto → domain → API validation)하고, Prisma `$queryRaw`로 날짜별 집계 쿼리를 구현한다. 트렌드 탭은 새로운 `/country/[code]/trends` 라우트로 분리하고 `TopicTabs`에 Trends 링크를 추가한다.

**Tech Stack:** Nuxt 3, Prisma (`$queryRaw`), PostgreSQL `TO_CHAR()`, chart.js + vue-chartjs, vitest

---

## 파일 구조

| 상태 | 경로 | 역할 |
|------|------|------|
| 신규 | `server/utils/repositories/trends.ts` | `findTrends()` — $queryRaw 집계 |
| 신규 | `server/api/countries/[code]/trends.get.ts` | `GET /api/countries/:code/trends` |
| 신규 | `tests/api/trends-validation.spec.ts` | API 검증 로직 단위 테스트 |
| 신규 | `components/skeletons/CountryTrendsSkeleton.vue` | 차트 로딩 placeholder |
| 신규 | `components/CountryTrendsChart.vue` | 라인 차트 + 기간 토글 |
| 신규 | `pages/country/[code]/trends.vue` | Trends 전용 페이지 |
| 수정 | `types/dto.ts` | TopicSlug 확장 + 신규 DTO |
| 수정 | `types/domain.ts` | TOPIC_SLUGS, TOPIC_META 확장 |
| 수정 | `server/api/articles.get.ts` | TOPICS 상수 업데이트 |
| 수정 | `components/TopicTabs.vue` | Trends 탭 링크 추가 |
| 수정 | `tests/unit/domain.spec.ts` | 8개 토픽 기준으로 업데이트 |
| 수정 | `prisma/seed.ts` | 5개 토픽 + 20개국 + 소스 |

---

## Task 1: TopicSlug 타입 + 도메인 확장

**Files:**
- Modify: `tests/unit/domain.spec.ts`
- Modify: `types/dto.ts`
- Modify: `types/domain.ts`
- Modify: `server/api/articles.get.ts`

- [ ] **Step 1: `tests/unit/domain.spec.ts` — 8개 토픽 기준으로 테스트 먼저 수정**

`isTopicSlug` describe 블록 전체를 교체:

```typescript
describe('isTopicSlug', () => {
  it('accepts all eight canonical slugs', () => {
    const valid = [
      'military', 'economy', 'politics',
      'environment', 'technology', 'health', 'culture', 'sports',
    ]
    for (const slug of valid) {
      expect(isTopicSlug(slug)).toBe(true)
    }
  })

  it('rejects unknown slugs', () => {
    expect(isTopicSlug('finance')).toBe(false)
    expect(isTopicSlug('')).toBe(false)
    expect(isTopicSlug('MILITARY')).toBe(false)
  })

  it('TOPIC_SLUGS matches TOPIC_META keys exactly', () => {
    const metaKeys = Object.keys(TOPIC_META).sort()
    const slugs = [...TOPIC_SLUGS].sort()
    expect(metaKeys).toEqual(slugs)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
pnpm test tests/unit/domain.spec.ts
```
Expected: FAIL — `isTopicSlug('sports')` 등 5개 신규 슬러그가 아직 `false`를 반환

- [ ] **Step 3: `types/dto.ts` — TopicSlug 확장**

line 12를 교체:
```typescript
// 기존
export type TopicSlug = 'military' | 'economy' | 'politics'
```
→
```typescript
export type TopicSlug =
  | 'military'
  | 'economy'
  | 'politics'
  | 'environment'
  | 'technology'
  | 'health'
  | 'culture'
  | 'sports'
```

- [ ] **Step 4: `types/domain.ts` — TOPIC_SLUGS + TOPIC_META 확장**

`TOPIC_SLUGS` 배열 교체:
```typescript
export const TOPIC_SLUGS: readonly TopicSlug[] = [
  'military',
  'economy',
  'politics',
  'environment',
  'technology',
  'health',
  'culture',
  'sports',
] as const
```

`TOPIC_META` 객체에 5개 항목 추가 (기존 3개 유지, 뒤에 append):
```typescript
export const TOPIC_META: Record<TopicSlug, TopicMeta> = {
  military: {
    slug: 'military',
    labelEn: 'Military',
    description: 'Defense, security, and armed-forces coverage.',
  },
  economy: {
    slug: 'economy',
    labelEn: 'Economy',
    description: 'Trade, markets, and macroeconomic indicators.',
  },
  politics: {
    slug: 'politics',
    labelEn: 'Politics',
    description: 'Government, elections, and diplomatic affairs.',
  },
  environment: {
    slug: 'environment',
    labelEn: 'Environment',
    description: 'Climate, energy, and environmental policy.',
  },
  technology: {
    slug: 'technology',
    labelEn: 'Technology',
    description: 'Innovation, tech industry, and digital society.',
  },
  health: {
    slug: 'health',
    labelEn: 'Health',
    description: 'Public health, medicine, and healthcare systems.',
  },
  culture: {
    slug: 'culture',
    labelEn: 'Culture',
    description: 'Society, arts, and cultural affairs.',
  },
  sports: {
    slug: 'sports',
    labelEn: 'Sports',
    description: 'National and international sporting events.',
  },
}
```

- [ ] **Step 5: `server/api/articles.get.ts` — TOPICS 상수 + 오류 메시지 업데이트**

line 9 교체:
```typescript
// 기존
const TOPICS: readonly TopicSlug[] = ['military', 'economy', 'politics'] as const
```
→
```typescript
const TOPICS: readonly TopicSlug[] = [
  'military', 'economy', 'politics',
  'environment', 'technology', 'health', 'culture', 'sports',
] as const
```

line 40의 오류 메시지 교체:
```typescript
// 기존
throw bad('BAD_REQUEST', 'Query param "topic" must be one of military|economy|politics.')
```
→
```typescript
throw bad('BAD_REQUEST', `Query param "topic" must be one of ${[...TOPICS].join('|')}.`)
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
pnpm test tests/unit/domain.spec.ts
```
Expected: PASS — 3개 테스트 모두 통과

- [ ] **Step 6b: `tests/api/articles-validation.spec.ts` — 로컬 TOPICS 상수 + 테스트 업데이트**

`articles-validation.spec.ts` line 9의 TOPICS 상수 교체:
```typescript
// 기존
const TOPICS = new Set(['military', 'economy', 'politics'])
```
→
```typescript
const TOPICS = new Set([
  'military', 'economy', 'politics',
  'environment', 'technology', 'health', 'culture', 'sports',
])
```

`'rejects unknown topics'` 테스트에서 'sports' → 'finance'로 교체 (sports는 이제 유효):
```typescript
it('rejects unknown topics', () => {
  const r = validate({ country: 'US', topic: 'finance' })
  expect(r).toEqual({ ok: false, reason: 'topic' })
})
```

추가: sports가 이제 수락됨을 검증:
```typescript
it('accepts new topic slugs (e.g. sports, environment)', () => {
  expect(validate({ country: 'US', topic: 'sports' }).ok).toBe(true)
  expect(validate({ country: 'US', topic: 'environment' }).ok).toBe(true)
})
```

- [ ] **Step 7: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 8: 커밋**

```bash
git add types/dto.ts types/domain.ts server/api/articles.get.ts tests/unit/domain.spec.ts tests/api/articles-validation.spec.ts
git commit -m "feat: TopicSlug 8개로 확장 (environment·technology·health·culture·sports)"
```

---

## Task 2: TrendsResponseDTO 추가

**Files:**
- Modify: `types/dto.ts`

- [ ] **Step 1: `types/dto.ts`에 Trends DTO 추가**

`// ---------- Response envelopes ----------` 섹션 바로 앞에 삽입:

```typescript
// ---------- Trends ----------

export interface TrendDataPointDTO {
  topic: string   // TopicSlug value
  date: string    // ISO date "YYYY-MM-DD"
  count: number
}

export interface TrendsResponseDTO {
  items: TrendDataPointDTO[]
}
```

- [ ] **Step 2: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: 커밋**

```bash
git add types/dto.ts
git commit -m "feat: TrendDataPointDTO, TrendsResponseDTO 타입 추가"
```

---

## Task 3: Trends 리포지토리 + API 구현

**Files:**
- Create: `tests/api/trends-validation.spec.ts`
- Create: `server/utils/repositories/trends.ts`
- Create: `server/api/countries/[code]/trends.get.ts`

- [ ] **Step 1: `tests/api/trends-validation.spec.ts` 먼저 작성**

```typescript
// Documents the validation contract of
// `server/api/countries/[code]/trends.get.ts` as executable invariants.
// Mirror changes to both this spec and the handler if validation rules change.

import { describe, it, expect } from 'vitest'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const VALID_DAYS = new Set([7, 30, 90])

interface TrendsQuery {
  code?: unknown
  days?: unknown
}

type TrendsValidation =
  | { ok: true; code: string; days: number }
  | { ok: false; reason: string }

function validateTrends(q: TrendsQuery): TrendsValidation {
  const code = String(q.code ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(code)) return { ok: false, reason: 'code' }

  const rawDays = q.days === undefined ? 30 : Number(q.days)
  if (!VALID_DAYS.has(rawDays)) return { ok: false, reason: 'days' }

  return { ok: true, code, days: rawDays }
}

describe('/api/countries/[code]/trends validation', () => {
  it('accepts a canonical request', () => {
    expect(validateTrends({ code: 'US', days: 30 })).toEqual({ ok: true, code: 'US', days: 30 })
  })

  it('accepts days 7, 30, and 90', () => {
    for (const days of [7, 30, 90]) {
      expect(validateTrends({ code: 'KR', days })).toEqual({ ok: true, code: 'KR', days })
    }
  })

  it('defaults days to 30 when omitted', () => {
    const r = validateTrends({ code: 'JP' })
    expect(r).toEqual({ ok: true, code: 'JP', days: 30 })
  })

  it('uppercases the country code', () => {
    const r = validateTrends({ code: 'gb', days: 7 })
    expect(r.ok && r.code).toBe('GB')
  })

  it('rejects non-alpha-2 country code', () => {
    expect(validateTrends({ code: 'USA' })).toEqual({ ok: false, reason: 'code' })
    expect(validateTrends({ code: '' })).toEqual({ ok: false, reason: 'code' })
    expect(validateTrends({ code: '1' })).toEqual({ ok: false, reason: 'code' })
  })

  it('rejects invalid days values', () => {
    expect(validateTrends({ code: 'US', days: 14 })).toEqual({ ok: false, reason: 'days' })
    expect(validateTrends({ code: 'US', days: 0 })).toEqual({ ok: false, reason: 'days' })
    expect(validateTrends({ code: 'US', days: -7 })).toEqual({ ok: false, reason: 'days' })
    expect(validateTrends({ code: 'US', days: 'thirty' })).toEqual({ ok: false, reason: 'days' })
  })

  it('accepts string-typed numeric days (typical getQuery behavior)', () => {
    expect(validateTrends({ code: 'US', days: '30' })).toEqual({ ok: true, code: 'US', days: 30 })
    expect(validateTrends({ code: 'US', days: '7' })).toEqual({ ok: true, code: 'US', days: 7 })
  })
})
```

- [ ] **Step 2: 테스트 통과 확인 (inline 로직이므로 즉시 통과)**

```bash
pnpm test tests/api/trends-validation.spec.ts
```
Expected: PASS — 8개 테스트 모두 통과

- [ ] **Step 3: `server/utils/repositories/trends.ts` 생성**

```typescript
// server/utils/repositories/trends.ts
// Article count per (topic, date) for one country over a rolling window.
// Uses $queryRaw because Prisma's groupBy does not support date-truncation functions.

import type { TrendDataPointDTO } from '~/types/dto'
import { prisma } from '../prisma'

export async function findTrends(
  countryCode: string,
  days: number
): Promise<TrendDataPointDTO[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const rows = await prisma.$queryRaw<
    Array<{ topic: string; date: string; count: number }>
  >`
    SELECT
      s.topic_slug                                              AS topic,
      TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int                                             AS count
    FROM   "Article" a
    JOIN   "Source"  s ON a.source_id = s.id
    WHERE  s.country_code = ${countryCode}
      AND  a.published_at >= ${since}
    GROUP  BY s.topic_slug,
              TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ORDER  BY date ASC, s.topic_slug ASC
  `

  return rows
}
```

- [ ] **Step 4: `server/api/countries/[code]/trends.get.ts` 생성**

```typescript
// server/api/countries/[code]/trends.get.ts
// GET /api/countries/:code/trends?days=30
// Returns per-topic article counts by day for the given country.

import { createError, defineEventHandler, getQuery, getRouterParam, setResponseHeader } from 'h3'
import type { TrendsResponseDTO } from '~/types/dto'
import { findTrends } from '../../../utils/repositories/trends'
import { countryExists } from '../../../utils/repositories/countries'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const VALID_DAYS = new Set([7, 30, 90])

function bad(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: 'BAD_REQUEST',
    data: { statusCode: 400, statusMessage: 'BAD_REQUEST', message },
  })
}

export default defineEventHandler(async (event): Promise<TrendsResponseDTO> => {
  const rawCode = String(getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(rawCode)) {
    throw bad('Route param "code" must be ISO-3166 alpha-2.')
  }

  const rawDays = getQuery(event).days
  const days = rawDays === undefined ? 30 : Number(rawDays)
  if (!VALID_DAYS.has(days)) {
    throw bad('Query param "days" must be 7, 30, or 90.')
  }

  if (!(await countryExists(rawCode))) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NOT_FOUND',
      data: {
        statusCode: 404,
        statusMessage: 'NOT_FOUND',
        message: `Country "${rawCode}" is not registered.`,
      },
    })
  }

  const items = await findTrends(rawCode, days)

  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')

  return { items }
})
```

- [ ] **Step 5: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 6: 전체 테스트 통과 확인**

```bash
pnpm test
```
Expected: all tests pass

- [ ] **Step 7: 커밋**

```bash
git add server/utils/repositories/trends.ts server/api/countries/[code]/trends.get.ts tests/api/trends-validation.spec.ts
git commit -m "feat: GET /api/countries/:code/trends — 토픽별 기사량 집계 API"
```

---

## Task 4: seed.ts — 신규 토픽 5개 추가

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: `TopicSeed` 인터페이스 slug 타입 확장 (line 28)**

```typescript
interface TopicSeed {
  slug: 'military' | 'economy' | 'politics' | 'environment' | 'technology' | 'health' | 'culture' | 'sports'
  label: string
}
```

- [ ] **Step 2: `TOPICS` 배열에 5개 추가 (line 84)**

```typescript
const TOPICS: TopicSeed[] = [
  { slug: 'military',    label: 'Military & Security' },
  { slug: 'economy',     label: 'Economy' },
  { slug: 'politics',    label: 'Politics' },
  { slug: 'environment', label: 'Environment & Climate' },
  { slug: 'technology',  label: 'Technology & Innovation' },
  { slug: 'health',      label: 'Health & Medicine' },
  { slug: 'culture',     label: 'Culture & Society' },
  { slug: 'sports',      label: 'Sports' },
]
```

- [ ] **Step 3: `SOURCES` 배열 끝에 신규 토픽 소스 append**

```typescript
  // ---------- environment ----------
  { countryCode: 'US', topicSlug: 'environment', name: 'EPA News',                    feedUrl: 'https://www.epa.gov/rss/epa-news.xml' },
  { countryCode: 'US', topicSlug: 'environment', name: 'Yale Environment 360',        feedUrl: 'https://e360.yale.edu/feed' },
  { countryCode: 'GB', topicSlug: 'environment', name: 'BBC Science & Environment',   feedUrl: 'https://feeds.bbci.co.uk/news/science_and_environment/rss.xml' },
  { countryCode: 'DE', topicSlug: 'environment', name: 'DW Environment',              feedUrl: 'https://rss.dw.com/rdf/rss-en-environment' },
  { countryCode: 'IN', topicSlug: 'environment', name: 'Down to Earth',               feedUrl: 'https://www.downtoearth.org.in/rss/latest-news' },
  { countryCode: 'AU', topicSlug: 'environment', name: 'ABC Environment',             feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml' }, // REVIEW
  { countryCode: 'JP', topicSlug: 'environment', name: 'Japan Times — Environment',   feedUrl: 'https://www.japantimes.co.jp/tag/environment/feed/' },
  { countryCode: 'FR', topicSlug: 'environment', name: 'Le Monde — Environment',      feedUrl: 'https://www.lemonde.fr/en/environment/rss_full.xml' }, // REVIEW

  // ---------- technology ----------
  { countryCode: 'US', topicSlug: 'technology', name: 'TechCrunch',                  feedUrl: 'https://techcrunch.com/feed/' },
  { countryCode: 'US', topicSlug: 'technology', name: 'Wired',                        feedUrl: 'https://www.wired.com/feed/rss' },
  { countryCode: 'GB', topicSlug: 'technology', name: 'The Register',                 feedUrl: 'https://www.theregister.com/headlines.atom' },
  { countryCode: 'JP', topicSlug: 'technology', name: 'Japan Times — Technology',     feedUrl: 'https://www.japantimes.co.jp/tag/technology/feed/' },
  { countryCode: 'KR', topicSlug: 'technology', name: 'Korea Herald — Tech',          feedUrl: 'https://koreaherald.com/common/rss_xml.php?ct=050100000000' }, // REVIEW
  { countryCode: 'CN', topicSlug: 'technology', name: 'TechNode',                     feedUrl: 'https://technode.com/feed/' },
  { countryCode: 'IN', topicSlug: 'technology', name: 'Inc42',                        feedUrl: 'https://inc42.com/feed/' },
  { countryCode: 'DE', topicSlug: 'technology', name: 'DW Technology',                feedUrl: 'https://rss.dw.com/rdf/rss-en-tech' }, // REVIEW

  // ---------- health ----------
  { countryCode: 'US', topicSlug: 'health', name: 'STAT News',                        feedUrl: 'https://www.statnews.com/feed/' },
  { countryCode: 'US', topicSlug: 'health', name: 'MedPage Today',                    feedUrl: 'https://www.medpagetoday.com/rss/headlines.xml' }, // REVIEW
  { countryCode: 'GB', topicSlug: 'health', name: 'BBC Health',                        feedUrl: 'https://feeds.bbci.co.uk/news/health/rss.xml' },
  { countryCode: 'IN', topicSlug: 'health', name: 'Times of India — Health',           feedUrl: 'https://timesofindia.indiatimes.com/rssfeeds/3908999.cms' }, // REVIEW
  { countryCode: 'AU', topicSlug: 'health', name: 'The Conversation — Health',         feedUrl: 'https://theconversation.com/health/articles.atom' },
  { countryCode: 'DE', topicSlug: 'health', name: 'DW Health',                         feedUrl: 'https://rss.dw.com/rdf/rss-en-health' }, // REVIEW

  // ---------- culture ----------
  { countryCode: 'US', topicSlug: 'culture', name: 'NPR Arts & Life',                 feedUrl: 'https://feeds.npr.org/1008/rss.xml' },
  { countryCode: 'GB', topicSlug: 'culture', name: 'The Guardian — Culture',           feedUrl: 'https://www.theguardian.com/culture/rss' },
  { countryCode: 'FR', topicSlug: 'culture', name: 'France 24 — Culture',              feedUrl: 'https://www.france24.com/en/culture/rss' },
  { countryCode: 'JP', topicSlug: 'culture', name: 'Japan Today — Culture',            feedUrl: 'https://japantoday.com/category/arts-culture/feed' }, // REVIEW
  { countryCode: 'KR', topicSlug: 'culture', name: 'Korea JoongAng Daily — Culture',  feedUrl: 'https://koreajoongangdaily.joins.com/rss' }, // REVIEW

  // ---------- sports ----------
  { countryCode: 'US', topicSlug: 'sports', name: 'ESPN Headlines',                   feedUrl: 'https://www.espn.com/espn/rss/news' },
  { countryCode: 'GB', topicSlug: 'sports', name: 'BBC Sport',                         feedUrl: 'https://feeds.bbci.co.uk/sport/rss.xml' },
  { countryCode: 'AU', topicSlug: 'sports', name: 'ABC Sport',                         feedUrl: 'https://www.abc.net.au/news/sport/feed' }, // REVIEW
  { countryCode: 'IN', topicSlug: 'sports', name: 'Times of India — Sports',           feedUrl: 'https://timesofindia.indiatimes.com/rssfeeds/4719161.cms' }, // REVIEW
  { countryCode: 'JP', topicSlug: 'sports', name: 'Japan Times — Sports',              feedUrl: 'https://www.japantimes.co.jp/tag/sports/feed/' },
  { countryCode: 'KR', topicSlug: 'sports', name: 'Korea Herald — Sports',             feedUrl: 'https://koreaherald.com/common/rss_xml.php?ct=020200000000' }, // REVIEW
  { countryCode: 'DE', topicSlug: 'sports', name: 'DW Sports',                         feedUrl: 'https://rss.dw.com/rdf/rss-en-sports' }, // REVIEW
  { countryCode: 'FR', topicSlug: 'sports', name: 'France 24 — Sports',                feedUrl: 'https://www.france24.com/en/sport/rss' },
```

- [ ] **Step 4: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 5: 커밋**

```bash
git add prisma/seed.ts
git commit -m "feat: seed — 5개 신규 토픽 + 주요국 RSS 소스 추가"
```

---

## Task 5: seed.ts — 20개국 + 소스 추가

**Files:**
- Modify: `prisma/seed.ts`

- [ ] **Step 1: `COUNTRIES` 배열에 20개국 추가**

기존 `{ code: 'EG', ... }` 항목 다음에 append:

```typescript
  // --- Iteration 6 expansion: +20 countries → 50 total ---
  // Asia-Pacific (+5)
  { code: 'PK', nameEn: 'Pakistan',         nameKo: '파키스탄' },
  { code: 'BD', nameEn: 'Bangladesh',        nameKo: '방글라데시' },
  { code: 'LK', nameEn: 'Sri Lanka',         nameKo: '스리랑카' },
  { code: 'KZ', nameEn: 'Kazakhstan',        nameKo: '카자흐스탄' },
  { code: 'MM', nameEn: 'Myanmar',           nameKo: '미얀마' },

  // Europe (+5)
  { code: 'SE', nameEn: 'Sweden',            nameKo: '스웨덴' },
  { code: 'NO', nameEn: 'Norway',            nameKo: '노르웨이' },
  { code: 'CZ', nameEn: 'Czech Republic',    nameKo: '체코' },
  { code: 'RO', nameEn: 'Romania',           nameKo: '루마니아' },
  { code: 'HU', nameEn: 'Hungary',           nameKo: '헝가리' },

  // Middle East & Africa (+5)
  { code: 'IQ', nameEn: 'Iraq',              nameKo: '이라크' },
  { code: 'LY', nameEn: 'Libya',             nameKo: '리비아' },
  { code: 'ET', nameEn: 'Ethiopia',          nameKo: '에티오피아' },
  { code: 'KE', nameEn: 'Kenya',             nameKo: '케냐' },
  { code: 'TZ', nameEn: 'Tanzania',          nameKo: '탄자니아' },

  // Americas (+5)
  { code: 'VE', nameEn: 'Venezuela',         nameKo: '베네수엘라' },
  { code: 'CL', nameEn: 'Chile',             nameKo: '칠레' },
  { code: 'CO', nameEn: 'Colombia',          nameKo: '콜롬비아' },
  { code: 'CU', nameEn: 'Cuba',              nameKo: '쿠바' },
  { code: 'PE', nameEn: 'Peru',              nameKo: '페루' },
```

- [ ] **Step 2: `SOURCES` 배열에 신규 국가 소스 append**

```typescript
  // ---------- Pakistan ----------
  { countryCode: 'PK', topicSlug: 'politics', name: 'Dawn — Home',       feedUrl: 'https://www.dawn.com/feeds/home' },
  { countryCode: 'PK', topicSlug: 'economy',  name: 'Dawn — Business',   feedUrl: 'https://www.dawn.com/feeds/business' },
  { countryCode: 'PK', topicSlug: 'military', name: 'Geo News',           feedUrl: 'https://www.geo.tv/rss/1/breaking-news' }, // REVIEW

  // ---------- Bangladesh ----------
  { countryCode: 'BD', topicSlug: 'politics', name: 'The Daily Star BD', feedUrl: 'https://www.thedailystar.net/rss.xml' },
  { countryCode: 'BD', topicSlug: 'economy',  name: 'The Financial Express BD', feedUrl: 'https://thefinancialexpress.com.bd/rss' }, // REVIEW

  // ---------- Sri Lanka ----------
  { countryCode: 'LK', topicSlug: 'politics', name: 'Daily Mirror LK',   feedUrl: 'https://www.dailymirror.lk/latest_news/rss' }, // REVIEW
  { countryCode: 'LK', topicSlug: 'economy',  name: 'Daily FT',           feedUrl: 'https://www.ft.lk/feed/s1' }, // REVIEW

  // ---------- Kazakhstan ----------
  { countryCode: 'KZ', topicSlug: 'politics', name: 'Astana Times',       feedUrl: 'https://astanatimes.com/feed/' },
  { countryCode: 'KZ', topicSlug: 'economy',  name: 'Silk Road Briefing', feedUrl: 'https://www.silkroadbriefing.com/news/feed/' }, // REVIEW

  // ---------- Myanmar ----------
  { countryCode: 'MM', topicSlug: 'politics', name: 'Myanmar Now',        feedUrl: 'https://myanmar-now.org/en/feed/' },
  { countryCode: 'MM', topicSlug: 'politics', name: 'Irrawaddy',           feedUrl: 'https://www.irrawaddy.com/feed' },

  // ---------- Sweden ----------
  { countryCode: 'SE', topicSlug: 'politics', name: 'The Local Sweden',   feedUrl: 'https://www.thelocal.se/rss/articles' },
  { countryCode: 'SE', topicSlug: 'economy',  name: 'Radio Sweden — Economy', feedUrl: 'https://sverigesradio.se/topplista/rsslink?programid=3304' }, // REVIEW
  { countryCode: 'SE', topicSlug: 'military', name: 'Swedish Defence Research Agency', feedUrl: 'https://www.foi.se/en/foi/news/rss.xml' }, // REVIEW

  // ---------- Norway ----------
  { countryCode: 'NO', topicSlug: 'politics', name: 'The Local Norway',   feedUrl: 'https://www.thelocal.no/rss/articles' },
  { countryCode: 'NO', topicSlug: 'economy',  name: 'Upstream Online',    feedUrl: 'https://www.upstreamonline.com/rss' }, // REVIEW

  // ---------- Czech Republic ----------
  { countryCode: 'CZ', topicSlug: 'politics', name: 'Radio Prague International', feedUrl: 'https://english.radio.cz/export/rss-all.php' },
  { countryCode: 'CZ', topicSlug: 'economy',  name: 'Prague Business Journal', feedUrl: 'https://www.praguebusinessjournal.com/feed/' }, // REVIEW

  // ---------- Romania ----------
  { countryCode: 'RO', topicSlug: 'politics', name: 'Nine O\'Clock RO',  feedUrl: 'https://www.nineoclock.ro/feed/' },
  { countryCode: 'RO', topicSlug: 'economy',  name: 'Romania Insider',    feedUrl: 'https://www.romania-insider.com/feed' },

  // ---------- Hungary ----------
  { countryCode: 'HU', topicSlug: 'politics', name: 'Hungary Today',      feedUrl: 'https://hungarytoday.hu/feed/' },
  { countryCode: 'HU', topicSlug: 'economy',  name: 'Budapest Business Journal', feedUrl: 'https://bbj.hu/rss' }, // REVIEW

  // ---------- Iraq ----------
  { countryCode: 'IQ', topicSlug: 'politics', name: 'Al-Monitor — Iraq', feedUrl: 'https://www.al-monitor.com/rss/topics/iraq.xml' }, // REVIEW
  { countryCode: 'IQ', topicSlug: 'military', name: 'Iraq News Network',  feedUrl: 'https://www.iraqnewsnetwork.net/feed/' }, // REVIEW

  // ---------- Libya ----------
  { countryCode: 'LY', topicSlug: 'politics', name: 'Libya Herald',       feedUrl: 'https://www.libyaherald.com/feed/' },
  { countryCode: 'LY', topicSlug: 'military', name: 'Libya Observer',     feedUrl: 'https://www.libyaobserver.ly/feed' }, // REVIEW

  // ---------- Ethiopia ----------
  { countryCode: 'ET', topicSlug: 'politics', name: 'Addis Standard',     feedUrl: 'https://addisstandard.com/feed/' },
  { countryCode: 'ET', topicSlug: 'economy',  name: 'The Reporter Ethiopia', feedUrl: 'https://www.thereporterethiopia.com/feed' },

  // ---------- Kenya ----------
  { countryCode: 'KE', topicSlug: 'politics', name: 'Nation Africa KE',   feedUrl: 'https://nation.africa/kenya/rss.xml' }, // REVIEW
  { countryCode: 'KE', topicSlug: 'economy',  name: 'Business Daily Africa', feedUrl: 'https://www.businessdailyafrica.com/rss' }, // REVIEW

  // ---------- Tanzania ----------
  { countryCode: 'TZ', topicSlug: 'politics', name: 'The Citizen TZ',     feedUrl: 'https://www.thecitizen.co.tz/tanzania/rss.xml' }, // REVIEW
  { countryCode: 'TZ', topicSlug: 'economy',  name: 'The East African',   feedUrl: 'https://www.theeastafrican.co.ke/rss' }, // REVIEW

  // ---------- Venezuela ----------
  { countryCode: 'VE', topicSlug: 'politics', name: 'Caracas Chronicles', feedUrl: 'https://www.caracaschronicles.com/feed/' },
  { countryCode: 'VE', topicSlug: 'economy',  name: 'Venezuela Analysis', feedUrl: 'https://venezuelanalysis.com/feed' },

  // ---------- Chile ----------
  { countryCode: 'CL', topicSlug: 'politics', name: 'Santiago Times',     feedUrl: 'https://santiagotimes.cl/feed/' },
  { countryCode: 'CL', topicSlug: 'economy',  name: 'BN Americas — Chile', feedUrl: 'https://www.bnamericas.com/rss/news/chile.xml' }, // REVIEW

  // ---------- Colombia ----------
  { countryCode: 'CO', topicSlug: 'politics', name: 'Colombia Reports',   feedUrl: 'https://colombiareports.com/feed/' },
  { countryCode: 'CO', topicSlug: 'economy',  name: 'BN Americas — Colombia', feedUrl: 'https://www.bnamericas.com/rss/news/colombia.xml' }, // REVIEW

  // ---------- Cuba ----------
  { countryCode: 'CU', topicSlug: 'politics', name: 'Havana Times',       feedUrl: 'https://havanatimes.org/feed/' },
  { countryCode: 'CU', topicSlug: 'politics', name: '14ymedio',           feedUrl: 'https://www.14ymedio.com/rss.xml' }, // REVIEW: may be Spanish

  // ---------- Peru ----------
  { countryCode: 'PE', topicSlug: 'politics', name: 'Peru Reports',       feedUrl: 'https://perureports.com/feed/' }, // REVIEW
  { countryCode: 'PE', topicSlug: 'economy',  name: 'Andina — Peru News', feedUrl: 'https://andina.pe/RSS/rss.aspx?id=4' }, // REVIEW
```

- [ ] **Step 3: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 4: 커밋**

```bash
git add prisma/seed.ts
git commit -m "feat: seed — 20개국(총 50개국) + 신규 소스 추가"
```

---

## Task 6: chart.js 설치 + CountryTrendsSkeleton

**Files:**
- Create: `components/skeletons/CountryTrendsSkeleton.vue`

- [ ] **Step 1: chart.js + vue-chartjs 설치**

```bash
pnpm add chart.js vue-chartjs
```
Expected: `chart.js`와 `vue-chartjs`가 `package.json` dependencies에 추가됨

- [ ] **Step 2: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: `components/skeletons/CountryTrendsSkeleton.vue` 생성**

```vue
<template>
  <div
    class="flex flex-col gap-4"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <span class="sr-only">Loading trends…</span>
    <!-- period toggle placeholder -->
    <div class="flex gap-2">
      <div
        v-for="i in 3"
        :key="i"
        class="h-9 w-16 animate-pulse rounded-full bg-surface-muted dark:bg-surface-dark-muted"
      />
    </div>
    <!-- chart area placeholder -->
    <div class="h-64 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
  </div>
</template>
```

- [ ] **Step 4: 커밋**

```bash
git add components/skeletons/CountryTrendsSkeleton.vue
git commit -m "feat: CountryTrendsSkeleton 로딩 placeholder"
```

---

## Task 7: CountryTrendsChart 컴포넌트

**Files:**
- Create: `components/CountryTrendsChart.vue`

- [ ] **Step 1: `components/CountryTrendsChart.vue` 생성**

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'
import type { TrendsResponseDTO } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

const TOPIC_COLORS: Record<string, string> = {
  politics:    '#4e79a7',
  economy:     '#f28e2b',
  military:    '#e15759',
  environment: '#59a14f',
  technology:  '#76b7b2',
  health:      '#edc948',
  culture:     '#b07aa1',
  sports:      '#ff9da7',
}

interface Props {
  countryCode: string
}
const props = defineProps<Props>()

type Days = 7 | 30 | 90
const days = ref<Days>(30)

const { data, pending } = useFetch<TrendsResponseDTO>(
  () => `/api/countries/${props.countryCode}/trends`,
  {
    query: { days },
    lazy: true,
  }
)

const items = computed(() => data.value?.items ?? [])

const chartData = computed(() => {
  const dates = [...new Set(items.value.map((d) => d.date))].sort()
  const topics = [...new Set(items.value.map((d) => d.topic))]

  return {
    labels: dates,
    datasets: topics.map((topic) => ({
      label: TOPIC_META[topic as keyof typeof TOPIC_META]?.labelEn ?? topic,
      data: dates.map((date) => {
        const row = items.value.find((d) => d.topic === topic && d.date === date)
        return row?.count ?? 0
      }),
      borderColor: TOPIC_COLORS[topic] ?? '#aaa',
      backgroundColor: (TOPIC_COLORS[topic] ?? '#aaa') + '22',
      tension: 0.3,
      fill: false,
      pointRadius: 3,
    })),
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const },
    title: { display: false },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 },
    },
  },
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <!-- Period toggle -->
    <div class="flex gap-2" role="group" aria-label="Trend period">
      <button
        v-for="d in ([7, 30, 90] as Days[])"
        :key="d"
        class="inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        :class="
          days === d
            ? 'border-accent bg-accent text-white shadow-sm'
            : 'border-black/10 bg-surface text-ink hover:bg-surface-muted dark:border-white/15 dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark'
        "
        @click="days = d"
      >
        {{ d }}d
      </button>
    </div>

    <!-- Loading -->
    <CountryTrendsSkeleton v-if="pending" />

    <!-- Empty -->
    <div
      v-else-if="items.length === 0"
      class="flex h-64 items-center justify-center rounded-xl border border-dashed border-black/10 text-sm text-ink-muted dark:border-white/15 dark:text-ink-dark-muted"
    >
      No article data for this period.
    </div>

    <!-- Chart -->
    <div v-else class="h-64">
      <Line :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
```

- [ ] **Step 2: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 3: 커밋**

```bash
git add components/CountryTrendsChart.vue
git commit -m "feat: CountryTrendsChart — 토픽별 기사량 라인 차트 (7d/30d/90d 토글)"
```

---

## Task 8: Trends 페이지 + TopicTabs 수정

**Files:**
- Create: `pages/country/[code]/trends.vue`
- Modify: `components/TopicTabs.vue`

- [ ] **Step 1: `pages/country/[code]/trends.vue` 생성**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { createError } from 'h3'
import { useRoute } from 'vue-router'
import { isIsoCountryCode } from '~/types/domain'
import { useCountriesStore } from '~/stores/countries'

const route = useRoute()
const rawCode = String(route.params.code ?? '').toUpperCase()

if (!isIsoCountryCode(rawCode)) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}

const countriesStore = useCountriesStore()
await useAsyncData(`country-meta-${rawCode}`, async () => {
  await countriesStore.fetchIfStale()
  return true
})

const country = computed(() => countriesStore.byCode(rawCode))

if (!country.value) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}

useSiteSeo({
  title: `${country.value.nameEn} Trends — EarthLetter`,
  description: `Article volume trends by topic for ${country.value.nameEn}, updated hourly.`,
  ogType: 'website',
})
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
    <nav
      class="flex flex-wrap items-center gap-2 text-sm text-ink-muted dark:text-ink-dark-muted"
      aria-label="Breadcrumb"
    >
      <NuxtLink to="/" class="hover:underline">Map</NuxtLink>
      <span aria-hidden="true">›</span>
      <NuxtLink :to="`/country/${country!.code}`" class="hover:underline">
        {{ country!.nameEn }}
      </NuxtLink>
      <span aria-hidden="true">›</span>
      <span class="text-ink dark:text-ink-dark">Trends</span>
    </nav>

    <header>
      <h1 class="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
        Trends — {{ country!.nameEn }}
      </h1>
      <p class="mt-1 text-ink-muted dark:text-ink-dark-muted">
        Article volume by topic over time.
      </p>
    </header>

    <TopicTabs :country-code="country!.code" />

    <AdSlot slot-id="trends-leaderboard" format="horizontal" :min-height-px="90" />

    <CountryTrendsChart :country-code="rawCode" />
  </div>
</template>
```

- [ ] **Step 2: `components/TopicTabs.vue` — Trends 탭 추가**

파일 전체 교체:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import type { TopicSlug } from '~/types/dto'
import { TOPIC_META, TOPIC_SLUGS } from '~/types/domain'

interface Props {
  countryCode: string
  active?: TopicSlug
}
defineProps<Props>()

const route = useRoute()
const isTrendsActive = computed(() => route.path.endsWith('/trends'))
</script>

<template>
  <nav
    class="flex flex-wrap gap-2 overflow-x-auto"
    role="tablist"
    aria-label="News topic"
  >
    <NuxtLink
      v-for="slug in TOPIC_SLUGS"
      :key="slug"
      :to="`/country/${countryCode.toUpperCase()}/${slug}`"
      role="tab"
      :aria-selected="active === slug"
      class="inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :class="
        active === slug
          ? 'border-accent bg-accent text-white shadow-sm'
          : 'border-black/10 bg-surface text-ink hover:bg-surface-muted dark:border-white/15 dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark'
      "
    >
      {{ TOPIC_META[slug].labelEn }}
    </NuxtLink>

    <NuxtLink
      :to="`/country/${countryCode.toUpperCase()}/trends`"
      role="tab"
      :aria-selected="isTrendsActive"
      class="inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :class="
        isTrendsActive
          ? 'border-accent bg-accent text-white shadow-sm'
          : 'border-black/10 bg-surface text-ink hover:bg-surface-muted dark:border-white/15 dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark'
      "
    >
      Trends
    </NuxtLink>
  </nav>
</template>
```

- [ ] **Step 3: 타입체크 확인**

```bash
pnpm typecheck
```
Expected: no errors

- [ ] **Step 4: 전체 테스트 스위트 통과 확인**

```bash
pnpm test
```
Expected: all tests pass

- [ ] **Step 5: lint 확인**

```bash
pnpm lint
```
Expected: no lint errors

- [ ] **Step 6: 커밋**

```bash
git add pages/country/[code]/trends.vue components/TopicTabs.vue
git commit -m "feat: /country/:code/trends 페이지 + TopicTabs Trends 탭"
```

---

## 완료 기준

- [ ] `pnpm typecheck` 에러 없음
- [ ] `pnpm test` 전체 통과
- [ ] `pnpm lint` 에러 없음
- [ ] `/country/KR/trends` 접근 시 라인 차트 렌더링 (데이터가 있는 경우)
- [ ] 7d / 30d / 90d 토글 시 차트 리페치
- [ ] `TopicTabs`의 Trends 탭이 active 상태로 하이라이트
- [ ] `pnpm prisma:seed` 실행 시 8개 토픽 + 50개국 정상 upsert

**문서 버전:** v1 — 2026-04-25
