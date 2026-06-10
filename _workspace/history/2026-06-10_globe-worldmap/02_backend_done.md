# 02_backend_done.md — 이터레이션 8 백엔드 구현 완료 보고

> 작성: Backend Dev Agent / 2026-06-10
> 기준 문서: `_workspace/00_architecture.md` § 5, § 7

---

## 1. 구현 엔드포인트

### `GET /api/countries/[code]/preview` [신규]

파일: `server/api/countries/[code]/preview.get.ts`

| 케이스 | 상태 | 동작 |
|--------|------|------|
| 정상 | 200 | `CountryPreviewResponseDTO` 반환 (`countryCode`, `countryName`, `items`) |
| `code` 형식 위반 (`/^[A-Z]{2}$/` 불일치, upper 후 검증) | 400 | `ApiErrorDTO` — `statusMessage: 'BAD_REQUEST'` |
| `limit` 범위 밖 (정수 1~5 외, 소수/0/음수/6+/비숫자) | 400 | `ApiErrorDTO` — `statusMessage: 'BAD_REQUEST'` |
| `limit` 미지정/빈 문자열 | 200 | 기본값 3 적용 |
| Country 테이블 미등록 국가 | 404 | `ApiErrorDTO` — `statusMessage: 'NOT_FOUND'` |
| 등록 국가 + 기사 0건 | 200 | `items: []` (404 아님 — 계약 § 5.1 준수) |

- 응답 헤더: `Cache-Control: public, s-maxage=300, stale-while-revalidate=900`
- 정렬: `publishedAt desc`, 전 토픽 통합, `enabled: true` 소스만
- 핸들러 반환 타입 `Promise<CountryPreviewResponseDTO>` 명시 (기존 컨벤션)
- 검증/에러 패턴: `trends.get.ts`의 `bad()` 헬퍼 + 404 블록 복제, `articles.get.ts`의 정수 파싱 방식 답습

## 2. 리포지토리 변경

### `server/utils/repositories/articles.ts` [수정]

- `findRecentByCountry(country: string, limit: number): Promise<CountryPreviewArticleDTO[]>` 추가
  - `where: { source: { countryCode, enabled: true } }`, `orderBy: { publishedAt: 'desc' }`, `take: limit`
  - select 최소화: `id, title, publishedAt, source { name, topicSlug }` — **contentHtml 미선택 불변식 준수**
  - `hasContent`는 기존 `resolveHasContentSet()` 2단계 PK-IN 쿼리 패턴 재사용
- 스키마 변경/마이그레이션 **없음**

### `server/utils/repositories/countries.ts` [수정]

- `findCountryByCode(code): Promise<{ code, nameEn } | null>` 추가 (기존 repo에 단건 조회 함수가 없어 신규)
  - 핸들러에서 존재 확인 + `countryName` 조회를 1회 쿼리로 처리 (`countryExists` 별도 호출 불필요)
  - 기존 `countryExists`는 무변경 유지

## 3. 미구현 항목

없음. § 7 범위 전체 구현 완료.

- `types/dto.ts`는 계약대로 **수정하지 않음** (이미 `CountryPreviewArticleDTO`, `CountryPreviewResponseDTO` 존재 — import만 수행)
- `components/`, `pages/`, `composables/` 일절 미접촉

## 4. frontend에 알릴 변경 사항 (계약 대비 차이)

**없음.** § 5 계약과 100% 일치. 응답 shape, 상태 코드, 캐시 헤더, 기본값/범위 모두 계약 그대로.

참고 사항 1건: 404 판정이 `countryExists` 대신 `findCountryByCode`(동일 의미, nameEn 동시 조회)로 구현됨 — 외부 동작 차이 없음.

## 5. 검증 결과

| 항목 | 결과 |
|------|------|
| `pnpm typecheck` | **통과** (에러 0건 — components/pages 포함 전체 통과, frontend 미완성 관련 에러도 현재 없음) |
| `pnpm lint` | **통과** (에러 0건. 경고 1건은 기존 `components/ArticleContent.vue`의 `vue/no-v-html` — 이번 변경과 무관, 기존부터 존재) |
| 페이로드 < 1KB | 정적 추산 통과 — 행당 약 200B(title 80자 가정) × 3 + 헤더 ≈ 700B. summary/link/imageUrl/contentHtml 미포함이므로 구조적으로 보장. 런타임 curl 측정은 QA 단계에서 dev 서버 기동 후 수행 권장 |
| 400/404/200-빈배열 수동 curl | 미수행 (이번 세션에서 dev 서버 미기동 — DB 연결 필요). 코드 경로는 기존 trends/articles 핸들러와 동일 패턴이라 QA 체크리스트(§ 10)에서 일괄 검증 권장 |

### 환경 참고

- `node_modules` 부재 상태였음 → `pnpm install` + `pnpm exec prisma generate` 수행 후 검증 완료 (pnpm 10이 prisma postinstall 스크립트를 차단하므로 fresh clone 시 `prisma generate` 수동 실행 필요)
