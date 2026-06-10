# frontend-dev 작업 완료 보고 — 기사 조회 성능 개선 (SSR 워터폴 제거)

> 작성: frontend-dev / 2026-06-10
> 기준 설계: `_workspace/00_architecture.md` §5 frontend-dev 작업 목록 (P1-F1 ~ P1-F3)
> 제약 준수: `types/dto.ts` 무수정, `server/` 무접촉, 컴포넌트 구조/스타일 무변경 — 데이터 패칭 배선만 수정

---

## 1. 변경 파일 목록

| 파일 | 작업 | 변경 요지 |
|---|---|---|
| `stores/articles.ts` | P1-F1 | `load` action 내 `useFetch` → `$fetch<ArticlesResponseDTO>('/api/articles', { query })`. try/catch 에러 메시지 추출(`data?.message` 우선)과 FRESH_MS(2분) 캐시 로직 유지 |
| `stores/countries.ts` | P1-F1 | `refresh` 내 `useFetch` → `$fetch<CountriesResponseDTO>('/api/countries')`. 에러 처리/STALE_MS 로직 유지 |
| `composables/useArticles.ts` | P1-F2 | `watch(immediate)` 수동 배선 제거 → `useAsyncData(key, () => store.load(...), { watch: [country, topic, page] })`. asyncData promise를 반환값 `asyncData`로 노출 (`UseArticlesResult`에 필드 추가) |
| `pages/country/[code]/[topic].vue` | P1-F2 | countries `useAsyncData`(await 제거)와 `useArticles().asyncData`를 **`await Promise.all([countriesReady, articlesReady])`로 병렬화**. 404 체크(`!country.value`)는 Promise.all 이후로 이동해 계약 동일 |
| `pages/index.vue` | P1-F3 | `useHomeFeatured()` 호출을 countries `await useAsyncData(...)` **앞으로 이동** — non-lazy useFetch는 호출 즉시 시작되므로 자연 병렬 |
| `pages/article/[id].vue` | P1-F3 | countries 패칭의 `await` 제거 + `{ server: false, lazy: true }` 옵션 — SSR/클라이언트 내비게이션 모두 논블로킹. breadcrumb은 기존 `country?.nameEn ?? countryCode` 폴백 사용 |

신규 파일 없음. `types/dto.ts`, `server/**`, 컴포넌트/스타일 무변경.

## 2. 워터폴 Before / After

| 페이지 | Before (직렬) | After (병렬) |
|---|---|---|
| `/country/:code/:topic` | countries await 완료 → 기사 로드 시작 (watch immediate, SSR 대기 미보장) | countries ∥ articles 동시 시작 → `Promise.all` 단일 await. SSR 시간 = **max(countries, articles)**, 기사 목록 SSR HTML 포함 **보장** (SEO 핵심) |
| `/` (홈) | countries await → featured 시작 | featured 호출을 await 앞으로 이동 → countries ∥ featured. SSR = max(countries, home) |
| `/article/:id` | detail await → countries await (breadcrumb 용도인데 렌더 블로킹) | countries는 클라이언트 전용(`server: false, lazy: true`) 논블로킹. SSR = **detail 1회분** |

구조 개선: Pinia action 내부 `useFetch`(setup 컨텍스트 전용 프리미티브의 오용)가 제거되어 컨텍스트 상실 경고/중복 패칭 원인이 사라짐. SSR 페이로드 중복 제거는 페이지/composable 레벨 `useAsyncData` 래퍼(boolean 페이로드 + @pinia/nuxt 스토어 상태 직렬화)가 담당 — 설계 §7 위험 완화 그대로.

## 3. 캐시/회귀 동작 (설계 D4 유지 확인)

- **FRESH_MS(2분) 스토어 캐시 유지**: `useAsyncData`의 `watch`가 (country, topic, page) 변경 시 핸들러를 재실행하지만, 핸들러는 `store.load`로 위임하므로 fresh 페이지는 fetch 없이 즉시 반환. 페이지네이션/토픽 탭/뒤로가기 동작 동일.
- **하이드레이션 중복 패칭 없음**: `useAsyncData` 키의 payload 엔트리(boolean)가 hydration 시 핸들러 재실행을 막고, 기사/국가 데이터 자체는 Pinia payload로 전달.
- **countries `$fetch` 전환 안전성**: `fetchIfStale`/`refresh`의 모든 호출처(7곳) 전수 확인 — 전부 `useAsyncData` 래퍼 내부 또는 클라이언트 훅(onMounted)이라 SSR 페이로드 동작 보존.
- `useArticles` 키는 setup 시점 초기 파라미터 기반 정적 문자열(`articles:US:politics:1`) — 파라미터 변경은 `watch` 옵션이 처리, 페이지별 메모이제이션은 스토어가 담당.

## 4. 검증 결과

| 항목 | 결과 |
|---|---|
| `pnpm vitest run` (전체 15 파일 / 107 테스트) | **107 passed** (country-preview 12, globe-rotation 8, pagination 8 포함) |
| `pnpm exec nuxt build` | **성공 (exit 0)** |
| `pnpm typecheck` (vue-tsc) | **통과 (exit 0, 에러 0)** |
| `pnpm exec eslint` (변경 6파일) | **통과 (exit 0)** |

주의: 로컬에서 `pnpm build` 전체 스크립트는 `prisma migrate deploy`가 `DIRECT_URL`/`DATABASE_URL` 환경변수(로컬 .env 부재)를 요구해 실패한다 — **코드와 무관한 환경 제약**이며 `nuxt build` 단계 자체는 통과. CI/Vercel처럼 DB 자격증명이 있는 환경에서는 문제없음.

## 5. qa에게 전달할 주의점

1. **SSR HTML 기사 포함 검증 (최우선)**: `curl`로 `/country/US/politics` view-source에서 기사 제목 포함 확인. 이번 변경의 핵심 목표 — 기존 watch 배선은 SSR 포함을 보장하지 않았으므로 개선 전 기준선과 비교 채증 권장 (설계 §6).
2. **콘솔 Nuxt 컨텍스트 경고 0건 확인**: action 내 `useFetch` 제거가 목적이었으므로 클라이언트 내비게이션(페이지네이션 → 토픽 전환 → 뒤로가기) 중 `[nuxt] instance unavailable` 류 경고가 없어야 함.
3. **`/article/:id` breadcrumb 동작 변화**: SSR HTML의 breadcrumb 국가명이 이제 **국가 코드 폴백**(예: "US")으로 렌더링되고 클라이언트 마운트 후 국가명("United States")으로 치환된다 — 의도된 설계(P1-F3, 논블로킹). 하이드레이션 미스매치는 없음(클라이언트 초기 상태도 코드 폴백 → 패치 후 반응형 갱신). 단, 직전 페이지에서 countries 스토어가 이미 채워진 클라이언트 내비게이션 시에는 즉시 국가명 표시.
4. **미등록 국가 404 경로**: `[topic].vue`에서 articles 패칭이 countries 검증과 병렬로 시작되므로, 미등록 국가 접근 시 `/api/articles`가 한 번 호출(백엔드 404)된 뒤 페이지 404가 던져진다. 응답 계약은 동일하나 네트워크 탭에 404 요청 1건이 보일 수 있음 — 설계 D3(헛도는 비용 무시 가능)과 동일한 트레이드오프.
5. **에러 shape 의존**: `$fetch` 실패 시 FetchError의 `e.data.message`(서버 에러 envelope)를 우선 추출 — 백엔드 에러 envelope(`{ message }`)이 바뀌면 스토어 에러 메시지가 generic으로 폴백된다. 백엔드 P0/P1과 머지 후 4xx 응답에서 에러 메시지 표출 확인 요망.
6. **빈 페이지(범위 밖 page) 회귀**: `?page=999` 접근 시 items 빈 배열 + totalPages 정상(백엔드 폴백 count) — 프론트는 `totalPages > 1`일 때만 Pagination 렌더, 기존과 동일 로직.

## 6. 미완성 항목 / backend-dev 요청 사항

없음. API 계약(§4 동결) 그대로 사용 — backend-dev 변경과 머지 순서 무관.
