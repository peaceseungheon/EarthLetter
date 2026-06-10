# EarthLetter — 기사 조회 성능 개선 이터레이션 (아키텍처 설계)

> 작성: architect / 2026-06-10
> 트리거: 사용자 보고 "기사 조회가 느리다"
> 원칙: 측정 가능한 조회 지연 감소에 집중. API 응답 shape(types/dto.ts)은 동결 — 프론트/백 병렬 작업을 보장한다.

---

## 1. 현황 진단 — 병목은 인덱스가 아니라 "왕복 횟수"다

### 1.1 전제: DB 연결 토폴로지

- Postgres (Supabase 패턴: `DATABASE_URL` 풀러 + `DIRECT_URL`, `prisma/schema.prisma:9-13`)
- 서버리스(Vercel) 핸들러 → 풀러 경유 쿼리 1회당 네트워크 RTT가 수십~백수십 ms.
  **순차 쿼리 1개를 줄이는 것 = 사용자 체감 지연 1 RTT 감소.** ingest 경로에서 동일 결론으로
  왕복 2→1 단축해 504를 해소한 선례가 있다(커밋 388ac8f, `upsertArticle`의 CTE 단일 쿼리 — `server/utils/repositories/articles.ts:237-271`).

### 1.2 인덱스 점검 결과: 추가 마이그레이션 불필요

`prisma/schema.prisma` + `prisma/migrations/20260424054909_/migration.sql:44-57` 확인:

| 쿼리 패턴 | 사용 인덱스 | 판정 |
|---|---|---|
| 목록: `source.countryCode+topicSlug` 필터 → `publishedAt DESC` 정렬 | `Source(countryCode, topicSlug)` + `Article(sourceId, publishedAt DESC)` | 충분 |
| 홈: 전체 최신 N (`publishedAt DESC LIMIT 12`) | `Article(publishedAt DESC)` | 충분 |
| 트렌딩: 최근 8일 범위 스캔 | `Article(publishedAt DESC)` | 충분 |
| `hasContent` PK-IN 조회 | PK(`id`) | 충분 |

prune(`pruneOlderThan`, articles.ts:277-286)이 테이블 크기를 상한 유지하므로 OFFSET 페이지네이션도
현 규모에서 비효율 아님. **풀스캔 문제 없음 → 이번 이터레이션에 DB 마이그레이션 없음.**

### 1.3 진짜 병목 ①: API 1건당 순차 DB 왕복 3~4회 (백엔드)

| 엔드포인트 | 현재 순차 왕복 | 근거 (파일:라인) |
|---|---|---|
| `GET /api/articles` | **3단계** (≈4쿼리): ① `countryExists` await → ② `count` ∥ `findMany` → ③ `resolveHasContentSet` | `server/api/articles.get.ts:54,66` → `server/utils/repositories/articles.ts:102-113` |
| `GET /api/home` | **2단계**: ① `findMany` → ② `resolveHasContentSet` | `server/api/home.get.ts:11` → `articles.ts:127-135` |
| `GET /api/countries/:code/preview` | **3단계**: ① `findCountryByCode` await → ② `findMany` → ③ `resolveHasContentSet` | `server/api/countries/[code]/preview.get.ts:41,54` → `articles.ts:147-159` |

`resolveHasContentSet`(articles.ts:85-92)은 "목록에서 contentHtml 본문을 SELECT하지 않는다"는
올바른 불변식(invariant 1, articles.ts:8-12)을 지키려고 도입됐지만, **별도 왕복** 대신
SQL 한 줄(`a."contentHtml" IS NOT NULL`)로 같은 결과를 얻을 수 있다. NULL 체크는 메인 튜플에서
끝나므로 TOAST 본문을 읽지 않는다 — 불변식은 그대로 유지된다.

`countryExists` / `findCountryByCode` 선행 await는 404 구분용인데, 본 쿼리와 **직렬**일 이유가 없다.

### 1.4 진짜 병목 ②: 프론트 SSR 워터폴 (페이지당 직렬 패칭)

| 페이지 | 워터폴 | 근거 |
|---|---|---|
| `pages/country/[code]/[topic].vue` (핵심 SEO 표면) | ① countries fetch를 `await` 완료 후에야 → ② 기사 목록 로드 시작 | `[topic].vue:26-29` (await) → `:45-50` (`useArticles` → watch immediate) |
| `pages/index.vue` | ① countries `await` → ② `useHomeFeatured()` 시작 | `index.vue:23-26` → `:30` |
| `pages/article/[id].vue` | ① 기사 detail `await` → ② countries `await` (breadcrumb 이름 표시 용도일 뿐인데 렌더 블로킹) | `[id].vue:17-20` → `:35-38` |

추가 구조 문제: `stores/articles.ts:71-77`이 **Pinia action 내부에서 `useFetch`를 호출**한다.
`useFetch`는 setup 컨텍스트 전용 — watch 콜백 경유 호출(`composables/useArticles.ts:41-47`)은
컨텍스트 상실 경고·중복 패칭·SSR 대기 보장 불가의 원인이다. action에서는 `$fetch`가 정답이다.

체감 효과: `[topic].vue` 한 번 로드 = (countries RTT) + (articles API RTT × 서버내 DB 3단계).
직렬 합산이 "기사 조회가 느리다"의 정체다.

### 1.5 부수 발견 (P1 동반 수정): raw SQL 컬럼 케이싱 불일치 — 잠재 500

마이그레이션은 **camelCase 따옴표 컬럼**(`"publishedAt"`, `"sourceId"`, `"countryCode"` —
`migration.sql:31-42`)을 생성했고 `upsertArticle` raw SQL도 camelCase를 쓴다(articles.ts:245-263).
그런데 아래 두 파일은 **snake_case 비따옴표 식별자**를 사용한다:

- `server/utils/repositories/trending.ts:7-37` — `a.published_at`, `s.country_code`, `a.source_id`, `c.name_en`
- `server/utils/repositories/trends.ts:18-26` — 동일 패턴

Postgres에서 비따옴표 식별자는 소문자로 폴딩되므로 `published_at ≠ "publishedAt"` →
`column does not exist` 런타임 에러 가능성이 높다. `/api/trending`과 `/api/countries/:code/trends`가
실 DB에서 동작하는지 **QA가 최우선 검증**하고, 케이싱을 camelCase로 통일 수정한다.
(조회 성능 이전에 조회 자체가 깨졌을 수 있는 경로.)

---

## 2. 핵심 설계 결정 (Why)

### D1. `hasContent`는 "SQL 계산 컬럼"으로 — 별도 왕복/비정규화 둘 다 기각

| 선택지 | 왕복 | 마이그레이션 | 진실 공급원 | 판정 |
|---|---|---|---|---|
| 현행: PK-IN 2차 쿼리 | +1 | 불필요 | 단일 | 느림 |
| 비정규화 `hasContent` 컬럼 | 0 | **필요** + ingest 쓰기 경로 수정 | 이중(드리프트 위험) | 과투자 |
| **`(contentHtml IS NOT NULL) AS "hasContent"` 인라인** | **0** | **불필요** | **단일** | **채택** |

### D2. 목록 쿼리는 `$queryRaw` 단일 쿼리로 통합 — `COUNT(*) OVER()` 윈도우로 total 동봉

Prisma `findMany`는 계산 컬럼·윈도우 함수를 select할 수 없다. 이미 이 레포지토리에는
`$queryRaw` 선례(`upsertArticle`)와 컨벤션(camelCase 따옴표 + `AS "camelAlias"`)이 있다.
`COUNT(*) OVER()`는 별도 `count` 쿼리와 스캔 비용이 같지만 **왕복 1회를 절약**한다.

엣지 케이스: 범위 밖 page 요청 → 0행 → total 도출 불가. 이때만 `prisma.article.count` 폴백
(희귀 경로, 정상 경로 비용 0).

### D3. 존재성 체크(404 구분)는 본 쿼리와 `Promise.all` 병렬화

검증용 쿼리를 없애지 않는다(404 계약 유지) — 직렬을 병렬로 바꿀 뿐.
미등록 국가일 때 본 쿼리가 헛도는 비용은 0행 반환(인덱스 히트)으로 무시 가능.

### D4. 프론트는 "구조 교체"가 아니라 "직렬 → 병렬 + 올바른 프리미티브"

Pinia 스토어 캐시(2분 fresh, `stores/articles.ts:34,58-59`)는 클라이언트 페이지 전환 UX에
유효하므로 유지한다. 바꾸는 것은 두 가지뿐:
1. action 내부 `useFetch` → `$fetch` (컨텍스트-안전, 스토어가 자체 캐시 담당)
2. 페이지 setup에서 독립 패칭들을 `Promise.all`로 병렬화하고, SSR 대기가 필요한 것만
   `await useAsyncData(...)`로 감싼다 (Nuxt가 페이로드 직렬화·하이드레이션 중복 제거 담당)

### D5. 이번에 하지 않는 것 (스코프 가드)

- 커서 기반 페이지네이션: prune로 테이블이 작아 OFFSET 비용 미미. 측정 근거 없는 리팩터링 금지.
- `country/[code]/index.vue`의 토픽별 3회 호출 배치화(단일 `overview` 엔드포인트 + `ROW_NUMBER()`):
  P0/P1 적용 후 측정해서 여전히 느릴 때 후속 이터레이션으로. (이미 3회 호출 자체는 병렬이고
  routeRules swr 600으로 엣지 캐시됨. P0가 호출당 내부 왕복을 줄이면 자동으로 함께 개선된다.)
- Nitro `cachedEventHandler` 도입: 핸들러별 `Cache-Control s-maxage`가 이미 있어 Vercel CDN
  캐시로 충분. 이중 캐시 레이어는 무효화 복잡도만 추가.

---

## 3. 개선 설계 — 우선순위별 작업 항목

### P0-B1. `findArticles` 단일 쿼리화 (효과 최대)

- **변경 파일**: `server/utils/repositories/articles.ts`, `server/api/articles.get.ts`
- **변경 내용**:
  - `findArticles`를 `$queryRaw` 단일 쿼리로 재작성:
    ```sql
    SELECT a."id", a."title", a."summary", a."link", a."imageUrl", a."publishedAt",
           (a."contentHtml" IS NOT NULL)        AS "hasContent",
           s."id"          AS "sourceId",
           s."name"        AS "sourceName",
           s."countryCode" AS "sourceCountryCode",
           s."topicSlug"   AS "sourceTopicSlug",
           COUNT(*) OVER()::int                 AS "total"
    FROM   "Article" a
    JOIN   "Source"  s ON s."id" = a."sourceId"
    WHERE  s."countryCode" = ${country} AND s."topicSlug" = ${topic} AND s."enabled"
    ORDER  BY a."publishedAt" DESC
    LIMIT  ${pageSize} OFFSET ${(page - 1) * pageSize}
    ```
    행 0개 + `page > 1`이면 `prisma.article.count({ where })` 폴백으로 total 산출.
    반환 타입 `FindArticlesResult`(items/total)는 **불변** — DTO 매핑 함수에서 raw row →
    `ArticleDTO` 변환 (`publishedAt.toISOString()` 유지).
  - `articles.get.ts:54-66`: `countryExists`와 `findArticles`를 `Promise.all`로 병렬 실행 후
    미등록 국가면 404 (응답 계약 동일).
- **기대 효과**: 핵심 목록 API의 DB 직렬 단계 3 → 1 (왕복 4 → 병렬 2). RTT 100ms 가정 시
  API당 약 200ms 단축. `country/[code]/index.vue`의 3회 병렬 호출에도 동일 배율 적용.

### P0-B2. `findLatestAcrossSources` / `findRecentByCountry` 동일 패턴 적용

- **변경 파일**: `server/utils/repositories/articles.ts`, `server/api/countries/[code]/preview.get.ts`
- **변경 내용**:
  - `findLatestAcrossSources`(홈): hasContent 인라인 단일 raw 쿼리 (total 불필요, LIMIT N).
  - `findRecentByCountry`(프리뷰): 동일 + lean select(id/title/publishedAt/sourceName/topicSlug) 유지.
  - `preview.get.ts:41-54`: `findCountryByCode` ∥ `findRecentByCountry` `Promise.all` 병렬화.
  - `resolveHasContentSet` 호출처가 사라지면 함수 삭제.
- **기대 효과**: `/api/home` 2→1단계, `/api/countries/:code/preview` 3→1단계.
  글로브 호버 프리뷰 반응성 직접 개선.

### P1-B3. trending/trends raw SQL 케이싱 수정 (조회 가용성)

- **변경 파일**: `server/utils/repositories/trending.ts`, `server/utils/repositories/trends.ts`
- **변경 내용**: snake_case 식별자(`a.published_at`, `s.country_code`, `s.topic_slug`,
  `a.source_id`, `c.name_en`) → 마이그레이션 실제 컬럼명인 따옴표 camelCase
  (`a."publishedAt"`, `s."countryCode"`, …)로 전면 교체. `upsertArticle`(articles.ts:240-269)
  컨벤션과 통일. **반환 DTO alias(`AS "countryCode"` 등)는 이미 camelCase라 응답 shape 불변.**
- **기대 효과**: `/api/trending`·`/api/countries/:code/trends` 런타임 에러 제거(또는 위험 해소).
  trending 쿼리에 `s."enabled"` 필터 부재도 이때 함께 점검(비활성 소스 집계 누수).

### P1-F1. `stores/articles.ts` — action 내 `useFetch` → `$fetch`

- **변경 파일**: `stores/articles.ts` (load action, :71-77)
- **변경 내용**: `useFetch` 호출을 `$fetch<ArticlesResponseDTO>('/api/articles', { query })`로
  교체. 기존 try/catch 에러 메시지 추출 로직(:90-93)과 FRESH_MS 캐시는 유지.
  `stores/countries.ts:51-54`의 동일 패턴(`refresh` 내 `useFetch`)도 `$fetch`로 교체.
- **기대 효과**: 컨텍스트 상실 경고/중복 요청 제거, SSR 동작 예측 가능화. F2의 전제 작업.

### P1-F2. `[topic].vue` — SSR 병렬 패칭 + 명시적 await

- **변경 파일**: `pages/country/[code]/[topic].vue`, `composables/useArticles.ts`
- **변경 내용**:
  - `useArticles.ts`: `watch(immediate)` 수동 배선(:41-47)을
    `useAsyncData(key, () => store.load(...), { watch: [country, topic, page] })`로 교체하고
    asyncData promise를 반환값에 노출. SSR에서 기사 목록이 HTML에 포함되는 것을 보장.
  - `[topic].vue`: countries 패칭(:26-29)과 기사 로드를 **하나의 `await`로 병렬화** —
    `await useAsyncData(key, () => Promise.all([countriesStore.fetchIfStale(), articlesLoad()]))`
    또는 두 useAsyncData를 만들고 `await Promise.all([p1, p2])`. 직렬 2단계 → 병렬 1단계.
- **기대 효과**: 핵심 SEO 페이지 SSR 시간 = max(countries, articles) (기존: 합).
  P0-B1과 합산 시 체감 최대 경로.

### P1-F3. `index.vue` / `article/[id].vue` 워터폴 제거

- **변경 파일**: `pages/index.vue`, `pages/article/[id].vue`
- **변경 내용**:
  - `index.vue`: `useHomeFeatured()`(:30) 호출을 countries `await`(:23-26) **앞으로 이동**
    (non-lazy useFetch는 호출 즉시 시작 → 자연 병렬).
  - `article/[id].vue`: countries 패칭(:35-38)의 `await` 제거 — breadcrumb은 이미
    `country?.nameEn ?? countryCode` 폴백(:44-46)이 있으므로 논블로킹 로드로 충분.
    기사 detail fetch만 렌더 블로킹 유지.
- **기대 효과**: 홈 SSR = max(countries, home), 기사 상세 SSR = detail 1회분으로 단축.

### P2 (후속 이터레이션 후보 — 이번 범위 제외)

- `GET /api/countries/:code/overview` 배치 엔드포인트 (`ROW_NUMBER() OVER (PARTITION BY topicSlug)`
  단일 쿼리로 토픽별 top-5) — P0/P1 적용 후 측정치가 목표 미달일 때.
- `/api/articles`·`/api/home`에 routeRules `swr` 추가(핸들러 헤더와 이중화 정리).

---

## 4. API 계약 — 변경 없음 (동결)

| 엔드포인트 | 응답 shape | 상태 |
|---|---|---|
| `GET /api/articles` | `ArticlesResponseDTO { items, total, page, pageSize, totalPages }` | **불변** |
| `GET /api/articles/:id` | `ArticleDetailDTO` | 불변 (이번 미수정) |
| `GET /api/home` | `HomeResponseDTO { featured }` | **불변** |
| `GET /api/countries/:code/preview` | `CountryPreviewResponseDTO` | **불변** |
| `GET /api/trending` | `TrendingResponseDTO` | **불변** (내부 SQL만 수정) |

`types/dto.ts` 수정 금지. `hasContent` 의미(= contentHtml 비-NULL) 동일. 에러 계약
(400/404 envelope) 동일. 이 동결이 backend-dev / frontend-dev **완전 병렬 작업**의 근거다.

---

## 5. 작업 분담 (상호 독립 — 병렬 진행 가능)

### backend-dev (서버/DB만 — 프론트 파일 금지)
1. P0-B1: `findArticles` 단일 raw 쿼리화 + `articles.get.ts` Promise.all (total 폴백 포함)
2. P0-B2: `findLatestAcrossSources` / `findRecentByCountry` 인라인 hasContent + `preview.get.ts` 병렬화, `resolveHasContentSet` 제거
3. P1-B3: `trending.ts` / `trends.ts` 컬럼 케이싱 camelCase 통일 (+ enabled 필터 점검)
4. 레포지토리 단위 테스트 갱신: 반환 DTO shape 스냅숏 + hasContent true/false 케이스

### frontend-dev (pages/stores/composables만 — server/ 금지)
1. P1-F1: `stores/articles.ts`·`stores/countries.ts` action 내 `useFetch` → `$fetch`
2. P1-F2: `useArticles.ts` useAsyncData 전환 + `[topic].vue` 병렬 await
3. P1-F3: `index.vue` 호출 순서 이동, `article/[id].vue` countries 논블로킹화
4. 회귀 확인: 클라이언트 페이지 전환(페이지네이션, 토픽 탭) 시 스토어 캐시 동작 유지

> 접점은 API 계약(§4)뿐이며 동결 상태 → 머지 순서 무관.

## 6. 검증 기준 (qa)

**성능 (수치 — before/after 측정 필수)**
- [ ] `GET /api/articles?country=US&topic=politics` p95: 개선 전 대비 **순차 DB 단계 3→1** 확인
      (`prisma.ts` log에 `query` 추가해 쿼리 횟수 계측: 요청당 4→2, 그중 직렬 의존 0)
- [ ] `/api/home`, `/api/countries/:code/preview` 쿼리 횟수 각각 2→1, 3→2(병렬)
- [ ] `/country/:code/:topic` SSR TTFB: countries+articles 병렬화로 단축 확인
- [ ] view-source(`curl`)로 `/country/US/politics` **SSR HTML에 기사 제목 포함** (SEO 회귀 금지 — 개선 전 기준선도 함께 채증)

**기능 회귀**
- [ ] `ArticlesResponseDTO` 등 응답 shape byte-level 동일 (특히 `publishedAt` ISO 문자열, `hasContent` boolean)
- [ ] `hasContent`: contentHtml 있는/없는 기사 각각 true/false
- [ ] 404 계약: 미등록 국가, malformed article id, contentHtml NULL 기사
- [ ] 빈 페이지(범위 밖 page) 요청 시 total/totalPages 정상 (폴백 count 경로)
- [ ] **`/api/trending` 및 `/api/countries/:code/trends`가 실 DB에서 200 반환** (P1-B3 — 수정 전 500이었는지 먼저 채증)
- [ ] 목록 응답에 `contentHtml` 필드 부재 (payload 불변식 유지)
- [ ] 클라이언트 내비게이션: 페이지네이션/토픽 전환/뒤로가기 시 목록 정상, 콘솔에 Nuxt 컨텍스트 경고 0건

## 7. 위험 요소

| 위험 | 완화 |
|---|---|
| raw SQL 전환으로 Prisma 타입 안전성 상실 | row 타입을 명시 제네릭으로 선언 + DTO 매퍼 단위 테스트. `upsertArticle` 선례 컨벤션 준수 |
| `COUNT(*) OVER()` 빈 결과 시 total 미산출 | page>1 & 0행일 때만 count 폴백 (설계에 명시) |
| trending 케이싱 수정이 "이미 어떻게든 동작 중"인 DB와 충돌 | 수정 전 실 DB에서 현행 쿼리 실행 결과를 먼저 채증(qa 선행) — 실 컬럼명이 snake_case로 드리프트돼 있다면 마이그레이션 이력 점검으로 별도 보고 |
| `useFetch`→`$fetch` 전환 시 SSR 페이로드 중복 제거 상실 | 호출을 `useAsyncData`로 감싸 페이로드 직렬화 유지 (P1-F2 설계대로) |
