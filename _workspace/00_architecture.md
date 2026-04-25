# 이터레이션 6 — 커버리지 확장 + 국가별 트렌드 탭 아키텍처

**날짜:** 2026-04-25  
**상태:** 구현 진행 중  
**기반 문서:**
- 플랜: `docs/superpowers/plans/2026-04-25-coverage-expansion-trends-tab.md`
- 설계 스펙: `docs/superpowers/specs/2026-04-25-coverage-expansion-trends-tab-design.md`

---

## 1. 이터레이션 목표

`TopicSlug`를 3개 → **8개**로 확장하고, 국가 등록을 30개 → **50개**로 확대하며, 국가 페이지에 토픽별 기사량 트렌드 라인 차트 탭(`/country/[code]/trends`)을 추가한다.

---

## 2. 변경 파일 목록

| 상태 | 경로 | 역할 |
|------|------|------|
| 신규 | `server/utils/repositories/trends.ts` | `findTrends()` — Prisma `$queryRaw` 로 (topic, date) 집계 |
| 신규 | `server/api/countries/[code]/trends.get.ts` | `GET /api/countries/:code/trends` 핸들러 |
| 신규 | `tests/api/trends-validation.spec.ts` | 트렌드 API 검증 로직 단위 테스트 |
| 신규 | `components/skeletons/CountryTrendsSkeleton.vue` | 차트 로딩 placeholder |
| 신규 | `components/CountryTrendsChart.vue` | vue-chartjs 라인 차트 + 7d/30d/90d 토글 |
| 신규 | `pages/country/[code]/trends.vue` | Trends 전용 페이지 (별도 라우트) |
| 수정 | `types/dto.ts` | `TopicSlug` 8개 확장 + `TrendDataPointDTO`, `TrendsResponseDTO` 추가 |
| 수정 | `types/domain.ts` | `TOPIC_SLUGS`, `TOPIC_META` 8개 토픽으로 확장 |
| 수정 | `server/api/articles.get.ts` | 로컬 `TOPICS` 상수 8개로 확장 + 오류 메시지 동적화 |
| 수정 | `components/TopicTabs.vue` | Trends 탭 링크 append + `useRoute` 기반 active 표시 |
| 수정 | `tests/unit/domain.spec.ts` | 8개 토픽 기준으로 테스트 갱신 |
| 수정 | `tests/api/articles-validation.spec.ts` | 로컬 `TOPICS` set 8개로 확장 + sports/environment 케이스 |
| 수정 | `prisma/seed.ts` | `TopicSeed` 타입 확장, 토픽 5개·국가 20개·신규 RSS 소스 추가 |
| 신규 의존성 | `package.json` | `chart.js`, `vue-chartjs` 추가 |

---

## 3. 에이전트별 작업 범위

### 3.1 backend-dev 담당

**API / 리포지토리:**
- `server/utils/repositories/trends.ts` — `findTrends(countryCode, days)` 신규 구현. Prisma `$queryRaw` 로 `Article` ⨝ `Source` 조인, `s.topic_slug` × `TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')` 그룹핑, `count::int` 캐스팅.
- `server/api/countries/[code]/trends.get.ts` — 라우트 파라미터(`code`) ISO alpha-2 검증, 쿼리(`days`) 화이트리스트 검증, `countryExists()` 로 404, `Cache-Control: public, s-maxage=3600, stale-while-revalidate=7200` 응답 헤더 세팅.
- `server/api/articles.get.ts` — `TOPICS` 상수 8개로 확장, 오류 메시지를 `[...TOPICS].join('|')` 로 동적 생성.

**시드:**
- `prisma/seed.ts` — `TopicSeed.slug` 유니온 8개로 확장, `TOPICS` 배열에 5개 신규 항목 append, `COUNTRIES` 배열에 20개국 append, `SOURCES` 배열에 신규 토픽·국가 RSS 소스 append (// REVIEW 주석 보존).

**테스트:**
- `tests/api/trends-validation.spec.ts` — inline `validateTrends()` 헬퍼로 검증 로직 invariant 8건 (기본 days=30, 화이트리스트 7/30/90, 대문자 정규화, ISO alpha-2 reject, 문자열 숫자 수락 등).

### 3.2 frontend-dev 담당

**타입 / 도메인:**
- `types/dto.ts` — `TopicSlug` 유니온 8개 확장 + `// ---------- Trends ----------` 섹션에 `TrendDataPointDTO`, `TrendsResponseDTO` 신규 정의.
- `types/domain.ts` — `TOPIC_SLUGS` 배열 8개 확장 + `TOPIC_META` 객체에 environment / technology / health / culture / sports 5개 항목 append.

**컴포넌트 / 페이지:**
- `components/skeletons/CountryTrendsSkeleton.vue` — 기간 토글(3개 pill) + 차트 영역(h-64) animate-pulse placeholder.
- `components/CountryTrendsChart.vue` — `vue-chartjs` `<Line>`, `ChartJS.register(...)` 로 컴포넌트 모듈 등록, props `countryCode`, 내부 `days = ref<7|30|90>(30)`, `useFetch<TrendsResponseDTO>` (lazy + reactive query), `chartData` computed (날짜·토픽 unique sort 후 zero-fill), 토픽별 고정 색상 매핑 8개.
- `pages/country/[code]/trends.vue` — `isIsoCountryCode` 가드, `useCountriesStore.fetchIfStale()` 초기화, `country` 못 찾으면 404, breadcrumb (Map › 국가 › Trends), `<TopicTabs>` + `<AdSlot>` + `<CountryTrendsChart>` 배치, `useSiteSeo()` 호출.
- `components/TopicTabs.vue` — `useRoute()` 로 `isTrendsActive` computed, 8개 토픽 NuxtLink 뒤에 Trends 탭 NuxtLink 추가 (동일 시각 스타일 패턴).

**테스트:**
- `tests/unit/domain.spec.ts` — `isTopicSlug` describe 블록 전체 교체 (8개 valid, finance/'' /MILITARY reject, `TOPIC_SLUGS ↔ TOPIC_META keys` 동치).
- `tests/api/articles-validation.spec.ts` — 로컬 `TOPICS` set 8개로 확장, finance를 unknown 케이스로 사용, sports/environment 수락 케이스 추가.

---

## 4. API 계약 — `GET /api/countries/:code/trends`

**라우트:** `server/api/countries/[code]/trends.get.ts`

### Request

| 위치 | 이름 | 타입 | 필수 | 검증 규칙 |
|------|------|------|------|----------|
| Path | `code` | `string` | Y | `getRouterParam` 후 `toUpperCase()` → `/^[A-Z]{2}$/` 매칭 |
| Query | `days` | `number` | N (default `30`) | `Number(raw)` 후 `new Set([7, 30, 90]).has(n)` 통과해야 함 |

문자열 숫자(예: `'30'`)는 `Number()` 강제 변환으로 수락 (`getQuery` 일반 동작).

### Response — 200

```ts
TrendsResponseDTO = {
  items: TrendDataPointDTO[]
}
TrendDataPointDTO = {
  topic: string   // TopicSlug 값 ("politics", "sports", ...)
  date: string    // "YYYY-MM-DD" UTC
  count: number   // ::int 캐스팅된 양의 정수
}
```

행 정렬: `ORDER BY date ASC, s.topic_slug ASC`. 빈 결과는 `{ items: [] }` (200).

### Response — 4xx

- `400 BAD_REQUEST` — 라우트 파라미터가 ISO alpha-2 미준수 (`message: 'Route param "code" must be ISO-3166 alpha-2.'`)
- `400 BAD_REQUEST` — `days` 값이 7/30/90 외 (`message: 'Query param "days" must be 7, 30, or 90.'`)
- `404 NOT_FOUND` — `countryExists(code)` false (`message: 'Country "{code}" is not registered.'`)

오류 envelope은 `articles.get.ts` 와 동일 (`createError({ data: { statusCode, statusMessage, message } })`).

### Caching

`setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')` — Vercel Edge 캐시가 1시간 신선·2시간 재검증.

### SQL (실제 쿼리)

```sql
SELECT
  s.topic_slug                                              AS topic,
  TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
  COUNT(*)::int                                             AS count
FROM   "Article" a
JOIN   "Source"  s ON a.source_id = s.id
WHERE  s.country_code = $1
  AND  a.published_at >= $2
GROUP  BY s.topic_slug,
          TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
ORDER  BY date ASC, s.topic_slug ASC
```

`since`는 핸들러에서 `new Date(Date.now() - days * 86_400_000)` 으로 계산하여 두 번째 파라미터로 전달.

---

## 5. DTO / 타입 변경

### 5.1 `TopicSlug` 확장 (`types/dto.ts`)

기존:
```ts
export type TopicSlug = 'military' | 'economy' | 'politics'
```

신규:
```ts
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

### 5.2 신규 DTO (`types/dto.ts`)

`// ---------- Response envelopes ----------` 섹션 바로 앞에 삽입:

```ts
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

### 5.3 `TOPIC_SLUGS` / `TOPIC_META` 확장 (`types/domain.ts`)

```ts
export const TOPIC_SLUGS: readonly TopicSlug[] = [
  'military', 'economy', 'politics',
  'environment', 'technology', 'health', 'culture', 'sports',
] as const
```

`TOPIC_META`에 추가되는 5개 항목:

| slug | labelEn | description |
|------|---------|-------------|
| `environment` | `Environment` | `Climate, energy, and environmental policy.` |
| `technology` | `Technology` | `Innovation, tech industry, and digital society.` |
| `health` | `Health` | `Public health, medicine, and healthcare systems.` |
| `culture` | `Culture` | `Society, arts, and cultural affairs.` |
| `sports` | `Sports` | `National and international sporting events.` |

기존 3개(military / economy / politics)는 라벨·설명 그대로 유지. `TOPIC_SLUGS` 배열 ↔ `TOPIC_META` key는 1:1 동치 invariant (`tests/unit/domain.spec.ts` 의 `'TOPIC_SLUGS matches TOPIC_META keys exactly'` 가 강제).

---

## 6. 렌더링 전략 — `/country/[code]/trends`

**Strategy:** SSR (server: true 기본) + 클라이언트 측 lazy fetch 트렌드 데이터.

### 6.1 페이지 라우트 분리

`pages/country/[code]/index.vue` 안에 탭 분기를 넣지 않고 **별도 라우트** `pages/country/[code]/trends.vue` 로 분리. 이유:
- URL이 공유 가능 (`/country/KR/trends`).
- `TopicTabs` 의 Trends NuxtLink가 해당 라우트로 직접 이동.
- 토픽별 페이지(`/country/[code]/[topic].vue`)와 충돌하지 않도록 `trends.vue` 가 우선순위(정적 세그먼트 > 동적 세그먼트)를 가짐 — Nuxt 라우터가 자동 처리.

### 6.2 페이지 데이터 로딩

| 단계 | 동작 |
|------|------|
| 1 | `isIsoCountryCode(rawCode)` 가드 → 실패 시 `createError(404)` |
| 2 | `useAsyncData('country-meta-${rawCode}', fetchIfStale)` 로 `useCountriesStore` 초기화 (SSR 친화) |
| 3 | `country = countriesStore.byCode(rawCode)` 못 찾으면 `createError(404)` |
| 4 | `useSiteSeo({ title, description, ogType: 'website' })` |
| 5 | `<CountryTrendsChart :country-code="rawCode" />` 가 내부에서 `useFetch` (lazy) — 페이지 SSR HTML 차트 미포함, 클라이언트에서 채워짐 |

### 6.3 차트 컴포넌트

`CountryTrendsChart.vue`:
- `useFetch<TrendsResponseDTO>(() => '/api/countries/${countryCode}/trends', { query: { days }, lazy: true })` — `days` ref가 변경되면 자동 refetch.
- `pending` true → `<CountryTrendsSkeleton />`, `items.length === 0` → 빈 상태 placeholder, 그 외 → `<Line :data :options />`.
- `chartData` computed: 모든 unique date를 정렬하여 x축, 모든 unique topic을 datasets로, 누락 (topic, date) 셀은 `0` 으로 zero-fill.
- 토픽별 고정 색상(8개 매핑) — 설계 스펙 §3.4와 일치.

### 6.4 캐시 / SWR

- 서버: `s-maxage=3600` (Vercel Edge)
- 클라이언트: `useFetch` 기본 (`key`는 query reactive 의해 자동 변경)

---

## 7. 구현 주의사항

### 7.1 Prisma `$queryRaw` 를 쓰는 이유

Prisma `groupBy`는 `publishedAt` 같은 DateTime 필드를 그대로만 묶을 수 있고 **날짜 단위 truncation 함수(`TO_CHAR`, `DATE_TRUNC`)를 지원하지 않는다**. 일자별 집계는 `$queryRaw` 로 직접 SQL을 작성해야 한다. 또 한 가지:

- `COUNT(*)` 결과는 PostgreSQL `bigint` → JS `BigInt` 로 매핑되므로 `::int` 로 캐스팅하여 `number` 로 받는다.
- `TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')` — 날짜 경계가 사용자 타임존이 아닌 UTC 기준이 되도록 명시. SELECT 와 GROUP BY 양쪽에 동일 표현식이 들어가야 한다.
- Prisma 템플릿 리터럴(`prisma.$queryRaw\`...\``)을 사용해 자동 파라미터화 → SQL 인젝션 방어. 문자열 결합 금지.
- 결과 타입 `Array<{ topic: string; date: string; count: number }>` 을 제네릭으로 명시하여 호출부 타입 안정성 확보.

### 7.2 vue-chartjs 등록 방식

`vue-chartjs` 는 chart.js 모듈을 **각 컴포넌트에서 명시적으로 등록** 해야 한다. 글로벌 플러그인 등록은 SSR 환경에서 hydration 불일치를 유발할 수 있어 컴포넌트 로컬 스코프에서 등록한다:

```ts
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale, LinearScale,
  PointElement, LineElement,
  Title, Tooltip, Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)
```

추가 주의:
- `chart.js` + `vue-chartjs` 둘 다 `dependencies` 로 설치 (`pnpm add chart.js vue-chartjs`).
- 차트 컨테이너에는 `h-64` (256px) 고정 높이 + `maintainAspectRatio: false` 로 반응형 width/fixed height 패턴.
- `legend.position = 'bottom' as const` — chart.js 타입 좁히기.

### 7.3 `TopicTabs.vue` 수정 방식

기존 `TopicTabs`는 `TOPIC_SLUGS` 만 v-for 로 렌더링. Trends는 토픽이 아니지만 같은 탭 행에 보여야 하므로 **`v-for` 뒤에 별도 NuxtLink 한 개를 append**:

- `useRoute()` 로 `isTrendsActive = computed(() => route.path.endsWith('/trends'))` — 라우트 기반 active 판정.
- 8개 토픽 `NuxtLink`는 `active === slug` (props로 전달되는 active topic) 기준, Trends `NuxtLink`는 `isTrendsActive` 기준 — 두 active 상태 상호 배타적.
- 토픽 페이지에서 `<TopicTabs :country-code :active="topic" />` 로 호출되면 Trends는 비활성, 트렌드 페이지에서 `<TopicTabs :country-code="country.code" />` (active prop 없음)로 호출되면 Trends만 활성.
- 시각 스타일 클래스(`border-accent bg-accent text-white shadow-sm` vs muted 상태)는 토픽 탭과 동일하게 유지.

### 7.4 시드 작성 시 주의

- 신규 RSS feed 다수에 `// REVIEW` 주석이 달려있다 — 플랜 작성 시점에 미검증된 URL이라는 표시. 이 주석을 **그대로 보존**하여 향후 검증 작업 추적이 가능하게 한다.
- Romania 시드의 `'Nine O\\'Clock RO'` 백슬래시 이스케이프 필수.
- `TopicSeed.slug` 유니온 타입을 먼저 확장한 뒤 `TOPICS` 배열을 채워야 타입체크 통과.

### 7.5 테스트 정합성

- `tests/api/articles-validation.spec.ts` 의 로컬 `TOPICS = new Set([...])` 는 핸들러의 상수와 **별도** (테스트가 검증 로직을 inline 카피하는 패턴). 핸들러 갱신 시 테스트도 동시에 갱신해야 invariant 깨짐 검출.
- 기존 `'rejects unknown topics'` 케이스가 `'sports'` 를 unknown으로 테스트했다면, 이번 확장으로 `'sports'` 는 valid가 되므로 `'finance'` 같은 진짜 unknown으로 교체해야 한다.

### 7.6 캐싱 vs 갱신 주기

- 트렌드 API: `s-maxage=3600` — RSS ingest 주기(1시간)와 정확히 정렬.
- Articles API: `s-maxage=300` (기존). 트렌드는 일자별 집계라 5분 단위로 변하지 않음 → 1시간이 적절.

---

## 8. 작업 순서 (참조)

플랜 파일의 Task 순서를 그대로 따른다 (TDD 패턴):

1. Task 1 — `TopicSlug` 타입 + 도메인 확장 (테스트 먼저 빨강 → 구현 → 초록)
2. Task 2 — `TrendsResponseDTO` 타입 추가
3. Task 3 — Trends 리포지토리 + API + 검증 spec
4. Task 4 — seed 토픽 5개 추가
5. Task 5 — seed 국가 20개 + 신규 소스 추가
6. Task 6 — chart.js 설치 + Skeleton
7. Task 7 — `CountryTrendsChart` 구현
8. Task 8 — Trends 페이지 + `TopicTabs` Trends 탭

각 Task 끝에 `pnpm typecheck` / `pnpm test` / `pnpm lint` 검증 후 별도 커밋.

---

## 9. 완료 기준

- [ ] `pnpm typecheck` 에러 없음
- [ ] `pnpm test` 전체 통과 (도메인·articles·trends validation)
- [ ] `pnpm lint` 에러 없음
- [ ] `/country/KR/trends` 진입 시 라인 차트 렌더링 (데이터 있을 때)
- [ ] 7d / 30d / 90d 토글 시 차트 리페치 + 시각 active 변경
- [ ] `TopicTabs` Trends 탭이 트렌드 페이지에서만 active 하이라이트
- [ ] `pnpm prisma:seed` 가 8개 토픽 + 50개국 정상 upsert

**문서 버전:** v1 — 2026-04-25 (architect)
