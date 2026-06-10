# 00 Architecture — Trending Feed (이터레이션 7)

> **Source plan:** `docs/superpowers/plans/2026-04-27-trending-feed.md`
> **Owner agents:** backend-dev, frontend-dev
> **Contract freeze:** § 3 (API 계약). DTO drift = 아키텍처 위반.

---

## 1. 이터레이션 목표

직전 24시간 기사 수와 이전 7일 일평균을 비교해 country×topic 단위로 급등(spike)을 탐지하는 글로벌 트렌딩 피드를 신설하고, 홈 위젯(top 5)과 `/trending` 전용 페이지(WorldMap heatmap + top 15 랭킹)로 노출한다.

---

## 2. 파일 변경 목록

| 파일 | 액션 | 담당 | 역할 |
|------|------|------|------|
| `types/dto.ts` | Modify | backend-dev | `TrendingItemDTO`, `TrendingResponseDTO` 추가 (계약 동결) |
| `server/utils/repositories/trending.ts` | Create | backend-dev | `findTrending()` — Prisma `$queryRaw` 두 개 CTE(today / baseline) 비교 쿼리 |
| `server/api/trending.get.ts` | Create | backend-dev | `GET /api/trending` 라우트 + 1h SWR Cache-Control 헤더 |
| `nuxt.config.ts` | Modify | frontend-dev | `routeRules['/trending']` SWR 3600 추가 |
| `tests/api/trending-spikeratio.spec.ts` | Create | backend-dev | spikeRatio 공식 invariant 스펙 (4 케이스) |
| `composables/useTrending.ts` | Create | frontend-dev | `useFetch<TrendingResponseDTO>('/api/trending', { lazy: true })` 래퍼 |
| `components/TrendingBadge.vue` | Create | frontend-dev | `+127%` 형태의 spikeRatio 뱃지 |
| `components/skeletons/TrendingSkeleton.vue` | Create | frontend-dev | rows prop으로 행 수 조절 가능한 로딩 스켈레톤 |
| `components/TrendingWidget.vue` | Create | frontend-dev | 홈용 mini widget — top 5, `/trending` 링크 |
| `components/TrendingRankingList.vue` | Create | frontend-dev | top 15 ranked list with todayCount/avg7dCount 컨텍스트 |
| `components/WorldMap.vue` | Modify | frontend-dev | optional `trendingCountries` heatmap overlay prop 추가 |
| `pages/trending.vue` | Create | frontend-dev | 전용 `/trending` 페이지 (WorldMap heatmap + RankingList) |
| `pages/index.vue` | Modify | frontend-dev | `<TrendingWidget>` 섹션 삽입 (map과 featured 사이) |
| `components/SiteHeader.vue` | Modify | frontend-dev | "Trending" nav link 추가 (Map과 About 사이) |

**작업 순서 의존성:**
1. backend-dev: dto → spikeRatio 테스트 → repository → route handler (4 단계, 순차 commit)
2. frontend-dev: routeRule → composable → 원자 컴포넌트(Badge/Skeleton) → 컴포지트(Widget/RankingList) → WorldMap 확장 → 페이지/헤더 수정 (병렬화 가능 구간 = Badge/Skeleton/composable)

---

## 3. API 계약 (CONTRACT-FROZEN)

`GET /api/trending` 응답 = `TrendingResponseDTO` = `TrendingItemDTO[]` (envelope 없음, bare array — 기존 `CountriesResponseDTO`가 envelope을 쓰는 것과 다른 점에 유의).

```ts
// types/dto.ts (TrendsResponseDTO 블록 직후, line 83 부근에 삽입)

// ---------- Trending ----------

export interface TrendingItemDTO {
  countryCode: string   // ISO-3166 alpha-2 (Source.country_code)
  countryName: string   // English name (Country.name_en JOIN)
  topicSlug: string     // TopicSlug 값 (Source.topic_slug)
  todayCount: number    // 직전 24h 기사 수 (int)
  avg7dCount: number    // 직전 7일 일평균 (소수 2자리 반올림된 float)
  spikeRatio: number    // ((todayCount / avg7dCount) - 1) * 100, 소수 1자리 (float)
}

export type TrendingResponseDTO = TrendingItemDTO[]
```

**정렬:** `spikeRatio DESC` (가장 큰 급등이 [0])
**최대 길이:** 15 (SQL `LIMIT 15`)
**필터링:** `baseline.total_7d >= 5` (저빈도 페어 제거)
**HTTP 헤더:** `Cache-Control: public, s-maxage=3600, stale-while-revalidate=3600`
**TopicSlug 타입:** 응답 `topicSlug`는 `string`으로 선언 (DB raw 값 — 프론트에서 `TOPIC_META[slug as keyof typeof TOPIC_META]?.labelEn ?? slug` 패턴으로 안전하게 좁힘. 신규 토픽 슬러그 출현 시에도 무너지지 않도록 의도된 약한 타입.)

---

## 4. backend-dev 작업 범위

### 4.1 생성/수정 파일
1. **Modify** `types/dto.ts` — § 3 DTO 블록 삽입 (line 83 직후). 동일 파일 안에서 `// ---------- Trending ----------` 섹션 헤더 컨벤션 유지.
2. **Create** `server/utils/repositories/trending.ts` — 기존 `trends.ts`와 동일한 `import { prisma } from '../prisma'` 패턴 사용. 함수 시그니처: `export async function findTrending(): Promise<TrendingItemDTO[]>`.
3. **Create** `server/api/trending.get.ts` — `defineEventHandler`, `setResponseHeader`, `findTrending()` 호출. 반환 타입을 `Promise<TrendingResponseDTO>`로 명시.
4. **Create** `tests/api/trending-spikeratio.spec.ts` — 4 케이스 (today=avg → 0, double → 100, half → -50, 100x → 9900). 헬퍼는 SQL과 독립적으로 JS로 재구현하여 SQL 공식 변경 시 드리프트 감지.

### 4.2 SQL 핵심 로직 노트
- **두 개 CTE 패턴** (`today` + `baseline`)으로 단일 쿼리 안에서 윈도우 비교. Prisma `groupBy`는 두 윈도우 비교를 표현 못 하므로 `$queryRaw` 강제.
- **today CTE**: `published_at >= NOW() - INTERVAL '24 hours'`
- **baseline CTE**: `published_at >= NOW() - INTERVAL '8 days' AND published_at < NOW() - INTERVAL '24 hours'` (즉 24h~8d 전 윈도우 = 7일치)
- **JOIN**: `today JOIN baseline ON country_code AND topic_slug` → 양쪽 모두 존재해야 결과에 포함 (cold-start 페어는 자동 배제). 추가로 `JOIN "Country" c ON c.code = t.country_code`로 영문 이름 보강.
- **필터**: `WHERE b.total_7d >= 5` (1주일 5개 미만이면 노이즈로 간주).
- **컬럼 별칭은 quoted camelCase** (`"countryCode"`, `"spikeRatio"` 등) — Prisma `$queryRaw<TrendingItemDTO[]>`가 매핑 없이 바로 DTO로 캐스팅되도록. 기존 `trends.ts`는 lowercase 별칭(`topic`, `date`, `count`)을 쓰지만 그 이유는 DTO 필드명이 마침 lowercase였기 때문 — 이번 작업은 DTO가 camelCase이므로 quoted alias가 필수.
- **수치 변환**: `ROUND(...)::float`로 Prisma BigInt/Decimal 직렬화 이슈 방지. `COUNT(*)::int` 동일 의도.

### 4.3 캐시 전략
- **응답 헤더**: `Cache-Control: public, s-maxage=3600, stale-while-revalidate=3600` (CDN/리버스 프록시 1h 신선, 1h 추가 stale 허용).
- **In-process 캐시 없음** — Nitro/CDN 레이어에 위임. 24h 윈도우는 1h마다 갱신해도 충분히 의미 있는 변화량을 보임.
- **DB 인덱스 가정**: `Article.published_at` + `Source.country_code, topic_slug` 인덱스가 이미 존재한다는 전제(기존 `trends.ts` 쿼리도 같은 인덱스에 의존). 별도 마이그레이션 불필요.

---

## 5. frontend-dev 작업 범위

### 5.1 생성/수정 파일
1. **Modify** `nuxt.config.ts` — `routeRules['/country/**']` 직후 `'/trending'` 항목 추가 (§ 6.4 참조).
2. **Create** `composables/useTrending.ts` — `useFetch` 직접 래핑, `lazy: true` (홈 위젯이 진입 차단을 일으키지 않도록).
3. **Create** `components/TrendingBadge.vue` — `defineProps<{ ratio: number }>()`. `+${Math.round(ratio)}%` 라벨, amber pill 스타일 (orange-100/700 light + orange-900/30/300 dark).
4. **Create** `components/skeletons/TrendingSkeleton.vue` — `withDefaults(defineProps<{ rows?: number }>(), { rows: 5 })`. role=status, aria-busy, animate-pulse 행.
5. **Create** `components/TrendingWidget.vue` — `useTrending()` 호출, `top5 = data.slice(0,5)`, 비어있을 때 안내 문구. 각 행은 `<NuxtLink to="/country/{code}/{topic}">`로 카운트리×토픽 경로 링크.
6. **Create** `components/TrendingRankingList.vue` — `defineProps<{ items: TrendingItemDTO[] }>()`, `<ol>` 렌더, 1-based 순위 prefix + todayCount/avg7dCount 메타.
7. **Modify** `components/WorldMap.vue` — § 6.2 참조.
8. **Create** `pages/trending.vue` — `useSiteSeo`, `useCountriesStore.fetchIfStale()` SSR 하이드레이션 (홈과 동일 패턴), `useTrending()` 호출, `trendingCountries = Object.fromEntries(items.map(i => [i.countryCode, i.spikeRatio]))`로 변환하여 WorldMap에 prop 전달, `goToCountry({ code }) → router.push('/country/{code}')`.
9. **Modify** `pages/index.vue` — WorldMap 섹션과 featured 섹션 사이에 `<section class="flex flex-col gap-4"><TrendingWidget /></section>` 삽입. `<script setup>`은 변경 불필요 (위젯이 자체 데이터 페칭).
10. **Modify** `components/SiteHeader.vue` — `<nav>` 안에서 Map과 About 링크 사이에 `<NuxtLink to="/trending">Trending</NuxtLink>` 추가, 동일 className 유지.

### 5.2 컴포넌트별 핵심 구현 노트
- **flagEmoji 헬퍼**: `TrendingWidget`과 `TrendingRankingList` 양쪽에 동일 함수 중복 존재 (각 컴포넌트 self-contained). DRY 위반은 의도적 — 작은 헬퍼 1개를 위해 composable 신설하지 않음.
- **topicLabel 헬퍼**: `TOPIC_META[slug as keyof typeof TOPIC_META]?.labelEn ?? slug` — 알려지지 않은 슬러그도 raw로 fallback.
- **빈 상태 메시지**: 두 컴포넌트 모두 "No trending spikes detected in the last 24 hours." 동일 문구 사용 (UX 일관성).
- **Skeleton vs Empty 구분**: `showSkeleton = pending && items.length === 0` — 캐시된 데이터가 있으면 스켈레톤 없이 즉시 렌더.

### 5.3 WorldMap props 변경 방식 (확장 호환성 보존)
**원칙: 기존 호출자(`pages/index.vue`)는 무수정.** `trendingCountries`는 optional prop, factory 기본값 `() => ({})` — 빈 오버레이는 빈 배열 반환되므로 SVG에 어떤 추가 요소도 렌더되지 않는다.

**Props 인터페이스 변경 (`WorldMap.vue:19-29`):**
```ts
interface Props {
  countries: CountryDTO[]
  trendingCountries?: Record<string, number>  // 신규: countryCode → spikeRatio (%)
  width?: number
  height?: number
}
const props = withDefaults(defineProps<Props>(), {
  width: 960,
  height: 500,
  trendingCountries: () => ({})  // 객체/배열은 반드시 factory 함수로 (Vue 규칙)
})
```

**MapShape 인터페이스 확장 (`WorldMap.vue:65-71`):** `trendingIntensity: number` 필드 추가 (0~1 범위, 0=오버레이 없음).

**shapes computed 수정 (`WorldMap.vue:112` 부근):** `out.push` 직전에 `const trendingIntensity = code ? Math.min((props.trendingCountries[code] ?? 0) / 500, 1) : 0` 계산. 500%를 max로 클램프.

**SVG에 오버레이 layer 추가 (`WorldMap.vue:185` `</g>` 직후):**
```html
<g class="pointer-events-none" aria-hidden="true">
  <path
    v-for="shape in shapes.filter(s => s.trendingIntensity > 0)"
    :key="`trend-${shape.code}`"
    :d="shape.d"
    :style="{ fill: `rgba(251,146,60,${(shape.trendingIntensity * 0.55).toFixed(2)})` }"
  />
</g>
```
`pointer-events-none`이 critical — 기존 `clickable`/`hover`/`focus`/`tabindex` 동작이 그대로 작동한다(오버레이는 시각적 레이어일 뿐).

---

## 6. 주요 설계 결정 & 주의사항

### 6.1 기존 `$queryRaw` 패턴 (`trends.ts` 참조)
- **Import 경로**: `import { prisma } from '../prisma'` — 절대 경로(`~/...`) 금지. 기존 `server/utils/repositories/trends.ts:6`이 동일 컨벤션.
- **타입 단언 방식**: `prisma.$queryRaw<TrendingItemDTO[]>\`...\`` — generic으로 row shape 직접 명시. 별도 mapper 함수 불필요 (camelCase 컬럼 별칭 덕분).
- **차이점**: `trends.ts:14`는 `Array<{ topic: string; date: string; count: number }>` 익명 row 타입 후 `return rows` 패턴이지만, 이번엔 DTO 자체를 generic에 직접 사용 — 컬럼 별칭이 DTO 필드와 1:1 일치하므로 가능.
- **NOW() 함수**: SQL 레벨 `NOW() - INTERVAL '24 hours'` 사용 (서버 클럭 의존). `trends.ts`는 JS의 `new Date()`를 매개변수로 바인딩하는 다른 스타일 — 이번 쿼리는 매개변수가 없어 SQL 함수 직접 호출이 더 명확.

### 6.2 WorldMap 수정 시 기존 clickable/fill 로직 보존 방법
- **레이어 분리**: 기존 `<path>` 그룹은 그대로 두고, 트렌딩 오버레이는 별도 `<g class="pointer-events-none">` 그룹으로 추가. 두 layer는 독립적이며 z-order는 SVG 마크업 순서대로 (오버레이가 위).
- **fill 계산 무손실**: `shape.fill`(ACTIVE/MUTED palette 기반)은 그대로 base layer에 적용. 오버레이의 `rgba(251,146,60,α)`가 그 위에 합성되어 amber tint가 입혀지는 시각 효과.
- **clickable=false 국가도 오버레이 가능**: `trendingIntensity` 계산은 `clickable`과 무관하게 `code` 존재만 조건으로 함 — 만약 백엔드가 hasSources=false 국가의 spike도 응답하면 회색 base 위에 amber overlay가 깔린다. (현 백엔드 쿼리는 Article을 가진 국가만 반환하므로 사실상 hasSources=true 집합과 일치하지만, 프론트는 이 invariant에 의존하지 않는다.)
- **접근성**: 오버레이는 `aria-hidden="true"`. 스크린리더는 base layer의 `aria-label`만 읽음 — 트렌딩 정보는 RankingList에서 제공되므로 중복 안내 회피.
- **animate-pulse 충돌 없음**: 기존 `.path-available` keyframe 애니메이션은 base layer 한정. 오버레이는 정적.

### 6.3 `withDefaults` factory 패턴 (객체 props)
- Vue 3에서 `Object`/`Array` 기본값은 **반드시 factory 함수**로 전달해야 한다. 직접 `{}` 또는 `[]`을 적으면 모든 인스턴스가 동일 참조를 공유하여 mutation이 누수된다.
- **올바름**: `trendingCountries: () => ({})`
- **잘못됨**: `trendingCountries: {}` (Vue 경고 + 잠재적 reactivity 버그)
- 본 프로젝트의 다른 컴포넌트가 객체 prop을 거의 안 쓰고 있어 처음 도입되는 패턴 — frontend-dev는 이 점 특히 확인할 것.

### 6.4 routeRules SWR 추가 방법
- **위치**: `nuxt.config.ts:78` `'/country/**'` 항목 직후.
- **추가 항목**:
```ts
'/trending': {
  swr: 3600,
  headers: {
    'Cache-Control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=7200'
  }
},
```
- **`swr: 3600`** = Nitro 레벨 페이지 SWR 1h. **헤더의 `s-maxage=3600` + `stale-while-revalidate=7200`** = 외부 CDN(Vercel edge 등)에 동일 정책 전파.
- **API 핸들러 헤더와 분리**: `/api/trending`의 1h SWR(§ 4.3)과 페이지의 1h SWR이 모두 존재. 둘 중 더 신선한 쪽이 결정 — 첫 진입 시 페이지 SSR 결과 캐싱, 이후 사용자가 client-side로 다시 fetch할 때 API SWR이 기능. 의도된 이중 캐시 (page-level은 SSR HTML, api-level은 JSON for client navigation).
- **`/api/**` 와 충돌 없음**: 기존 `'/api/**': { cors: false }`는 페이지 라우트와 keyspace가 다르므로 새 항목과 무관.

### 6.5 home 페이지 위젯 삽입 시 SSR 영향
- `TrendingWidget`은 `useTrending()`이 `lazy: true`이므로 SSR 결과에 trending 데이터가 포함되지 않는다 (클라이언트에서 hydrate 후 fetch). 즉 홈 페이지 SSR HTML은 스켈레톤 상태로 전송되고, 인터랙티브 시점에 채워진다.
- 의도: 홈 페이지의 SSR TTFB를 트렌딩 쿼리(가장 무거움)에 묶지 않는다. 트렌딩 자체 페이지(`/trending`)는 동일한 lazy 패턴을 사용하지만 routeRules SWR이 캐시된 HTML을 반환하므로 사용자 체감 차이 미미.
- **검증 포인트(qa)**: `view-source:` 홈 페이지에 trending 행이 들어있지 않아도 정상.

### 6.6 잠재 리스크 / qa 체크리스트 시드
- **R1**: PostgreSQL `INTERVAL` 경계 — `published_at`이 정확히 `NOW() - 24h` 인 row는 today에도 baseline에도 포함되지 않음(`>=`/`<` 경계). 의도된 동작.
- **R2**: `total_7d / 7.0` 분모 — `total_7d >= 5` 필터 덕분에 0 분모 불가능, 그러나 SQL 안에서 추가 NULLIF 방어는 불필요.
- **R3**: spikeRatio 음수 가능 — DTO 타입은 `number`이므로 음수 허용. 그러나 `ORDER BY spikeRatio DESC LIMIT 15`이면 사실상 양수만 반환됨(15위 안에 음수가 들어올 만큼 양수 페어가 적은 경우 제외). `TrendingBadge`의 `+${...}%` 라벨은 음수 케이스에서 `+-30%` 같은 문자열을 만들 수 있음 — 현 시점에서는 실데이터에서 거의 발생 안 함. qa는 음수가 응답에 들어왔을 때 UI 처리 방식을 확인.
- **R4**: WorldMap에 `trendingCountries` 미전달 시 기존 호출자(`pages/index.vue`) 회귀 — factory default 덕분에 안전하지만 qa는 홈 페이지 시각/클릭 회귀를 명시 검증.
- **R5**: SiteHeader nav 추가는 모바일 레이아웃에서 가로 공간 압박 가능 — 현재 디자인이 데스크톱 우선이므로 우선순위 낮음.

---

## 7. 인수 기준 (qa hand-off)

- [ ] `pnpm typecheck` no new errors
- [ ] `pnpm test tests/api/trending-spikeratio.spec.ts` 4 PASS
- [ ] `pnpm test` 전체 PASS
- [ ] `GET /api/trending` 응답이 § 3 DTO 스키마와 정확히 일치 (`countryCode`, `countryName`, `topicSlug`, `todayCount`, `avg7dCount`, `spikeRatio`)
- [ ] 홈 페이지 — WorldMap 클릭/호버, AvailableCountriesStrip, CountrySelector 회귀 없음 (R4)
- [ ] 홈 페이지 — TrendingWidget이 map과 featured 섹션 사이에 노출, 클릭 시 `/country/:code/:topic` 이동
- [ ] `/trending` 페이지 — WorldMap에 amber overlay 표시, RankingList top 15 렌더, 빈 상태 메시지 동작
- [ ] SiteHeader — Trending 링크 노출, 활성 라우트 스타일 (NuxtLink 기본 동작)
- [ ] `routeRules['/trending']` 응답 헤더에 `Cache-Control: ... s-maxage=3600 ...` 포함
