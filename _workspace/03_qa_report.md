# Phase 3 — QA Report (Feature K)

**Date:** 2026-04-24  
**Critical: 0 / Major: 1 / Minor: 1**

---

## TL;DR

Feature K 구현은 전반적으로 아키텍처 명세를 충실히 따랐다. XSS sanitize, 라우팅 분기, DTO 계약, 두 단계 쿼리 패턴 모두 정상 구현됐고 59개 유닛 테스트가 전부 통과한다. TypeScript 에러 없음. Lint 경고 1건(의도적 격리, `vue/no-v-html`).

**Major 이슈 1건**: Feature K 마이그레이션(`20260424134100_article_content_html`)이 Feature E/F의 스키마 drift를 함께 포함한다. prod DB에 해당 컬럼/인덱스가 이미 존재하면 `prisma migrate deploy` 실패 가능. deploy 전 prod schema 상태 비교 필수.

**Minor 이슈 1건**: 마이그레이션에 `DROP CONSTRAINT` → `ADD CONSTRAINT`(FK 재생성) 패턴이 포함된다. 이 자체는 prod-safe이나 테이블 크기가 클 경우 잠금 시간이 늘어날 수 있어 주의 필요.

---

## 1. API 계약 교차 비교

### FE → BE useFetch 호출

`pages/article/[id].vue:17` — `useFetch<ArticleDetailDTO>('/api/articles/${id.value}', { server: true })` 호출.  
`server/api/articles/[id].get.ts` 존재 및 `ArticleDetailDTO` 반환. **일치. 통과.**

### ArticleDetailDTO 계약

| 필드 | DTO 정의 (`types/dto.ts`) | BE 응답 (`findArticleById`) |
|------|--------------------------|---------------------------|
| id | string | `row.id` (string) |
| title | string | `row.title` |
| summary | string \| null | `row.summary ?? null` |
| link | string | `row.link` |
| imageUrl | string \| null | `row.imageUrl ?? null` |
| publishedAt | string (ISO-8601) | `row.publishedAt.toISOString()` |
| contentHtml | string (non-null) | `row.contentHtml` (null이면 null return → 404) |
| source | ArticleSourceDTO | id/name/countryCode/topicSlug 모두 선택 |

**완전 일치. 통과.**

### ArticleDTO.hasContent 계약

`types/dto.ts:34` — `hasContent: boolean` (required).  
`toArticleDTO(row, hasContent: boolean)` 시그니처에서 항상 boolean으로 채워짐.  
`resolveHasContentSet` — PK-IN + `contentHtml: { not: null }` 조회로 `Set<string>` 반환. `hasSet.has(r.id)` → boolean.  
**일치. 통과.**

### 목록 API contentHtml 미포함 검증

`articles.ts:64–74` — `LIST_SELECT` 상수에 `contentHtml` 없음. `id/title/summary/link/imageUrl/publishedAt/source` 만 선택.  
`findArticles` (line 99–106), `findLatestAcrossSources` (line 122–127) 모두 `select: LIST_SELECT` 사용.  
`ArticleDTO`에도 `contentHtml` 필드 없음.  
**페이로드 회귀 없음. 통과.**

---

## 2. XSS Sanitization

### sanitize.ts 파일 구조

`server/utils/sanitize.ts` 존재. `sanitize-html` allow-list 기반. 아키텍처 § 6.3과 일치.

**주목할 구현 차이**: 아키텍처 명세의 `allowedAttributes.a = ['href', 'title']`와 달리, 실제 구현에서는 `a: ['href', 'title', 'target', 'rel']`로 `target`/`rel`도 allow-list에 포함. 이는 `transformTags.a`에서 `target/_blank rel=...`을 주입한 뒤 sanitize-html의 사후 attribute 필터링에서 걸리지 않도록 한 의도적 보강으로, 보안 상 문제없음. `img`도 동일하게 변환 후 생존을 위해 `loading/decoding/referrerpolicy` 추가. **정상.**

### sanitize.spec.ts 테스트 항목

| 테스트 케이스 | 결과 |
|-------------|------|
| `<script>alert(1)</script>` 제거 | 통과 |
| `<img onerror=alert(1)>` onerror 제거 | 통과 |
| `<a href="javascript:alert(1)">` href 제거 | 통과 |
| `<iframe src="evil.com">` 제거 | 통과 |
| `<p onclick="...">` onclick 제거 | 통과 |
| 정상 HTML 변화 없음 | 통과 |
| `<a>` → target=_blank, rel 자동 주입 | 통과 |
| `<img>` → loading=lazy, referrerpolicy 자동 주입 | 통과 |
| 500KB 초과 시 null | 통과 |
| MIN_LENGTH 미만 시 null | 통과 |
| 빈 `<p>` 필터링 | 통과 |
| `data:image` src 차단 | 통과 |

총 12개 케이스, **전부 통과.**

### 테스트 실행 결과

```
✓ tests/unit/sanitize.spec.ts  (12 tests) 5ms
```

---

## 3. DB 마이그레이션

### contentHtml 컬럼 추가

`prisma/schema.prisma:61` — `contentHtml String? @db.Text` 존재.  
`prisma/migrations/20260424134100_article_content_html/migration.sql:5` —  
`ALTER TABLE "Article" ADD COLUMN "contentHtml" TEXT;` — NULL 허용 ADD COLUMN.  
PostgreSQL은 NULL 허용 컬럼 추가를 메타데이터 변경만으로 처리 → **테이블 rewrite 없음. prod-safe.**

### ⚠️ Major: Schema Drift 포함

동일 마이그레이션에 Feature E/F의 미적용 변경이 함께 포함됨:

```sql
ALTER TABLE "Source" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "failCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedAt" TIMESTAMP(3);
CREATE INDEX "Source_enabled_disabledAt_idx" ON "Source"("enabled", "disabledAt");
ALTER TABLE "Article" DROP CONSTRAINT "Article_sourceId_fkey";
ALTER TABLE "Article" ADD CONSTRAINT "Article_sourceId_fkey" ... ON DELETE CASCADE ...;
```

**위험 시나리오**: prod DB에 이미 `createdAt`, `disabledAt`, `failCount`, `lastFailedAt` 컬럼이나 `Source_enabled_disabledAt_idx` 인덱스가 존재하면 `prisma migrate deploy` 가 `column already exists` / `index already exists` 오류로 실패.

**심각도: Major** — Feature K 기능 자체는 이 drift와 무관하나, 자동화 배포 시 전체 마이그레이션 파이프라인이 차단됨.

**권고사항**:
1. deploy 전 prod DB에서 `\d "Source"` 실행해 컬럼/인덱스 존재 여부 확인.
2. 이미 존재하는 경우: 해당 SQL 문만 별도 수동 실행 후 `prisma migrate resolve --applied 20260424134100_article_content_html` 로 마킹.
3. FK 재생성(`DROP CONSTRAINT` → `ADD CONSTRAINT CASCADE`) — 이 자체는 prod-safe이나 Article 테이블이 클 경우 ACCESS EXCLUSIVE 잠금이 수초 발생 가능. 저트래픽 시간대 적용 권장.

---

## 4. RSS 파서 변경

`server/utils/rss.ts:13–20` — `ParsedFeedItem.contentHtml: string | null` 추가됨.

`rss.ts:44–46` — `customFields: { item: [['content:encoded', 'content:encoded']] }` 로 명시 매핑.

`rss.ts:108` — `const rawHtml = item['content:encoded'] ?? item.content ?? null` — `content:encoded` 우선, Atom의 `content` fallback.

`rss.ts:109–112` — `sanitizeArticleHtml(rawHtml)` 호출. 빈 문자열이나 MIN_LENGTH 미만이면 null 반환 (sanitize.ts 내부 처리).

**아키텍처 § B3 완전 일치. 통과.**

---

## 5. 라우팅 분기

### ArticleCard.vue

`components/ArticleCard.vue:19–31` —

```ts
const linkTag = computed(() =>
  props.article.hasContent ? resolveComponent('NuxtLink') : 'a'
)
const linkProps = computed(() =>
  props.article.hasContent
    ? { to: `/article/${props.article.id}` }
    : { href: props.article.link, target: '_blank', rel: 'noopener noreferrer nofollow' }
)
```

- `hasContent === true` → `NuxtLink` + `/article/:id` 내부 라우팅. "본문 보기 →" CTA.
- `hasContent === false` → `<a target="_blank">` 외부 링크. "Read at source ↗" CTA.

**아키텍처 § 5.1 완전 일치. 통과.**

### pages/article/[id].vue

파일 존재. `useFetch<ArticleDetailDTO>` SSR 호출. error 또는 data 없을 시 `throw createError({ statusCode: 404, fatal: true })`.

**통과.**

### SEO 메타

`pages/article/[id].vue:75–91` —

```ts
useSeoMeta({
  ogType: 'article',          // ✓
  ogTitle: detail.value.title, // ✓
  ogUrl: canonicalUrl.value,   // ✓
  articlePublishedTime: detail.value.publishedAt, // ✓
  ...
})
useHead({
  link: [{ rel: 'canonical', href: canonicalUrl.value }] // ✓
})
```

`ogType=article`, `ogTitle`, canonical 모두 구현됨. **통과.**

---

## 6. TypeScript 타입 검증

```
pnpm typecheck
```

기존 Nuxt module 버전 호환 WARN (사전 존재분) 외 **TS 오류 없음.** **통과.**

---

## 7. 테스트 결과

```
Test Files  9 passed (9)
Tests       59 passed (59)
Duration    273ms
```

신규: `sanitize.spec.ts` (12) + `ingest-content.spec.ts` (4) — **전부 통과.**

---

## 8. Lint 결과

```
✖ 1 problem (0 errors, 1 warning)
/Volumes/.../components/ArticleContent.vue
  12:5  warning  'v-html' directive can lead to XSS attack  vue/no-v-html
```

`ArticleContent.vue`의 `v-html` 경고는 의도적 격리 지점이며 SECURITY 주석으로 명시됨 (§ 5.3). **에러 없음. 통과.**

---

## 9. 아키텍처 체크리스트 (§ 8.6)

| 항목 | 결과 | 근거 |
|------|------|------|
| 마이그레이션이 prod-safe (ADD COLUMN NULL, rewrite 없음) | ✅ (조건부) | `ALTER TABLE "Article" ADD COLUMN "contentHtml" TEXT` — NULL허용, rewrite 없음. drift 부분(Source 컬럼)은 prod 상태 확인 필요 |
| `findArticles`/`findLatestAcrossSources` 응답에 `contentHtml` 본문 미포함 | ✅ | `LIST_SELECT` 상수에 contentHtml 없음. 두 함수 모두 동일 상수 사용 |
| `contentHtml` 있는 기사 → 내부 상세 라우팅 로직 존재 | ✅ | ArticleCard.vue `hasContent → NuxtLink` |
| `contentHtml` 없는 기사 → 외부 링크 로직 존재 | ✅ | ArticleCard.vue `!hasContent → <a target=_blank>` |
| sanitize: script/iframe/onerror/javascript: 제거 테스트 존재 | ✅ | sanitize.spec.ts 12케이스 전부 통과 |
| SEO 메타: og:type=article, og:title, canonical 코드 확인 | ✅ | pages/article/[id].vue `useSeoMeta` + `useHead` |
| 404: contentHtml null인 경우 404 처리 | ✅ | `findArticleById` → null 반환 → endpoint `throw notFound(...)` |

---

## 10. 버그 목록

### Major

**BUG-001**: Feature K 마이그레이션에 Feature E/F schema drift 포함 — prod deploy 시 충돌 가능  
- **파일**: `prisma/migrations/20260424134100_article_content_html/migration.sql`  
- **위험**: prod DB에 Source.createdAt/disabledAt/failCount/lastFailedAt + Source_enabled_disabledAt_idx 이미 존재 시 `prisma migrate deploy` 실패  
- **조치**: prod schema 상태 사전 확인 후 필요 시 manual resolve. deploy pipeline 담당자에게 알림 필수.

### Minor

**BUG-002**: FK 재생성(DROP/ADD CONSTRAINT) — 대형 테이블 배포 시 잠금 주의  
- **파일**: `prisma/migrations/20260424134100_article_content_html/migration.sql:1, 17`  
- **위험**: Article 테이블이 대용량일 경우 ACCESS EXCLUSIVE 잠금이 수초 발생. 기능 자체에는 영향 없음.  
- **조치**: 저트래픽 시간대 적용 권장.
