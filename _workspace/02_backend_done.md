# 02_backend_done — 기사 조회 성능 개선 (backend-dev)

> 작성: backend-dev / 2026-06-10
> 기준 설계: `_workspace/00_architecture.md` § 5 backend-dev 작업 목록 (P0-B1, P0-B2, P1-B3)
> 커밋: 미수행 (오케스트레이터가 QA 후 처리)

## 1. 변경 파일 목록

| 파일 | 작업 | 내용 |
|---|---|---|
| `server/utils/repositories/articles.ts` | P0-B1/B2 | `findArticles`·`findLatestAcrossSources`·`findRecentByCountry`를 `$queryRaw` 단일 쿼리로 재작성, `resolveHasContentSet`·`LIST_SELECT` 삭제 |
| `server/api/articles.get.ts` | P0-B1 | `countryExists` ∥ `findArticles` `Promise.all` 병렬화 (404 계약 유지) |
| `server/api/countries/[code]/preview.get.ts` | P0-B2 | `findCountryByCode` ∥ `findRecentByCountry` `Promise.all` 병렬화 (404 계약 유지) |
| `server/utils/repositories/trending.ts` | P1-B3 | snake_case → 따옴표 camelCase 전면 교체 + `s."enabled"` 필터 추가 (today/baseline CTE 양쪽) |
| `server/utils/repositories/trends.ts` | P1-B3 | snake_case → 따옴표 camelCase 전면 교체 |
| `tests/api/country-preview-contract.spec.ts` | 테스트 갱신 | Part B를 `$queryRaw` 모킹으로 재작성 (DTO shape·ISO 직렬화·hasContent·lean-SQL 불변식·단일 왕복) |
| `tests/api/articles-repository.spec.ts` | **신규** | `findArticles`/`findLatestAcrossSources` 단위 테스트 — DTO shape, hasContent true/false, 윈도우 total, count 폴백, contentHtml 비선택 불변식 |

## 2. 변경 요지

### P0-B1 — `findArticles` 단일 쿼리화
- 설계 § 3 SQL 그대로: JOIN + `(a."contentHtml" IS NOT NULL) AS "hasContent"` 인라인 + `COUNT(*) OVER()::int AS "total"` 동봉. 파라미터는 전부 태그드 템플릿 바인딩(인젝션 안전).
- row 타입 명시 제네릭(`ArticleListRawRowWithTotal`) 선언, DTO 매퍼 `toArticleDTO`에서 `publishedAt.toISOString()` 유지.
- **폴백(설계 § 2-D2 명시)**: `rows.length === 0 && page > 1`일 때만 `prisma.article.count` 1회. page=1 & 0행은 total 0으로 즉시 반환(쿼리 1회 유지).
- `articles.get.ts`: 입력 검증(400)은 기존 그대로 선행 → 존재성 체크와 본 쿼리만 `Promise.all`. 미등록 국가면 본 쿼리 결과를 버리고 404 (응답 계약 byte-level 동일).

### P0-B2 — 홈/프리뷰 동일 패턴
- `findLatestAcrossSources`: 단일 raw 쿼리 (total 불필요, `LIMIT ${take}`).
- `findRecentByCountry`: lean select(id/title/publishedAt/sourceName/topicSlug + 인라인 hasContent) 단일 raw 쿼리.
- `resolveHasContentSet` 호출처 소멸 → 함수 삭제. 파일 헤더의 불변식 2 주석을 "인라인 SQL 계산 컬럼" 기준으로 갱신.
- `preview.get.ts`: `findCountryByCode` ∥ `findRecentByCountry` 병렬화.

### P1-B3 — trending/trends 케이싱 수정
- `trending.ts`/`trends.ts`의 비따옴표 snake_case 식별자(`a.published_at`, `s.country_code`, `s.topic_slug`, `a.source_id`, `c.name_en`)를 마이그레이션 실제 컬럼명인 따옴표 camelCase(`a."publishedAt"`, `s."countryCode"`, `s."topicSlug"`, `a."sourceId"`, `c."nameEn"`)로 전면 교체 — `upsertArticle` 컨벤션과 통일. CTE 내부 alias(`today_count`, `total_7d`)는 자체 정의 소문자라 그대로 둠.
- **trending에 `s."enabled"` 필터 추가** (today/baseline CTE 모두) — 비활성 소스 집계 누수 차단. 응답 DTO alias(`AS "countryCode"` 등)는 기존부터 camelCase라 응답 shape 불변.

## 3. 쿼리 왕복 before → after

| 엔드포인트 | before (순차 단계) | after |
|---|---|---|
| `GET /api/articles` | 3단계 ≈ 4쿼리 (countryExists → count∥findMany → hasContent PK-IN) | **병렬 1단계, 2쿼리** (countryExists ∥ 단일 raw) — 직렬 의존 0 |
| `GET /api/home` | 2단계 2쿼리 (findMany → hasContent PK-IN) | **1단계 1쿼리** |
| `GET /api/countries/:code/preview` | 3단계 3쿼리 (findCountryByCode → findMany → hasContent PK-IN) | **병렬 1단계, 2쿼리** |
| `GET /api/trending`, `/api/countries/:code/trends` | 케이싱 불일치로 잠재 500 | camelCase 통일로 가용성 확보 (쿼리 수 불변 1회) |

## 4. 테스트 결과

```
pnpm vitest run tests/api/articles-repository.spec.ts tests/api/country-preview-contract.spec.ts \
  tests/api/trending-spikeratio.spec.ts tests/api/trends-validation.spec.ts tests/api/articles-validation.spec.ts

Test Files  5 passed (5)
     Tests  36 passed (36)
```

- 신규 `articles-repository.spec.ts` 6건: DTO shape(키 집합까지 검증 — 윈도우 `total`/flatten 컬럼 누수 금지), hasContent true/false, 정상 경로 단일 왕복(count 미호출), page=1 0행(폴백 미발동), page>1 0행 count 폴백(+OFFSET 계산), home 매핑.
- `country-preview-contract.spec.ts` Part B 4건 갱신: `$queryRaw` 태그드 템플릿 모킹으로 SQL 텍스트·바인딩 파라미터·contentHtml 단일 언급(IS NOT NULL만) 검증.
- 빌드: `npx nuxt build` 통과 (참고: `pnpm build` 스크립트는 `prisma migrate deploy`+`db seed`가 실 DB를 요구하므로 빌드 단계만 분리 실행).

## 5. qa에게 전달할 주의점

1. **응답 shape 동결 확인**: `types/dto.ts` 무수정. `publishedAt`은 매퍼에서 `Date.toISOString()` — raw 쿼리도 Prisma가 TIMESTAMP를 JS Date로 역직렬화하므로 동일. byte-level diff 검증 권장 (§ 6 체크리스트).
2. **폴백 경로**: 범위 밖 page(예: `?page=999`)에서 `total`/`totalPages`가 정상인지 — 이때만 count 쿼리 1회 추가 발생 (정상 경로 비용 0).
3. **404 의미 차이 없음, 단 실행 순서 변화**: 미등록 국가 요청 시 본 쿼리가 병렬로 실행되긴 하지만(0행, 인덱스 히트) 응답은 동일하게 404. 쿼리 로그 계측 시 "404인데 Article 쿼리 1회"가 보이는 것은 설계 의도(§ 2-D3).
4. **trending 동작 변화(의도된 것)**: `s."enabled"` 필터 추가로 비활성 소스 기사가 집계에서 빠짐 → 수정 전후 trending 결과 건수가 달라질 수 있음. 회귀가 아니라 누수 수정.
5. **trends.ts의 enabled 필터는 추가하지 않음**: 설계 § 3 P1-B3가 trending만 명시. trends(차트)에도 동일 누수가 있는지는 architect 판단 필요 — 후속 검토 항목으로 전달.
6. **실 DB 검증 필수**: `/api/trending`·`/api/countries/:code/trends`가 수정 전 실 DB에서 500이었는지 채증(§ 6) 후 200 확인. 단위 테스트는 SQL 텍스트만 검증하므로 실 DB 스모크가 최종 근거.
7. 쿼리 횟수 계측: `server/utils/prisma.ts`에 `log: ['query']` 추가해 요청당 쿼리 수 before/after 채증 (§ 6 첫 항목).
