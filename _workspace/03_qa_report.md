# QA 보고서 — 이터레이션 6 (커버리지 확장 + 트렌드 탭)

**날짜:** 2026-04-25  
**담당:** qa  
**기반 문서:** `_workspace/00_architecture.md`, `01_frontend_done.md`, `02_backend_done.md`

---

## 1. 검증 항목별 결과

| # | 검증 항목 | 결과 | 비고 |
|---|----------|------|------|
| 1-1 | `types/dto.ts` TopicSlug 8개 | PASS | military/economy/politics/environment/technology/health/culture/sports |
| 1-2 | `types/dto.ts` TrendDataPointDTO 정의 | PASS | topic: string, date: string, count: number |
| 1-3 | `types/dto.ts` TrendsResponseDTO 정의 | PASS | `{ items: TrendDataPointDTO[] }` |
| 1-4 | `types/domain.ts` TOPIC_SLUGS 8개 | PASS | as const readonly 배열 |
| 1-5 | `types/domain.ts` TOPIC_META 8개 키 | PASS | TOPIC_SLUGS ↔ TOPIC_META keys 1:1 동치 (테스트 강제) |
| 2-1 | API 핸들러 반환 타입 ↔ TrendsResponseDTO | PASS | `Promise<TrendsResponseDTO>` 명시 |
| 2-2 | `findTrends()` 반환 타입 | PASS | `Promise<TrendDataPointDTO[]>` — `$queryRaw<Array<{topic,date,count: number}>>` |
| 2-3 | COUNT(*)::int 캐스팅 | PASS | SQL에 `COUNT(*)::int` 명시, BigInt → number 방어 |
| 2-4 | `CountryTrendsChart.vue` useFetch 제네릭 | PASS | `useFetch<TrendsResponseDTO>(...)` |
| 2-5 | TrendDataPointDTO.count number 타입 | PASS | `$queryRaw` 제네릭 `count: number` 명시 + `::int` 캐스팅 |
| 2-6 | TopicTabs Trends active 로직 | PASS | `route.path.endsWith('/trends')` computed |
| 3-1 | `pnpm test` | PASS | 10 files, 67 tests |
| 3-2 | `pnpm typecheck` | PASS | 에러 없음 (경고 3개는 기존 모듈 호환성 경고) |
| 3-3 | `pnpm lint` | **FAIL** | 29 errors (comma-dangle) — 상세 §2 |
| 4-1 | ISO_ALPHA2 검증 (`trends.get.ts`) | PASS | `/^[A-Z]{2}$/`, `toUpperCase()` 후 테스트 |
| 4-2 | VALID_DAYS 검증 | PASS | `new Set([7, 30, 90])` 화이트리스트 |
| 4-3 | 404 처리 (countryExists) | PASS | `countryExists()` false → createError 404 |
| 4-4 | ChartJS 컴포넌트 등록 | PASS | `ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)` |
| 4-5 | lazy useFetch 패턴 | PASS | `lazy: true` |
| 4-6 | `prisma/seed.ts` TOPICS 8개 | PASS | |
| 4-7 | `prisma/seed.ts` COUNTRIES 50개 | PASS | 10 MVP + 20 Feature G + 20 Iteration 6 = 50 |
| 4-8 | `pages/country/[code]/trends.vue` isIsoCountryCode 가드 | PASS | |
| 4-9 | `pages/country/[code]/trends.vue` countriesStore 사용 패턴 | PASS | `useAsyncData` + `fetchIfStale()` |
| 5-1 | `days` ref useFetch query 전달 | PASS | `{ query: { days } }` — ref를 그대로 전달하여 reactive refetch |
| 5-2 | TOPIC_META 신규 토픽 슬러그 존재 여부 | PASS | 8개 모두 TOPIC_META에 키 존재 |
| 5-3 | TopicTabs TOPIC_SLUGS 루프 8개 렌더링 | PASS | `v-for="slug in TOPIC_SLUGS"` — 8개 |
| 5-4 | seed.ts feedUrl 유일성 | **FAIL** | 중복 1건 (§2 BUG-02) |

---

## 2. 발견된 버그

### BUG-01 — `pnpm lint` comma-dangle 에러 29건 (High)

**심각도:** High  
**영향 파일:**
- `components/CountryTrendsChart.vue` (9건)
- `types/domain.ts` (7건)
- `server/api/countries/[code]/trends.get.ts` (3건)
- `prisma/seed.ts` (3건)
- `server/api/articles.get.ts` (1건)
- `tests/api/articles-validation.spec.ts` (1건)
- `tests/unit/domain.spec.ts` (1건)
- `pages/country/[code]/trends.vue` (1건)
- `server/utils/services/sourceAdmin.ts` (1건)
- `components/WorldMap.vue` (2건, 기존 파일)

**재현:** `pnpm lint` 실행 시 exit code 1

**원인:** 이터레이션 6에서 추가된 코드 전반에 trailing comma가 삽입됨. 프로젝트 ESLint 설정이 `comma-dangle: error` (never)로 설정되어 있으나 새 코드가 이를 준수하지 않음.

**수정 방법:** `pnpm lint --fix` 실행 후 변경 내용 확인. 또는 각 파일에서 trailing comma 수동 제거.

---

### BUG-02 — `prisma/seed.ts` feedUrl 중복 (Critical)

**심각도:** Critical  
**위치:** `prisma/seed.ts` line 516, line 917

```
line 516:  AU / military / 'ABC News Australia — Defence'     → feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml'
line 917:  AU / environment / 'ABC Environment'               → feedUrl: 'https://www.abc.net.au/news/feed/51120/rss.xml'
```

**영향:** `Source.feedUrl`은 `@unique` 제약이 있으므로 `pnpm prisma:seed` 실행 시 두 번째 upsert가 첫 번째 소스를 `countryCode: AU, topicSlug: environment`로 덮어씀. 결과적으로 AU/military 소스 1건이 사라지고 동일 URL이 environment 소스로 등록됨.

**수정 방법:** line 917의 AU environment ABC Environment feedUrl을 검증된 다른 환경 RSS URL로 교체하거나, line 916–917 행을 `// REVIEW` 처리하고 플레이스홀더로 대체.

---

## 3. 명령어 실행 결과 요약

### `pnpm test`
```
Test Files  10 passed (10)
Tests       67 passed (67)
Duration    626ms
```
**결과: PASS**

### `pnpm typecheck`
```
PASS — no TypeScript errors
(경고 3건: @nuxt/ui, @nuxt/icon 버전 비호환, robots.txt — 모두 기존 환경 경고, 이터레이션 6 무관)
```
**결과: PASS**

### `pnpm lint`
```
30 problems (29 errors, 1 warning)
- 29 errors: comma-dangle (trailing comma)
- 1 warning: vue/no-v-html in ArticleContent.vue (기존)
```
**결과: FAIL**

---

## 4. 수정 권장 사항

| 우선순위 | 항목 | 대상 | 조치 |
|---------|------|------|------|
| 1 | BUG-02 feedUrl 중복 | `prisma/seed.ts:917` | AU environment 소스 URL 교체 또는 주석 처리 |
| 2 | BUG-01 lint 에러 | 이터레이션 6 신규/수정 파일 | `pnpm lint --fix` 실행 후 커밋 |

WorldMap.vue의 comma-dangle 2건은 이터레이션 6 이전부터 존재했을 가능성이 있으나, 이번 이터레이션 수정 범위에서 함께 수정하는 것이 바람직함.

---

## 5. 전체 판정

**불합격 (FAIL)**

- `pnpm lint` 29개 에러로 CI 파이프라인 차단
- `prisma/seed.ts` feedUrl 중복으로 시드 실행 시 AU/military 소스 데이터 오염

두 버그 수정 후 재검증 필요. 타입 계약, API 계약, 렌더링 로직, 테스트 커버리지는 모두 정상.
