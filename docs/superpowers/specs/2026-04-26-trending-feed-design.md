# EarthLetter — Trending Feed 설계 스펙

**날짜:** 2026-04-26  
**상태:** 승인됨  
**이터레이션:** 7

---

## 개요

전 세계 국가×토픽 조합 중 최근 24시간 기사가 평소보다 급증한 이슈를 감지하여,  
홈 페이지 위젯과 전용 `/trending` 페이지에 노출한다.

---

## 목표

- 캐주얼 독자가 "지금 세계에서 무슨 일이 터지고 있나"를 한눈에 파악
- 재방문 유도 (매일 달라지는 트렌딩)

---

## 스코프 외 (이번 이터레이션 제외)

- 뉴스레터/이메일 발송
- 개인화 (로그인, 구독 설정)
- 6시간 시간 윈도우 토글

---

## 백엔드

### 급증 감지 알고리즘

- **기준 시간 윈도우:** 최근 24시간
- **비교 기준:** 직전 7일 일평균 기사 수
- **급증률:** `(today / avg7d - 1) × 100 (%)`
- **최소 볼륨 필터:** 직전 7일 합계 기사 수 < 5개인 국가×토픽 조합은 제외 (기준선이 0에 가까울 때 급증률 폭발 방지)
- **반환:** 급증률 내림차순 top 15

### 신규 파일

| 파일 | 역할 |
|------|------|
| `server/utils/repositories/trending.ts` | `findTrending()` — Prisma `$queryRaw` SQL 집계 |
| `server/api/trending.get.ts` | `GET /api/trending` 라우트 핸들러 |

### 반환 DTO

```ts
interface TrendingItemDTO {
  countryCode: string     // "US"
  countryName: string     // "United States"
  topicSlug: string       // "economy"
  todayCount: number      // 42
  avg7dCount: number      // 12.4
  spikeRatio: number      // 238.7  (%)
}

type TrendingResponseDTO = TrendingItemDTO[]
```

### 캐시 전략

- `SWR 1시간` — `routeRules` 또는 `useStorage` 캐시
- 정각 기준 집계이므로 1시간 SWR이 적절

---

## 프론트엔드

### 홈 페이지 위젯

- **위치:** `pages/index.vue` — 세계지도 아래, featured 기사 섹션 위
- **컴포넌트:** `TrendingWidget.vue`
- **표시:** top 5 아이템, 각 아이템 = 국기 + 국가명 + 토픽 + `TrendingBadge`
- **클릭:** 해당 `/country/[code]/[topic]`으로 이동
- **로딩:** `TrendingSkeleton.vue` (lazy fetch)

### 전용 `/trending` 페이지

- **파일:** `pages/trending.vue`
- **렌더링:** SSR + SWR 1시간
- **상단:** 기존 `WorldMap.vue` 재활용  
  - props `trendingCountries: Record<string, number>` 추가 (key: countryCode, value: spikeRatio)
  - 트렌딩 국가는 강도(spikeRatio)에 비례한 불투명도로 하이라이트 오버레이
  - 기존 covered/uncovered 색상 로직은 유지
- **하단:** `TrendingRankingList.vue` — 1~15위 전체 랭킹
  - 각 행: 순위 + 국기 + 국가 + 토픽 + 급증률 배지 + 오늘/평균 기사 수
  - 클릭 시 `/country/[code]/[topic]` 이동

### 신규 컴포넌트

| 컴포넌트 | 설명 |
|----------|------|
| `TrendingWidget.vue` | 홈 미니 위젯 (top 5) |
| `TrendingRankingList.vue` | 전체 랭킹 리스트 (top 15) |
| `TrendingBadge.vue` | `+127%` 급증률 표시 배지 |
| `TrendingSkeleton.vue` | 로딩 스켈레톤 |

### 신규 Composable

```ts
// composables/useTrending.ts
useFetch<TrendingResponseDTO>('/api/trending', { lazy: true })
```

### 네비게이션

- `SiteHeader.vue`에 "Trending" 링크 추가

---

## 렌더링 전략

| 경로 | 전략 |
|------|------|
| `/` (홈 위젯) | SSR + SWR 1시간 |
| `/trending` | SSR + SWR 1시간 |

---

## 데이터 플로우

```
PostgreSQL
  └─ findTrending() [Prisma $queryRaw]
       └─ GET /api/trending
            └─ useTrending() composable
                 ├─ TrendingWidget.vue   (홈, top 5)
                 └─ pages/trending.vue
                      ├─ WorldMap.vue    (트렌딩 국가 하이라이트)
                      └─ TrendingRankingList.vue  (top 15 랭킹)
```

---

## WorldMap 변경 범위

- `props` 추가: `trendingCountries?: Record<string, number>` (optional, 기본값 `{}`)
- 기존 `covered` 색상 로직 위에 트렌딩 오버레이 레이어 추가
- 기존 홈 페이지의 WorldMap은 `trendingCountries` 미전달 → 기존 동작 그대로

---

## SEO

- `/trending` 페이지: `useSeoMeta` — title "Global Trending News | EarthLetter", noindex 제외
- 정적 데이터가 아니므로 prerender 안 함

---

## 구현 순서

1. `findTrending()` 리포지토리 + SQL 작성
2. `GET /api/trending` 라우트
3. `TrendingBadge.vue` 공통 컴포넌트
4. `TrendingWidget.vue` + 홈 페이지 삽입
5. `TrendingRankingList.vue`
6. `WorldMap.vue` props 확장
7. `pages/trending.vue`
8. `SiteHeader.vue` 네비 링크 추가
9. `TrendingSkeleton.vue` 로딩 상태
