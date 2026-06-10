# EarthLetter — 기능 이력

> 완료된 모든 기능을 이터레이션 순으로 기록한다.
> 새 기능 개발 완료 시 **반드시 이 파일을 업데이트**한다 (CLAUDE.md 규칙).

---

## 이터레이션 목록

| # | 날짜 | 기능명 | 상태 |
|---|------|--------|------|
| 1 | 2026-04-22 | MVP — 풀스택 초기 구축 | ✅ 완료 |
| 2 | 2026-04-24 | Admin Dashboard + Source Auto-Disable + 국가 확장 | ✅ 완료 |
| 3 | 2026-04-25 | Feature K — 아티클 상세 페이지 + RSS full-content | ✅ 완료 |
| 4 | 2026-04-25 | WorldMap UX — 국가 탐색 UI 고도화 | ✅ 완료 |
| 5 | 2026-04-25 | 로딩 UI 보강 — 페이지 네비게이션 & 데이터 fetch 피드백 | ✅ 완료 |
| 6 | 2026-04-25 | 커버리지 확장 + 국가별 트렌드 탭 | ✅ 완료 |
| 7 | 2026-04-27 | Trending Feed — 24h 급증 탐지 + 홈 위젯 + /trending 페이지 | ✅ 완료 |
| 8 | 2026-06-10 | 3D 지구본 WorldMap + 국가 호버 기사 프리뷰 | ✅ 완료 |

---

## 상세

---

### 1. MVP — 풀스택 초기 구축 `2026-04-22`

**목표:** EarthLetter 서비스의 전체 골격을 설계하고 구현한다.

#### 프론트엔드
| 분류 | 내용 |
|------|------|
| **페이지** | `/` (홈), `/country/[code]` (국가 개요), `/country/[code]/[topic]` (토픽별 기사 목록), `/about`, `/privacy`, `/terms` |
| **레이아웃** | `default.vue` (헤더·내비·테마·푸터), `legal.vue` (좁은 콘텐츠 폭) |
| **핵심 컴포넌트** | `WorldMap.vue` + `WorldMapPath.vue` (D3-geo SVG 세계 지도), `CountrySelector.vue` (검색 드롭다운 접근성 폴백), `ArticleList.vue` + `ArticleCard.vue` (페이지네이션 목록), `TopicTabs.vue`, `Pagination.vue`, `AdSlot.vue`, `EmptyState.vue`, `ThemeToggle.vue`, `JsonLd.vue` |
| **Composables** | `useCountries`, `useArticles`, `useHomeFeatured`, `useRelativeTime`, `useCanonical`, `useAdsenseConfig` |
| **Stores (Pinia)** | `countries`, `articles` |
| **SEO** | `useSeoMeta` + JSON-LD (CollectionPage / WebSite) + `@nuxtjs/sitemap` + `@nuxtjs/robots` |
| **AdSense** | 환경변수 기반 placeholder ↔ `<ins>` 전략 패턴 |

#### 백엔드
| 분류 | 내용 |
|------|------|
| **DB 모델** | `Country`, `Topic`, `Source`, `Article` (Prisma + PostgreSQL/Supabase) |
| **API** | `GET /api/countries`, `GET /api/articles`, `GET /api/home`, `POST /api/ingest`, `POST /api/prune` |
| **RSS 파이프라인** | `ingestionService.ts` — fetch → parse → sanitize → upsert |
| **보안** | `INGEST_SECRET` timing-safe 비교, Prisma 파라미터 쿼리 |
| **인프라** | GitHub Actions (ci, ingest 시간별, prune 일별) / Vercel 배포 |

#### 초기 데이터
- 10개국, 3개 토픽(military / economy / politics), 60개 소스

#### 렌더링 전략
| 경로 | 전략 |
|------|------|
| `/` | SSR + SWR 5min |
| `/country/**` | SSR + SWR 10min |
| `/about`, `/privacy`, `/terms` | SSG (prerender) |

---

### 2. Admin Dashboard + Source Auto-Disable + 국가 확장 `2026-04-24`

**목표:** 운영자용 소스 관리 UI, 불량 소스 자동 비활성화, 커버리지 3배 확장.

#### Feature E — Admin Dashboard
| 분류 | 내용 |
|------|------|
| **페이지** | `/admin` — 소스 목록 테이블 + 필터 + 토글 + 생성/삭제 |
| **레이아웃** | `layouts/admin.vue` (토큰 게이트 + noindex 메타) |
| **컴포넌트** | `AdminTokenGate`, `SourceTable`, `SourceRow`, `SourceFormDialog`, `ConfirmDeleteDialog`, `AdminEmptyState` |
| **Composables** | `useAdminAuth`, `useAdminSources` |
| **Store** | `adminSources` (Pinia, optimistic update) |
| **인증** | `el_admin` HttpOnly 세션 쿠키 (`INGEST_SECRET` 재사용) |
| **API** | `POST /api/admin/session`, `POST /api/admin/session/logout`, `GET/POST /api/admin/sources`, `PATCH/DELETE /api/admin/sources/[id]` |

#### Feature F — Source Auto-Disable
| 분류 | 내용 |
|------|------|
| **DB 변경** | `Source` 모델에 `failCount`, `lastFailedAt`, `disabledAt`, `createdAt` 추가 |
| **로직** | 연속 fetch 실패 5회 → `enabled=false`, `disabledAt=now()` 자동 설정 |
| **구분** | `disabledAt IS NOT NULL` = 자동 비활성화 / `null` = 수동 비활성화 |
| **복구** | Admin에서 re-enable 시 `failCount=0`, `disabledAt=null` 트랜잭션 리셋 |

#### Feature G — 국가 커버리지 확장
- 10개국 → 30개국 (Asia-Pacific +5, Europe +5, Americas +4, Middle East +3, Africa +3)
- 소스 60개 → 90개+
- `about.vue`에 국가 편향 고지 문구 추가

---

### 3. Feature K — 아티클 상세 페이지 + RSS full-content `2026-04-25`

**목표:** RSS `content:encoded`를 DB에 저장하고, 내용이 있는 기사는 내부 상세 페이지로 라우팅한다.

| 분류 | 내용 |
|------|------|
| **DB 변경** | `Article.contentHtml String? @db.Text` 추가 (마이그레이션 online-safe) |
| **보안** | `sanitize-html` allow-list 기반 서버사이드 sanitize (`server/utils/sanitize.ts`) — `<script>`, `<iframe>`, `on*`, `javascript:` 차단 |
| **신규 API** | `GET /api/articles/[id]` — 단일 기사 상세 (공개, SSR, SWR 10min) |
| **신규 페이지** | `pages/article/[id].vue` — SSR, useSeoMeta + canonical, Tailwind Typography `prose` |
| **신규 컴포넌트** | `ArticleContent.vue` — `v-html` 격리 컴포넌트 (보안 리뷰 단일 지점) |
| **라우팅 분기** | `ArticleCard.vue`: `hasContent=true` → 내부 NuxtLink / `false` → 원문 새 탭 |
| **성능 보호** | 목록 API는 `contentHtml` 본문 제외 — "두 단계 쿼리" 패턴으로 `hasContent: boolean`만 반환 |

---

### 4. WorldMap UX — 국가 탐색 UI 고도화 `2026-04-25`

**목표:** 세계 지도에서 커버 국가를 직관적으로 파악하고 탐색할 수 있도록 개선한다.

| 분류 | 내용 |
|------|------|
| **국가별 색상** | 커버 국가마다 고유 색상으로 구분 표시 |
| **범례 (Legend)** | 지도 옆/하단에 색상 범례 표시 |
| **칩 스트립** | 커버 국가 목록을 칩(chip) 형태로 나열, 클릭 시 해당 국가로 이동 |
| **맥동 애니메이션** | 커버 국가 위에 pulsing 애니메이션 — 시각적 주목도 강화 |
| **주요 파일** | `components/WorldMap.vue` |

---

### 6. 커버리지 확장 + 국가별 트렌드 탭 `2026-04-25`

**목표:** 토픽·국가 커버리지 확대 및 국가 페이지에 토픽별 기사량 트렌드 차트 탭 추가.

| 분류 | 내용 |
|------|------|
| **TopicSlug 확장** | 3개 → 8개: environment, technology, health, culture, sports 추가 |
| **국가 확장** | 30개국 → 50개국 (+20: 아시아·유럽·중동·아프리카·아메리카) |
| **신규 API** | `GET /api/countries/:code/trends?days=7\|30\|90` — Prisma `$queryRaw` 집계, SWR 1시간 |
| **신규 리포지토리** | `server/utils/repositories/trends.ts` — `findTrends()` |
| **신규 컴포넌트** | `CountryTrendsChart.vue` (chart.js 라인 차트 + 7d/30d/90d 토글), `CountryTrendsSkeleton.vue` |
| **신규 페이지** | `pages/country/[code]/trends.vue` — SSR + lazy chart fetch |
| **수정 컴포넌트** | `TopicTabs.vue` — Trends 탭 추가 (`useRoute` active 감지) |
| **타입 변경** | `TopicSlug` 유니온 8개, `TrendDataPointDTO`, `TrendsResponseDTO` 추가 |
| **의존성 추가** | `chart.js@4.5.1`, `vue-chartjs@5.3.3` |

---

### 5. 로딩 UI 보강 `2026-04-25`

**목표:** 페이지 네비게이션 및 비동기 데이터 fetch 시 일관된 시각적 피드백을 제공한다.

| 분류 | 내용 |
|------|------|
| **진행 바** | `layouts/default.vue`에 `<NuxtLoadingIndicator>` 추가 (color: accent `#2f6bff`, throttle 200ms) |
| **스피너 컴포넌트** | `components/LoadingSpinner.vue` — size sm/md/lg, sr-only label, `role="status"` |
| **홈 스켈레톤** | `HomeFeaturedSkeleton.vue` — featured 섹션 6장 그리드 placeholder |
| **국가 개요 스켈레톤** | `CountryOverviewSkeleton.vue` — 3-section placeholder |
| **Lazy fetch 전환** | `pages/country/[code]/index.vue` — `await Promise.all` → `useFetch({ lazy: true })` 배열로 전환 |
| **접근성** | 모든 로딩 영역 `role="status"` + `aria-busy="true"` + `aria-live="polite"` |

---

### 7. Trending Feed — 24h 급증 탐지 `2026-04-27`

**목표:** 24시간 기사 급증 국가×토픽을 탐지해 홈 위젯(top 5)과 `/trending` 전용 페이지(WorldMap 히트맵 + top 15 랭킹)로 노출한다.

| 분류 | 내용 |
|------|------|
| **신규 API** | `GET /api/trending` — Prisma `$queryRaw` 두 CTE(today/baseline), SWR 1h |
| **알고리즘** | 최근 24h vs 이전 7일 일평균 비교, `total_7d >= 5` 필터, spikeRatio DESC LIMIT 15 |
| **DB 변경** | 없음 (기존 Article/Source/Country 테이블 활용) |
| **신규 DTO** | `TrendingItemDTO`, `TrendingResponseDTO` (`types/dto.ts`) |
| **신규 리포지토리** | `server/utils/repositories/trending.ts` — `findTrending()` |
| **신규 Composable** | `composables/useTrending.ts` — lazy useFetch wrapper |
| **신규 컴포넌트** | `TrendingBadge.vue`, `TrendingWidget.vue`, `TrendingRankingList.vue`, `skeletons/TrendingSkeleton.vue` |
| **신규 페이지** | `pages/trending.vue` — SSR + SWR 1h |
| **수정 컴포넌트** | `WorldMap.vue` — optional `trendingCountries` prop + amber 오버레이 레이어 (pointer-events-none) |
| **수정 페이지** | `pages/index.vue` — TrendingWidget 섹션 삽입 |
| **수정 네비** | `SiteHeader.vue` — Trending 링크 추가 |
| **신규 테스트** | `tests/api/trending-spikeratio.spec.ts` — 공식 불변식 4개 |
| **렌더링** | `/trending`: SSR + SWR 1h |

---

### 8. 3D 지구본 WorldMap + 국가 호버 기사 프리뷰 `2026-06-10`

**목표:** 평면 SVG 지도를 드래그로 회전 가능한 orthographic 지구본으로 전환하고, 국가 호버 시 최신 기사 3건 프리뷰 팝오버를 제공한다.

| 분류 | 내용 |
|------|------|
| **렌더링 방식** | d3-geo `geoOrthographic` + SVG 유지 (신규 의존성 0, DOM path 기반 접근성/히트테스트 확보) |
| **드래그 회전** | Pointer Events + rAF 코얼레싱 + 경량 관성(×0.95 감쇠), φ ±80° 클램프, `setPointerCapture` 3px 지연 시작 |
| **자동 회전** | 3°/s, 4중 정지 조건 (reduced-motion / 인터랙션+5s 유예 / IntersectionObserver / visibilitychange) |
| **신규 API** | `GET /api/countries/[code]/preview?limit=1~5` — 전 토픽 통합 최신 기사, Cache-Control s-maxage=300 + swr=900, 페이로드 < 1KB |
| **신규 DTO** | `CountryPreviewArticleDTO`, `CountryPreviewResponseDTO` (`types/dto.ts`) |
| **신규 리포지토리** | `findRecentByCountry()` (articles.ts), `findCountryByCode()` (countries.ts) — 스키마 변경 없음 |
| **신규 Composables** | `useGlobeProjection`, `useGlobeRotation`, `useCountryPreview` (250ms 디바운스 + TTL 5분 캐시 + abort + in-flight dedupe), `useMapMode` |
| **신규 컴포넌트** | `GlobeMap.vue` (WorldMap과 props/emits 계약 동일), `CountryPreviewPopover.vue` (centroid 앵커 + 경계 플립), `MapModeToggle.vue` (2D/3D 토글, localStorage) |
| **수정 페이지** | `pages/index.vue`, `pages/trending.vue` — 모드 분기 + 토글, trending은 1위 국가 정면 초기 회전(`focusCountryCode`) |
| **모바일** | 2-탭 모델 (1탭 프리뷰 → 2탭/View all 이동), `pointer: coarse` 판별 |
| **접근성** | 키보드 = 호버 동급 (Tab → 프리뷰, Enter 이동, Escape 닫기, 팝오버 focusin/focusout), `role="status"` + `aria-live` |
| **SSR** | 결정적 초기 회전으로 첫 프레임 SSR 포함 (hydration mismatch 0), 인터랙션은 onMounted 이후 |
| **2D 폴백** | `WorldMap.vue` 무수정 보존, 토글로 전환 가능 |
| **신규 테스트** | `tests/unit/country-preview.spec.ts` (12), `tests/unit/globe-rotation.spec.ts` (8), `tests/api/country-preview-contract.spec.ts` (10) — 전체 101 테스트 통과 |
| **QA** | Critical/High 0건, Medium 2건(rAF 누수, 키보드 접근성) 수정 완료. Low 5건 백로그 (`_workspace/03_qa_report.md` § 3) |

---

## 인프라 / 배포

| 항목 | 내용 | 시점 |
|------|------|------|
| GitHub Actions CI | typecheck, lint, unit, e2e (e2e는 PR에서 제외) | MVP |
| GitHub Actions ingest | 시간별 RSS 수집 cron | MVP |
| GitHub Actions prune | 일별 90일 초과 기사 삭제 cron | MVP |
| Vercel 배포 | Nuxt + Nitro 서버리스 | MVP |
| Vercel Web Analytics | `@vercel/analytics` 라이브러리 추가 | 2026-04-25 |
| Vercel prisma migrate | 빌드 시 `prisma migrate deploy` 자동 실행 | 2026-04-25 |
