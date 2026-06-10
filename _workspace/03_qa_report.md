# 03_qa_report — 기사 조회 성능 개선 이터레이션 QA 검증

> 작성: qa / 2026-06-10
> 기준: `_workspace/00_architecture.md` §6 검증 기준, `01_frontend_done.md`, `02_backend_done.md`
> 검증 방식: 코드 정독(경계면 교차 비교) + 자동 검증(build/vitest/lint/typecheck) + 부분 런타임 스모크
> **전체 판정: PASS (조건부)** — Critical 0건, Major 0건, Minor 4건. 실 DB 스모크는 로컬 DB 부재로 미수행 → 스테이징/Vercel Preview에서 §5 잔여 항목 수행 필요.

---

## 1. 검증 항목별 결과 요약

| # | 항목 | 결과 | 근거 |
|---|---|---|---|
| A1 | raw SQL alias ↔ row 타입 ↔ DTO 필드명·타입 일치 | **통과** | §2.1 |
| A2 | raw SQL 컬럼명 ↔ migration.sql 실제 컬럼 전수 대조 (trending/trends 포함) | **통과** | §2.2 |
| A3 | `COUNT(*) OVER()` total 폴백 + totalPages 계산 | **통과** | §2.3 |
| A4 | 404 계약 (미등록 국가 / malformed id) — Promise.all 이후에도 404 선판정 | **통과** | §2.4 |
| A5 | 프론트 `$fetch` 전환부 (쿼리 구성·에러 핸들링·FRESH_MS 캐시) | **통과** (Minor-1) | §2.5 |
| A6 | `useAsyncData` 키/watch 배선/SSR 페이로드 직렬화 | **통과** (Nuxt 3.21.2 소스 레벨 확인) | §2.6 |
| A7 | SQL 인젝션 (태그드 템플릿 바인딩) | **통과** | §2.7 |
| B1 | 빌드 | **통과** (`npx nuxt build` exit 0) | §3 |
| B2 | `pnpm vitest run` | **통과** (15 파일 / 107 테스트 전부 passed) | §3 |
| B3 | `pnpm lint` | **통과** (0 errors; 기존 경고 1건) | §3 |
| B4 | `pnpm typecheck` (vue-tsc) | **통과** (exit 0) | §3 |
| C1 | 400 계약 런타임 채증 (articles country/topic, preview code/limit) | **통과** | §4 |
| C2 | `/api/trending`·`/api/home`·`/api/articles` 200 + shape, SSR HTML, hasContent 실값 | **미검증 (스킵)** — 로컬 DB 부재 | §4, §5 |

---

## 2. A. 경계면 교차 비교 상세

### 2.1 SQL alias ↔ row 타입 ↔ DTO — 일치 (통과)

`server/utils/repositories/articles.ts`:

- `findArticles`/`findLatestAcrossSources` SELECT alias 12종(`id,title,summary,link,imageUrl,publishedAt,hasContent,sourceId,sourceName,sourceCountryCode,sourceTopicSlug,total`) ↔ `ArticleListRawRow(+WithTotal)` 타입(articles.ts:45-60) 1:1 일치. 전부 따옴표 camelCase alias라 PG 소문자 폴딩 없음.
- `toArticleDTO`(articles.ts:62-78): `publishedAt: row.publishedAt.toISOString()` — Prisma가 TIMESTAMP를 JS Date로 역직렬화하므로 ISO 문자열 변환 유지. `hasContent`는 SQL boolean이 그대로 JS boolean. `summary ?? null`/`imageUrl ?? null` nullable 유지. 윈도우 `total`·flatten 컬럼이 DTO로 누수되지 않음 — `tests/api/articles-repository.spec.ts:123-128`이 키 집합까지 검증.
- `findRecentByCountry` lean row 6필드 ↔ `CountryPreviewRawRow` ↔ `CountryPreviewArticleDTO` 매핑(articles.ts:179-186) 일치. `tests/api/country-preview-contract.spec.ts:148-150` 키 집합 검증.
- `COUNT(*)::int`, `COUNT(*) OVER()::int`, `ROUND(...)::float` 등 모든 집계가 int/float로 캐스팅됨 — BigInt/Decimal 직렬화 함정 없음.
- `types/dto.ts` 무수정 (git diff 대상 아님) — API 계약 동결 준수 확인.

### 2.2 raw SQL 컬럼명 ↔ migration 실제 컬럼 — 전수 대조 일치 (통과)

`prisma/migrations/20260424054909_/migration.sql` + `20260424134100_article_content_html/migration.sql` 기준:

| 테이블 | 실제 컬럼(따옴표 camelCase) | 사용처 | 판정 |
|---|---|---|---|
| Article | `id,sourceId,title,summary,link,imageUrl,publishedAt,fetchedAt,contentHtml` | articles.ts(3개 쿼리+upsert), trending.ts, trends.ts | 일치 |
| Source | `id,countryCode,topicSlug,name,feedUrl,enabled,…` | 동일 | 일치 |
| Country | `code,nameEn,nameKo` | trending.ts (`c."code"`, `c."nameEn"`) | 일치 |

- **수정 전 채증(정적)**: `git show HEAD:…/trending.ts`·`trends.ts` 모두 비따옴표 snake_case(`a.published_at`, `s.country_code`, `c.name_en` 등) 사용 → PG 소문자 폴딩 시 `column "published_at" does not exist` 확정 — **수정 전 `/api/trending`·`/api/countries/:code/trends`는 실 DB에서 500이었음이 코드상 확실**. 실 DB 500 채증 자체는 DB 부재로 불가(§5).
- 수정 후: 따옴표 camelCase로 전면 교체. CTE 자체 alias(`today_count`, `total_7d`)는 자기 정의 소문자라 무관. trends.ts의 출력 alias `AS topic / date / count`는 비따옴표 소문자 폴딩 결과가 DTO(`{topic,date,count}`)와 일치. trending DTO alias(`AS "countryCode"` 등)는 따옴표 camelCase로 `TrendingItemDTO`와 일치 — 응답 shape 불변.
- trending today/baseline CTE 양쪽에 `s."enabled"` 필터 추가 확인(trending.ts:17,28) — 설계 P1-B3 의도 반영.

### 2.3 total 폴백 / totalPages — 정확 (통과)

- `findArticles`(articles.ts:108-120): `rows.length===0 && page>1`일 때만 `prisma.article.count` 폴백 — where(`source.countryCode/topicSlug/enabled:true`)가 raw WHERE(`s."countryCode"/s."topicSlug"/s."enabled"`)와 의미 동일. page=1 & 0행은 total 0 즉시 반환(쿼리 1회). 정상 경로는 `rows[0]?.total ?? 0`.
- OFFSET `(page-1)*pageSize` — 단위 테스트가 page=9/pageSize=20 → 160 바인딩까지 검증.
- `articles.get.ts:73`: `totalPages = Math.ceil(total/pageSize)` — pageSize는 1..50 검증 후라 0 나눗셈 불가. 기존 계산식과 동일.

### 2.4 404 계약 — 유지 (통과)

- `articles.get.ts:56-71` / `preview.get.ts:43-58`: `Promise.all([존재성, 본쿼리])` 후 `!exists`/`!country`를 **먼저** 판정해 404 throw — 본 쿼리 결과는 폐기. 응답 envelope(`data:{statusCode,statusMessage,message}`) 기존과 동일.
- 입력 검증 400은 Promise.all **이전** 선행 — 순서 보존.
- malformed article id: `/api/articles/:id` 및 `findArticleById`는 이번 미수정 — contentHtml NULL → null → 404 계약 유지(코드 확인).
- 관찰(버그 아님): DB 장애 + 미등록 국가 동시 발생 시 Promise.all이 본 쿼리 rejection을 먼저 전파해 404 대신 500이 날 수 있음 — 설계 D3의 의도된 트레이드오프 범위로 판단(§6-O1).

### 2.5 프론트 `$fetch` 전환 — 회귀 없음 (통과, Minor-1)

- `stores/articles.ts:74-84`: `$fetch<ArticlesResponseDTO>('/api/articles',{query})` — query 구성(country 대문자화/topic/page/pageSize 조건부) 기존과 동일. FRESH_MS(2분) 캐시(:58-59)·`currentKey` 갱신 로직 무변경. `stores/countries.ts:54` 동일 패턴.
- try/catch 에러 추출 로직은 diff상 무변경(동일 코드 유지)이나, **추출 대상이 잘못된 계층**임을 런타임으로 확인(Minor-1, §6).

### 2.6 useAsyncData 키/watch/SSR 직렬화 — 정상 (통과)

Nuxt **3.21.2** 설치본 소스(`node_modules/nuxt/dist/app/composables/asyncData.js`)로 직접 검증:

- **하이드레이션 중복 패칭 차단**: 기본 `getCachedData`는 `isHydrating`일 때만 `payload.data[key]` 반환(:454-457) → SSR이 넣은 boolean payload가 클라이언트 첫 로드의 핸들러 재실행을 막음. 기사 데이터 자체는 `@pinia/nuxt`(nuxt.config.ts:15 등록 확인) 스토어 직렬화로 전달 — `currentKey`까지 함께 직렬화되므로 표시 일관성 유지.
- **뒤로가기/재방문 시 stale 위험 없음**: 언마운트 시 `_deps→0`이면 `purgeCachedData`로 payload/`_asyncData` 엔트리 퍼지(:440) + 하이드레이션 이후 `getCachedData`가 undefined 반환 → 재마운트 시 핸들러 재실행 → `store.load`가 `currentKey`를 올바르게 재설정. (핸들러 스킵 시 `currentKey`가 직전 페이지를 가리키는 시나리오를 의심했으나 소스 확인 결과 발생하지 않음.)
- **watch 배선**: `watch:[country,topic,page]` — watch 트리거 execute는 cause≠initial이라 캐시 체크를 건너뛰고 항상 핸들러 실행 → 페이지네이션(?page=) 같은 컴포넌트 재사용 내비게이션에서 재로드 보장. fresh 페이지는 store가 fetch 생략.
- **키 설계**: `articles:{C}:{T}:{P}` 초기 파라미터 기반 정적 키 — [topic].vue는 path 파라미터 변경 시 페이지 컴포넌트가 재생성되므로 키 충돌 없음. `useArticles` 호출처는 [topic].vue 1곳뿐(전수 grep). `country-header-*`/`countries-hydrate*`/`country-meta-*` 키들은 전부 멱등 핸들러(fetchIfStale)라 캐시 스킵에도 안전.
- **[topic].vue 병렬화**: `useAsyncData`(non-await)와 `useArticles().asyncData`를 `await Promise.all`(:50) — SSR = max(countries, articles), 404 체크는 Promise.all 이후(:54). `index.vue`는 `useHomeFeatured()`(non-lazy useFetch, `onServerPrefetch` 자동 등록)를 countries await 앞으로 이동 — SSR HTML에 featured 포함 유지하면서 병렬. `article/[id].vue` countries는 `{server:false, lazy:true}` 논블로킹 — SSR/클라이언트 초기 상태 모두 코드 폴백이라 하이드레이션 미스매치 없음.

### 2.7 SQL 인젝션 — 안전 (통과)

- 4개 raw 쿼리(findArticles/findLatestAcrossSources/findRecentByCountry/findTrends) + upsertArticle 모두 `prisma.$queryRaw` **태그드 템플릿** — 모든 사용자 유래 값(country, topic, pageSize, offset, limit, since)이 플레이스홀더 바인딩. 문자열 연결/`$queryRawUnsafe` 사용 없음(전수 확인). country/topic/limit는 핸들러에서 정규식·화이트리스트 선검증까지 이중 방어. 단위 테스트가 바인딩 파라미터 배열을 직접 검증(articles-repository.spec.ts:145,187 / country-preview-contract.spec.ts:162).

---

## 3. B. 자동 검증 실행 결과

| 명령 | 결과 | 비고 |
|---|---|---|
| `npx nuxt build` | **exit 0** — "✨ Build complete!" (총 5.25 MB / gzip 1.44 MB) | `pnpm build` 전체 스크립트는 `prisma migrate deploy`가 `DATABASE_URL`/`DIRECT_URL`을 요구 — 로컬 `.env` 부재로 실행 불가(코드와 무관한 환경 제약, 양 dev 보고서와 동일 결론) |
| `pnpm vitest run` | **Test Files 15 passed (15) / Tests 107 passed (107)**, 1.64s | 신규 `articles-repository.spec.ts` 6건, 갱신 `country-preview-contract.spec.ts` 10건 포함 |
| `pnpm lint` | **0 errors** (warning 1: `components/ArticleContent.vue:12 vue/no-v-html`) | 경고는 이번 변경 무관·기존 존재(서버측 sanitize-html 처리됨) |
| `pnpm typecheck` | **exit 0** | vue-tsc 에러 0 |

## 4. C. 런타임 스모크 (부분 수행)

로컬 환경: `.env` 없음, `localhost:5432` ECONNREFUSED → **실 DB 연결 불가**. `npx nuxt dev --port 4173`로 서버 기동 후 DB 비의존 경로만 채증, 종료 완료.

| 요청 | 결과 |
|---|---|
| `GET /api/articles?country=USA&topic=politics` | **400**, `data.message: 'Query param "country" must be ISO-3166 alpha-2.'` — envelope 계약 유지 |
| `GET /api/articles?country=US&topic=nope` | **400**, topic 화이트리스트 메시지 정상 |
| `GET /api/countries/US/preview?limit=99` | **400**, limit 1..5 메시지 정상 |
| `GET /api/countries/USA/preview` | **400**, code alpha-2 메시지 정상 |
| `GET /api/articles?country=US&topic=politics` (유효) | 500 — `Environment variable not found: DATABASE_URL` (환경 제약, 코드 무관) |
| `GET /api/trending`, `GET /api/home` | 동일 사유 500 — **케이싱 수정의 실 DB 200 채증은 미검증으로 이관(§5)** |

## 5. 미검증 항목 — 실 DB 환경(스테이징/Vercel Preview)에서 수행 필요

1. `/api/trending`·`/api/countries/:code/trends` **200 채증** (P1-B3 최종 근거 — 단위 테스트는 SQL 텍스트만 검증)
2. `curl /country/US/politics` view-source — SSR HTML 기사 제목 포함 (P1-F2 핵심 목표)
3. `ArticlesResponseDTO` byte-level shape (items[].hasContent boolean 실값 true/false 케이스, `contentHtml` 필드 부재)
4. `?page=999` total/totalPages 폴백 실측
5. `prisma.ts` `log:['query']` 계측 — 요청당 쿼리 수 4→2(articles), 2→1(home), 3→2(preview)
6. 클라이언트 내비게이션 콘솔에서 `[nuxt]` 컨텍스트 경고 0건 (브라우저 E2E)
7. 미등록 국가(`/api/articles?country=ZZ&topic=politics`) 실 DB 404 채증

## 6. 발견 버그 / 관찰 목록

**Critical: 0건 / Major: 0건**

| # | 심각도 | 위치 | 내용 | 재현 |
|---|---|---|---|---|
| M1 | Minor (기존 결함, 회귀 아님) | `stores/articles.ts:86`, `stores/countries.ts:58` | 에러 메시지 추출 `e.data.message`가 h3 직렬화의 **top-level message(=statusMessage 코드, 예: "BAD_REQUEST"/"NOT_FOUND")**를 집음. 사람이 읽을 메시지는 `e.data.data.message`에 있음(§4 런타임 채증으로 확인). UI 에러 문구가 "NOT_FOUND" 같은 코드로 표시됨. `01_frontend_done.md` 주의점 5의 "서버 에러 envelope `{message}` 우선 추출" 설명은 부정확 | 미등록 국가로 `/country/ZZ/politics` 접근 후 store.error 확인 |
| M2 | Minor (설계 확인 필요 → architect 에스컬레이션) | `server/utils/repositories/trends.ts:19-29` | `s."enabled"` 필터 부재 — 비활성 소스 기사가 trends 차트에 집계됨. trending에는 추가됐으나 trends는 설계 P1-B3가 명시하지 않아 backend-dev가 의도적으로 보류(02_backend_done #5). 일관성 판단 필요 | 비활성 소스 보유 국가의 `/country/:code/trends` 집계 비교 |
| O1 | 관찰 (조치 불필요) | `server/api/articles.get.ts:56`, `preview.get.ts:43` | DB 장애 시 미등록 국가 요청이 404 대신 500이 될 수 있음(Promise.all rejection 선전파). 정상 DB에서는 계약 동일 — 설계 D3 트레이드오프 범위 | DB 다운 상태에서 미등록 국가 요청 |
| O2 | 관찰 (기존, 무해) | `stores/articles.ts:36-38` | `makeKey`에 pageSize 미포함 — 같은 (country,topic,page)에 다른 pageSize 요청 시 캐시 충돌. 현재 앱은 pageSize 20 단일 사용이라 실영향 없음 | 코드 리뷰 |

## 7. 성능 개선 확인 (코드 근거)

| 경로 | Before | After | 근거 |
|---|---|---|---|
| `GET /api/articles` | 직렬 3단계 ≈ 4쿼리 (countryExists → count∥findMany → hasContent PK-IN) | **병렬 1단계 2쿼리, 직렬 의존 0** (countryExists ∥ 단일 raw + `COUNT(*) OVER()`) | articles.get.ts:56-59, articles.ts:91-106 |
| `GET /api/home` | 2단계 2쿼리 | **1단계 1쿼리** (hasContent 인라인) | articles.ts:131-143, home.get.ts:11 |
| `GET /api/countries/:code/preview` | 직렬 3단계 3쿼리 | **병렬 1단계 2쿼리** | preview.get.ts:43-46, articles.ts:166-177 |
| `/api/trending`·`/api/…/trends` | 케이싱 불일치로 잠재 500 (HEAD 코드로 확정적) | 가용성 확보 (쿼리 수 불변 1회) + enabled 누수 차단(trending) | trending.ts/trends.ts 전면 camelCase |
| `/country/:code/:topic` SSR | countries await → articles watch(SSR 포함 미보장) | countries ∥ articles `Promise.all` — SSR=max, **기사 목록 SSR HTML 포함 보장**(useAsyncData await) | [topic].vue:37-50 |
| `/` SSR | countries → featured 직렬 | featured 선호출로 병렬 (onServerPrefetch 유지) | index.vue:25-31 |
| `/article/:id` SSR | detail → countries 직렬 (countries 렌더 블로킹) | countries `{server:false,lazy:true}` 논블로킹 — SSR=detail 1회분 | [id].vue:37-44 |
| 구조 | Pinia action 내 `useFetch` (컨텍스트 상실 위험) | `$fetch` + 페이지/composable 레벨 `useAsyncData` 래퍼 | stores/*.ts, useArticles.ts:53-66 |

불변식 유지: 목록 쿼리에서 `contentHtml` 본문 비선택(`IS NOT NULL` 단일 언급 — 테스트로 고정), TOAST 본문 미접근. 인덱스 추가/마이그레이션 없음(설계 §1.2 그대로).

## 7.5 [추가] Vercel Preview 실 DB 스모크 결과 (2026-06-10, PR #1)

§5로 이관했던 미검증 항목을 Preview 배포(`vercel curl` 바이패스)에서 수행 — **전 항목 통과**:

| 항목 | 결과 |
|---|---|
| `/api/trending` | **200, items 15** (구 코드 프로덕션 배포에서 500 채증 — P1-B3 수정 가치 실증) |
| `/api/articles?country=US&topic=politics` | 200 — total 2945, items 20, `hasContent` boolean, `contentHtml` 부재, `publishedAt` ISO |
| `?page=999` | 200 — items 0, total 2945, totalPages 148 (count 폴백 정상) |
| `/api/home` / `/api/countries/US/preview` / `/api/countries/US/trends` | 모두 200 |
| 미등록 국가 `country=ZZ` | 404, envelope `data.message: 'Country "ZZ" is not registered.'` |
| `/country/US/politics` SSR HTML | **기사 제목 20/20 포함**, h1·total 렌더링 — 단, 아래 신규 발견 수정 후 |

**신규 Critical 발견·수정 (커밋 2cc328e):** `app.vue`의 `<ColorScheme placeholder="...">` 래퍼가 preference `system`(서버 미상) 시 SSR에서 placeholder만 렌더링 → **모든 페이지가 빈 `<span>...</span>` 셸로 서빙** (프로덕션 동일 채증 — 기존 결함, 본 PR 회귀 아님). SEO 전면 무력화 + 기사 목록 SSR 미포함의 실제 원인. 래퍼 제거로 수정, prerender `/about` 산출물·Preview SSR HTML로 복구 검증.

## 8. 결론

- **Critical/Major 버그 없음. 코드 레벨 검증·자동 검증 전부 통과 → PASS.**
- 단, §5의 실 DB 스모크 7항목(특히 trending 200, SSR HTML 채증)은 DB 자격증명이 있는 환경에서 머지 전후 수행을 권장한다.
- M1(에러 메시지 계층)·M2(trends enabled 필터)는 후속 이터레이션 백로그로 오케스트레이터에 전달.
