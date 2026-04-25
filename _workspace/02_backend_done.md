# Feature K — Backend 구현 완료 (B1~B8)

> 담당: backend-dev
> 기준 설계: `_workspace/00_architecture.md` (v1.2)
> 완료일: 2026-04-24

---

## 1. 변경/신규 파일 일람

### 신규
| 파일 | 역할 |
|---|---|
| `server/utils/sanitize.ts` | sanitize-html 기반 allow-list 서버 sanitizer (`sanitizeArticleHtml`) |
| `server/api/articles/[id].get.ts` | 단일 기사 상세 API. `id` 64-hex 검증, contentHtml null이면 404. |
| `prisma/migrations/20260424134100_article_content_html/migration.sql` | DB 마이그레이션 (아래 § 4) |
| `tests/unit/sanitize.spec.ts` | 12개 케이스: script/iframe/onerror/javascript:/data: 차단 + transformTag 검증 |
| `tests/unit/ingest-content.spec.ts` | 4개 케이스: content:encoded 추출, 부재 시 null, XSS 제거, MIN_LENGTH |

### 수정
| 파일 | 변경 요지 |
|---|---|
| `prisma/schema.prisma` | `Article.contentHtml String? @db.Text` 추가 |
| `server/utils/rss.ts` | `ParsedFeedItem.contentHtml: string \| null` 추가, customFields로 `content:encoded` 매핑, `sanitizeArticleHtml` 호출 |
| `server/utils/repositories/articles.ts` | "두 단계 쿼리" 패턴 적용, `findArticleById` 신규, `UpsertArticleInput.contentHtml` 추가 |
| `server/utils/services/ingest.ts` | `item.contentHtml` 을 `UpsertArticleInput`에 포함 |
| `types/dto.ts` | `ArticleDTO.hasContent: boolean` (required), `ArticleDetailDTO` 신규 export |

---

## 2. 마이그레이션 상태

- ✅ `npx prisma migrate dev --name article_content_html` 실행 성공
- 마이그레이션 디렉토리: `20260424134100_article_content_html`
- Prisma Client 재생성 완료

⚠️ **주의 — 마이그레이션 SQL이 `Article.contentHtml` 외에 추가 변경을 포함**:

```sql
ALTER TABLE "Article" ADD COLUMN "contentHtml" TEXT;

-- 아래는 schema와 DB 사이의 drift 수습:
ALTER TABLE "Source" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "disabledAt" TIMESTAMP(3),
ADD COLUMN "failCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastFailedAt" TIMESTAMP(3);
CREATE INDEX "Source_enabled_disabledAt_idx" ON "Source"("enabled", "disabledAt");
-- + Article_sourceId_fkey 재생성
```

이전 Feature E/F의 schema 변경이 dev DB에 적용되지 않은 채로 남아 있어, Feature K 마이그레이션이 이를 함께 잡아냈다. **prod 적용 시점**에 이미 해당 컬럼/인덱스가 존재한다면 `prisma migrate deploy` 가 conflict로 실패할 수 있으니 QA 단계에서 prod schema 상태와 비교 필요.

---

## 3. 검증

- ✅ `pnpm test` — 9 files / 59 tests 모두 통과 (sanitize 12 + ingest-content 4 신규 포함)
- ✅ `pnpm typecheck` — 에러 없음 (Nuxt 모듈 호환성 경고만 사전 존재분 그대로)
- ✅ `pnpm lint` — 0 error (frontend의 `vue/no-v-html` 1 warning은 backend 범위 밖)

---

## 4. frontend-dev에게 알릴 API 변경 사항

### 4.1 `ArticleDTO.hasContent` 는 이제 **required** (boolean)

frontend-dev가 선제적으로 `hasContent?: boolean` (optional)로 추가해뒀던 것을 BE 항상 채우도록 보장하면서 **required**로 전환했다. 기존 코드가 `hasContent ?? false` 같은 nullish 합치기를 쓰고 있더라도 동작은 동일하지만, 전체적으로 정리해도 좋다 (선택 사항).

```ts
// types/dto.ts
export interface ArticleDTO {
  // ...
  hasContent: boolean   // required, 항상 BE에서 채움
  source: ArticleSourceDTO
}
```

### 4.2 신규 엔드포인트: `GET /api/articles/[id]`

- **응답**: `ArticleDetailDTO` (types/dto.ts에 export됨)
- **400 BAD_REQUEST**: `id`가 `/^[a-f0-9]{64}$/` 미일치
- **404 NOT_FOUND**: 기사 없음 OR `contentHtml IS NULL`
- **헤더**: `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`
- frontend는 `useFetch<ArticleDetailDTO>('/api/articles/' + id, { server: true })` 패턴으로 SSR 호출

### 4.3 목록 API 응답 스키마 — 본문 미포함 보장

`GET /api/articles` 와 `GET /api/home`의 `featured` 모두 `ArticleDTO`에 `hasContent` 만 추가됐을 뿐 **`contentHtml` 본문은 절대 포함되지 않는다** (§ 2.4–2.5 두 단계 쿼리 패턴).

frontend는 카드 라우팅 분기를 다음 중 하나로 안전하게 작성하면 된다:

```vue
<component
  :is="article.hasContent ? NuxtLink : 'a'"
  v-bind="article.hasContent
    ? { to: `/article/${article.id}` }
    : { href: article.link, target: '_blank', rel: 'noopener noreferrer nofollow' }"
>
  ...
</component>
```

---

## 5. 주의사항 / 향후 운영 포인트

1. **Sanitize 정책은 `server/utils/sanitize.ts` 한 곳에서만 변경** — XSS 보안 경계의 단일 진실. 새 태그/속성을 추가할 때는 반드시 sanitize.spec.ts에 테스트 추가.
2. **목록 쿼리에서 `select` 누락 시 회귀 위험** — `findArticles` / `findLatestAcrossSources` 가 `LIST_SELECT` 상수를 사용하도록 통일했다. 향후 새 목록 함수를 추가할 때도 동일 상수를 재사용하거나, 최소한 `contentHtml`을 명시 제외하라.
3. **기존 행은 `contentHtml = null`** — 프론트는 다음 ingest 사이클이 도는 시점부터 점진적으로 내부 상세 라우팅이 활성화된다. 즉시 backfill 불필요 (§ 8.4).
4. **500KB / 100자 한계** — `sanitizeArticleHtml`은 이 두 한계를 벗어나면 `null`을 반환하므로 ingest에서 자연스럽게 외부 링크로 fallback 된다. 한계를 바꾸려면 `sanitize.ts` 상수만 수정.
5. **rss-parser customFields** — `content:encoded` 를 명시 매핑했다. Atom 피드의 `<content type="html">` 은 rss-parser가 자동으로 `content`로 들어오므로 `item['content:encoded'] ?? item.content` 순으로 fallback.
