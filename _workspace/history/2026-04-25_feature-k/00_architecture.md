# EarthLetter — Architecture Blueprint v1.2 (Feature K)

> Feature K — 아티클 상세 페이지 + RSS full-content 지원
> Option B: `contentHtml` 유무로 내부 상세 페이지 vs 원문 새 탭 분기
> Parent blueprint: v1.1 (Features E–G). This doc amends § 3, § 4, § 5, § 8.

---

## 1. Directory Structure (delta only)

v1.1 대비 추가/변경되는 경로만 명시. 그 외는 v1.1과 동일.

```
earthletter/
├── prisma/
│   ├── schema.prisma                          # [MODIFIED] Article.contentHtml 추가
│   └── migrations/
│       └── 20260424xxxxxx_article_content_html/ # [NEW]
│           └── migration.sql
├── server/
│   ├── api/
│   │   └── articles/
│   │       └── [id].get.ts                    # [NEW] 단일 기사 상세 (public, no-auth)
│   ├── utils/
│   │   ├── rss.ts                              # [MODIFIED] ParsedFeedItem.contentHtml 추가
│   │   ├── sanitize.ts                         # [NEW] 서버 사이드 HTML sanitize (sanitize-html)
│   │   ├── repositories/
│   │   │   └── articles.ts                     # [MODIFIED] findArticleById + upsert 확장 + hasContent
│   │   └── services/
│   │       └── ingest.ts                       # [MODIFIED] contentHtml을 upsert 입력에 포함
├── components/
│   ├── ArticleCard.vue                         # [MODIFIED] hasContent 분기 라우팅
│   └── ArticleContent.vue                      # [NEW] sanitized HTML 렌더링 전용 (v-html 격리)
├── pages/
│   └── article/
│       └── [id].vue                            # [NEW] 상세 페이지 (SSR)
├── types/
│   └── dto.ts                                  # [MODIFIED] ArticleDTO.hasContent, ArticleDetailDTO 추가
└── tests/
    ├── unit/
    │   ├── sanitize.spec.ts                    # [NEW]
    │   └── ingest-content.spec.ts              # [NEW]
    └── e2e/
        └── article-detail.spec.ts              # [NEW]
```

**요약**: 신규 파일 6개, 수정 파일 6개. DB 마이그레이션 1건.

---

## 2. DB Schema Changes

### 2.1 Article 모델 확장

```prisma
model Article {
  id          String   @id
  sourceId    Int
  title       String
  summary     String?
  link        String   @unique
  imageUrl    String?
  publishedAt DateTime
  fetchedAt   DateTime @default(now())

  // ---- Feature K 추가 ----
  contentHtml String?  @db.Text   // sanitized RSS content:encoded HTML. null이면 원문 새 탭.
  // ---- End Feature K ----

  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)

  @@index([sourceId, publishedAt(sort: Desc)])
  @@index([publishedAt(sort: Desc)])
}
```

### 2.2 `hasContent` 표현 방식 — 컬럼 추가 불필요

`hasContent Boolean` 컬럼을 **추가하지 않는다**. 사유:
- `Boolean(a.contentHtml)`로 저장소 계층에서 DTO에 매핑
- 중복 컬럼은 동기화 버그 표면적을 키운다 (single-source-of-truth)

### 2.3 인덱스

추가 인덱스 **불필요**. 이유:
- 목록 조회 쿼리에서 `contentHtml`을 WHERE 조건으로 쓰지 않는다
- `@db.Text` 는 행 외부에 TOAST 저장되므로 목록 쿼리 비용에 영향이 거의 없다 (§ 2.4 주의사항 참고)

### 2.4 목록 쿼리 성능 보호 — `select` 명시 필수 ⚠️

`findArticles`, `findLatestAcrossSources`는 **반드시** `select`로 `contentHtml`을 제외한다.

**위험**: Prisma 기본 동작은 모든 스칼라 컬럼 포함 → Feature K 이후 목록 API 페이로드에 HTML 본문이 딸려옴 → 50건 × 최대 50KB = 2.5MB 잠재 회귀.

**조치**: 쿼리 단에서 명시 제외.

### 2.5 목록 응답의 `hasContent` 계산 — "두 단계 쿼리" 패턴

`contentHtml` 본문을 전송하지 않으면서 존재 여부만 반환:

```ts
// 1단계: contentHtml 제외한 경량 select
const rows = await prisma.article.findMany({
  where,
  select: {
    id: true, title: true, summary: true, link: true,
    imageUrl: true, publishedAt: true,
    // contentHtml은 select하지 않음
    source: { select: { id: true, name: true, countryCode: true, topicSlug: true } }
  },
  orderBy: { publishedAt: 'desc' },
  skip, take
})

// 2단계: PK IN 조회로 hasContent 판별 (50건 기준 ~1ms)
const ids = rows.map(r => r.id)
const withContent = await prisma.article.findMany({
  where: { id: { in: ids }, contentHtml: { not: null } },
  select: { id: true }
})
const hasSet = new Set(withContent.map(r => r.id))
const items = rows.map(r => toArticleDTO(r, hasSet.has(r.id)))
```

### 2.6 마이그레이션

```sql
-- migrations/20260424xxxxxx_article_content_html/migration.sql
ALTER TABLE "Article" ADD COLUMN "contentHtml" TEXT;
```

- 기존 행은 NULL → 차기 ingest 실행 시 피드별로 점진적으로 채워짐
- PostgreSQL은 `TEXT` 컬럼 NULL 추가를 메타데이터만 수정하므로 rewrite 없음 — 온라인 안전

---

## 3. API 계약

### 3.1 `GET /api/articles/[id]` — 신규

**목적**: 단일 기사 상세 조회. SSR 시 `useFetch`가 호출.

**권한**: 공개 (no auth)

**URL Params**:
- `id: string` — Article PK (sha256(link)), 64자 hex

**Response 200** (`ArticleDetailDTO`):
```json
{
  "id": "5f2a...b3c",
  "title": "Lorem ipsum",
  "summary": "dolor sit amet",
  "link": "https://example.com/news/123",
  "imageUrl": "https://example.com/og.jpg",
  "publishedAt": "2026-04-20T08:30:00.000Z",
  "contentHtml": "<p>...sanitized HTML...</p>",
  "source": {
    "id": 7,
    "name": "Example News",
    "countryCode": "US",
    "topicSlug": "politics"
  }
}
```

**Error cases**:
| Status | statusMessage | 조건 |
|---|---|---|
| 400 | `BAD_REQUEST` | `id`가 64자 hex 포맷이 아님 |
| 404 | `NOT_FOUND` | 해당 id의 Article 없음 **또는** `contentHtml` is null |

**Cache-Control**: `public, s-maxage=600, stale-while-revalidate=3600`

### 3.2 `GET /api/articles` — 기존 변경사항

**변경**: 응답 items 각 원소에 `hasContent: boolean` 필드 추가.

**Before** (`ArticleDTO`):
```ts
{ id, title, summary, link, imageUrl, publishedAt, source }
```

**After** (`ArticleDTO`):
```ts
{ id, title, summary, link, imageUrl, publishedAt, hasContent, source }
```

⚠️ **`contentHtml` 본문은 목록 응답에 절대 포함하지 않는다** (§ 2.4).

### 3.3 `GET /api/home` — 영향 범위

`HomeResponseDTO.featured: ArticleDTO[]`도 `hasContent` 필드를 자동으로 받게 된다.
`findLatestAcrossSources`도 § 2.4에 따라 `contentHtml`을 제외하고 조회해야 한다.

### 3.4 `POST /api/ingest` — 응답 스키마 불변

`IngestResponseDTO`는 변경하지 않는다.

---

## 4. DTO 변경 (`types/dto.ts`)

### 4.1 `ArticleDTO` — 필드 추가

```ts
export interface ArticleDTO {
  id: string
  title: string
  summary: string | null
  link: string
  imageUrl: string | null
  publishedAt: string
  hasContent: boolean      // [NEW] true면 /article/:id 내부 라우팅 허용
  source: ArticleSourceDTO
}
```

### 4.2 `ArticleDetailDTO` — 신규

```ts
/**
 * Single-article detail. Returned by GET /api/articles/[id].
 * contentHtml is already sanitized server-side (sanitize-html allow-list).
 * Always non-null in this DTO; the endpoint 404s when contentHtml IS NULL.
 */
export interface ArticleDetailDTO {
  id: string
  title: string
  summary: string | null
  link: string
  imageUrl: string | null
  publishedAt: string
  contentHtml: string      // non-null by endpoint contract
  source: ArticleSourceDTO
}
```

---

## 5. 렌더링 전략

### 5.1 라우팅 분기 — `components/ArticleCard.vue`

```
hasContent === true   → <NuxtLink :to="`/article/${article.id}`">   (내부 SSR)
hasContent === false  → <a :href="article.link" target="_blank">    (원문 새 탭, 기존 동작)
```

- `<component :is="hasContent ? NuxtLink : 'a'">` 패턴으로 중복 제거
- 내부 라우팅: `target=_blank` 제거, CTA "본문 보기 →"
- 외부 라우팅: `target=_blank rel="noopener noreferrer nofollow"` 유지, CTA "Read at source ↗"

### 5.2 상세 페이지 — `pages/article/[id].vue`

**렌더링 모드**: **SSR**. `useFetch` with `server: true`.

**레이아웃 구성**:
1. 국가/토픽 브레드크럼
2. 제목, 소스명, publishedAt
3. OG 이미지 (있으면)
4. 본문 영역: `<ArticleContent :html="data.contentHtml" />`
5. "원문 보기 →" CTA (외부 링크)
6. 저작권 고지: "이 기사는 [Source Name] RSS 피드에서 제공된 것입니다. 원문 저작권은 해당 매체에 있습니다."

**SEO (필수)**:
```ts
useSeoMeta({
  title: `${article.title} — ${article.source.name} | EarthLetter`,
  description: article.summary ?? undefined,
  ogTitle: article.title,
  ogDescription: article.summary ?? undefined,
  ogImage: article.imageUrl ?? undefined,
  ogType: 'article',
  ogUrl: `${siteOrigin}/article/${article.id}`,
  articlePublishedTime: article.publishedAt,
})
useHead({
  link: [{ rel: 'canonical', href: `${siteOrigin}/article/${article.id}` }]
})
```

### 5.3 `components/ArticleContent.vue` — HTML 렌더링 전담

**역할**: `v-html` 사용처를 이 컴포넌트 **한 곳**으로 격리 (보안 리뷰 지점 단일화).

```vue
<script setup lang="ts">
defineProps<{ html: string }>()
</script>

<template>
  <!-- SECURITY: html은 server/utils/sanitize.ts에서 allow-list 기반 sanitize됨 -->
  <div class="article-content prose prose-neutral dark:prose-invert" v-html="html" />
</template>
```

### 5.4 이미지/미디어 정책

- 본문 내부 `<img>`: sanitize 단계에서 `loading="lazy"`, `referrerpolicy="no-referrer"` 강제 주입
- 모든 http(s) `<img src>` 허용

---

## 6. XSS Sanitization 전략

### 6.1 원칙

1. **서버 사이드 sanitize** — SSR 환경에서 DOMPurify는 DOM 의존으로 부적합
2. **Ingest 시점에 sanitize하여 DB에 저장** — 응답 경로가 빠름, 저장된 값이 이미 안전
3. **이중 sanitize 금지**

### 6.2 라이브러리 선정

**`sanitize-html`** 선택. 사유:
- 순수 파서(htmlparser2) 기반, 서버 친화적
- `DOMPurify`의 `isomorphic-dompurify`는 SSR 시 DOM 구동 비용 발생

```bash
npm install sanitize-html
npm install -D @types/sanitize-html
```

### 6.3 Allow-list 설계 (`server/utils/sanitize.ts`)

```ts
import sanitizeHtml from 'sanitize-html'

const ALLOWED_TAGS = [
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'u', 's', 'sub', 'sup',
  'ul', 'ol', 'li',
  'a',
  'blockquote', 'cite', 'q',
  'code', 'pre',
  'img', 'figure', 'figcaption',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'span', 'div'
]

export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      a: ['href', 'title'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      '*': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' }
      }),
      img: (tagName, attribs) => ({
        tagName: 'img',
        attribs: { ...attribs, loading: 'lazy', decoding: 'async', referrerpolicy: 'no-referrer' }
      })
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length
  })
}
```

**명시 차단**: `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>` — allow-list 미포함으로 자동 제거. `on*` 이벤트, `javascript:` URL, `data:` URL 이미지 모두 차단.

### 6.4 저장 크기 제한

- `contentHtml.length > 500_000` (~500KB) 시 `null`로 저장 (잘라낸 HTML은 파싱 깨짐)
- 경고 로그 출력

### 6.5 테스트 케이스 (`tests/unit/sanitize.spec.ts`)

- `<script>alert(1)</script>` → 제거됨
- `<img src=x onerror=alert(1)>` → onerror 제거
- `<a href="javascript:alert(1)">` → href 제거
- `<iframe src="evil.com">` → 제거
- `<p onclick="...">` → onclick 제거
- 정상 `<p>Hello <strong>world</strong></p>` → 변화 없음
- 정상 `<a href="https://example.com">` → `target=_blank rel=...` 자동 추가

---

## 7. 에이전트별 작업 범위

### 7.1 backend-dev 담당

**B1. Prisma 스키마 + 마이그레이션**
- `Article.contentHtml String? @db.Text` 추가
- `npx prisma migrate dev --name article_content_html` 실행

**B2. Sanitize 유틸**
- `sanitize-html` + `@types/sanitize-html` 설치
- `server/utils/sanitize.ts` 생성 (§ 6.3)
- `tests/unit/sanitize.spec.ts` 작성 (§ 6.5)

**B3. RSS 파서 확장**
- `server/utils/rss.ts`:
  - `ParsedFeedItem.contentHtml: string | null` 추가
  - `item['content:encoded'] ?? item.content`로 원본 HTML 추출
  - `sanitizeArticleHtml` 호출
  - 결과가 빈 문자열이거나 너무 짧으면(<100자) `null` 반환

**B4. Article 리포지토리 확장**
- `server/utils/repositories/articles.ts`:
  - `UpsertArticleInput.contentHtml: string | null` 추가
  - `upsertArticle`의 create/update에 `contentHtml` 포함
  - `toArticleDTO(row, hasContent: boolean)` 시그니처 확장
  - `findArticles`, `findLatestAcrossSources`: § 2.5의 "두 단계 쿼리" 패턴 적용
  - 신규 `findArticleById(id: string): Promise<ArticleDetailDTO | null>` — `contentHtml` null이면 null 반환

**B5. 상세 API 라우트**
- `server/api/articles/[id].get.ts` 신규
- id 포맷 검증 `/^[a-f0-9]{64}$/`
- 404: 행이 없거나 `contentHtml` null
- `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`

**B6. Ingest 서비스 연결**
- `server/utils/services/ingest.ts`: `item.contentHtml`을 `UpsertArticleInput`에 전달
- 기존 per-item try/catch 유지 — sanitize 실패로 contentHtml이 null이어도 기사는 저장

**B7. DTO 업데이트**
- `types/dto.ts`: `ArticleDTO.hasContent: boolean` 추가, `ArticleDetailDTO` 신규 export

**B8. 테스트**
- `tests/unit/ingest-content.spec.ts`:
  - content:encoded 있는 feed fixture → `contentHtml` 저장 확인
  - content:encoded 없는 feed → `contentHtml` null 확인

### 7.2 frontend-dev 담당

**F1. ArticleCard 라우팅 분기**
- `article.hasContent === true` → `<NuxtLink :to="`/article/${article.id}`">`
- else → 기존 `<a :href=... target=_blank>`
- `<component :is="...">` 패턴 사용

**F2. 상세 페이지 신규**
- `pages/article/[id].vue` 생성 (§ 5.2)
- `useFetch<ArticleDetailDTO>('/api/articles/' + id, { server: true })`
- 404 시 `throw createError({ statusCode: 404 })`
- `useSeoMeta` + `useHead` (§ 5.2)
- `max-w-3xl` + Tailwind Typography (`prose`) 스타일

**F3. ArticleContent 컴포넌트 신규**
- `components/ArticleContent.vue` 생성 (§ 5.3)

**F4. Tailwind Typography 플러그인**
- `@tailwindcss/typography` 설치 및 `tailwind.config` 등록

**F5. e2e 테스트**
- `tests/e2e/article-detail.spec.ts`:
  - `hasContent=true` 카드 클릭 → `/article/:id` 이동 검증
  - `hasContent=false` 카드 클릭 → 새 탭 열림 검증
  - 상세 페이지 SEO 메타 태그 존재 확인
  - 본문에 `<script>` 태그 없음 확인

---

## 8. 위험 요소 및 주의사항

### 8.1 저작권 / 법적 리스크

| 리스크 | 완화 |
|---|---|
| RSS `content:encoded`는 매체가 공개 배포 의도로 내보낸 것 | 정책적으로 **RSS가 주는 그대로**만 저장. 외부 스크래핑 금지. |
| 매체가 RSS 정책 변경 시 기존 DB 값이 더 풍부해 보이는 문제 | ingest가 upsert로 최신값 덮어씀. `contentHtml`이 null로 후퇴 시 상세 페이지 404 → 외부 링크로 복귀. |
| DMCA 요청 | Admin에서 Source 삭제 → cascade로 Article 삭제 (기존 Feature E 동작). |

### 8.2 보안 리스크

| 리스크 | 완화 |
|---|---|
| XSS via content:encoded | § 6의 allow-list sanitize + 단위 테스트 필수 |
| Stored XSS (sanitize 우회) | `ArticleContent` 컴포넌트로 v-html 격리 |
| 외부 이미지로 IP 추적 | `referrerpolicy=no-referrer` 주입 |
| 거대 HTML로 DB/응답 DoS | § 6.4의 500KB 상한 |

### 8.3 성능 리스크

| 리스크 | 완화 |
|---|---|
| 목록 API가 TOAST HTML까지 가져와 느려짐 | § 2.5의 "두 단계 쿼리" — **backend-dev 리뷰 필수 체크리스트** |
| Sanitize 비용이 ingest 지연 | 배치 처리이므로 허용 가능. 피드당 수백 ms. |

### 8.4 데이터 일관성

- 기존 Article들은 `contentHtml = null` → 즉시는 외부 링크 동작. 점진적으로 재ingest 시 채워짐.
- 의도된 점진적 전환, 별도 backfill 불필요.

### 8.5 구현 순서 (의존성)

1. **B1** 스키마 + 마이그레이션
2. **B2** sanitize 유틸 + 테스트 (독립)
3. **B3, B4, B6** RSS 파서 + 리포지토리 + ingest (한 묶음)
4. **B7** DTO 업데이트
5. **B5** 상세 API
6. **B8** BE 테스트
7. **F1** ArticleCard 라우팅 분기 (B7 이후)
8. **F2, F3, F4** 상세 페이지 + 컴포넌트 (B5 이후)
9. **F5** e2e 테스트

병렬화 포인트: B2는 독립. F1은 B7 완료 직후 가능. F2/F3/F4는 B5 완료 직후.

### 8.6 QA 체크리스트

- [ ] 마이그레이션이 prod-safe (ADD COLUMN NULL, rewrite 없음)
- [ ] `findArticles`/`findLatestAcrossSources` 응답에 `contentHtml` 본문 **미포함** (페이로드 회귀 검증)
- [ ] `contentHtml` 있는 기사 → 내부 상세 라우팅 → 본문 렌더
- [ ] `contentHtml` 없는 기사 → 기존대로 원문 새 탭
- [ ] sanitize: script/iframe/onerror/javascript: 모두 제거
- [ ] SEO 메타: og:type=article, og:title, canonical 확인
- [ ] 404: 없는 id + contentHtml null인 id 모두 404
- [ ] e2e: 카드 클릭 → 올바른 목적지 (내부 vs 외부)
- [ ] 성능: 목록 API 응답이 Feature K 이전 대비 10% 이내 변동
