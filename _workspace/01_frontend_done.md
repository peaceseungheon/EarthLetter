# Feature K — Frontend 구현 완료 (frontend-dev)

> Reference: `_workspace/00_architecture.md` § 4, § 5
> Date: 2026-04-25

---

## 생성/수정한 파일 목록

### 신규 생성
| 파일 | 역할 | 아키 §  |
|------|------|---------|
| `pages/article/[id].vue` | 기사 상세 페이지 (SSR, 64자 hex id) | § 5.2 |
| `components/ArticleContent.vue` | sanitized HTML 렌더링 전담 (v-html 격리 지점) | § 5.3 |

### 수정
| 파일 | 변경 내용 |
|------|----------|
| `components/ArticleCard.vue` | `<component :is>` 패턴으로 hasContent 분기. 내부=NuxtLink+`/article/:id`+"본문 보기 →", 외부=`<a target=_blank>`+"Read at source ↗" |
| `types/dto.ts` | `ArticleDTO.hasContent: boolean`, `ArticleDetailDTO` 추가 (작업 중 backend-dev가 `?` → required로 동기화) |
| `tailwind.config.ts` | `@tailwindcss/typography` plugin 추가 |
| `package.json` (via pnpm) | `@tailwindcss/typography@0.5.19` devDependencies 추가 |

상위 컴포넌트(`ArticleList.vue`, `pages/index.vue`, `pages/country/[code]/index.vue`, `pages/country/[code]/[topic].vue`)는 `ArticleDTO`를 그대로 카드에 전달하므로 prop drilling이 필요 없어 **수정 불필요** (hasContent가 article 객체에 포함됨).

---

## F1~F5 작업 매핑

- **F1 ArticleCard 분기 라우팅** — 완료. `<component :is="resolveComponent('NuxtLink') | 'a'">` 패턴.
- **F2 상세 페이지** — 완료. SSR + `useFetch`, `useSeoMeta(ogType=article, articlePublishedTime, ...)`, canonical, 브레드크럼(홈 > 국가 > 토픽 > 제목), 플래그 이모지, OG 이미지, ArticleContent, 원문 보기 CTA, 저작권 고지.
- **F3 ArticleContent** — 완료. `prose prose-neutral dark:prose-invert max-w-none` + 보안 주석.
- **F4 Tailwind Typography** — 완료. `pnpm add -D @tailwindcss/typography` + tailwind.config.ts plugin 등록. (npm은 arborist 버그로 실패 → 프로젝트 표준 pnpm 사용)
- **F5 타입** — 완료. backend-dev가 `hasContent`를 required로 정렬해주어 `?? false` 폴백 제거.

---

## 검증

- `pnpm lint`: 0 errors / 1 warning (`vue/no-v-html` — `ArticleContent.vue`, 의도적 격리 지점, SECURITY 주석으로 명시)
- `pnpm typecheck`: **프론트엔드 영역 통과**. 남은 오류 5건은 `tests/unit/ingest-content.spec.ts` (B8 — backend-dev 영역)

---

## 미완성 / 보류

- **F5 e2e 테스트** (`tests/e2e/article-detail.spec.ts`) — qa 에이전트 영역으로 위임. 본 task 범위는 F1~F4 + 페이지/컴포넌트 구현. 작업 명세에서도 e2e는 "qa-tester가 관할" 수준으로 분리되어 있음.
- 본문 내부 이미지 lazy/referrer 정책 — 서버 sanitize 단계에서 처리 (§ 5.4) — backend-dev `B2` 책임.

---

## backend-dev에게 알릴 사항

1. **`types/dto.ts` 동기화 OK**. 작업 중 backend-dev가 `hasContent?: boolean` 임시 declare를 required로 정정해 주셨고, 프론트는 `article.hasContent` (옵셔널 체이닝/`?? false` 없이) 직접 소비합니다. → **앞으로 BE가 `findArticles`/`findLatestAcrossSources` 응답에 항상 `hasContent`를 채우는 § 2.5 "두 단계 쿼리"를 반드시 지켜주세요.** 빠지면 카드가 모두 외부 링크로만 동작합니다 (falsy 폴백).

2. **`/api/articles/[id]` 응답 계약**:
   - 404 트리거: 행 없음 OR `contentHtml` null — 둘 다 동일 응답으로.
   - 응답 shape는 `ArticleDetailDTO` 정확히 일치 (특히 `source.countryCode`, `source.topicSlug`는 라우팅/플래그 표시에 사용).

3. **`hasContent` 회귀 검증**: 목록 응답 페이로드가 Feature K 이전 대비 10% 이내에 들어오는지 (§ 8.6 QA 체크) — `contentHtml` 본문이 실수로 새어 나오면 카드가 정상 동작하더라도 응답 크기가 폭주합니다.

4. **이미지 sanitize**: `<img loading=lazy decoding=async referrerpolicy=no-referrer>`가 sanitize 단계에서 강제 주입되고 있어야, ArticleContent의 prose 영역 이미지가 의도대로 동작합니다 (§ 5.4).

---

## 변경 후 즉시 사용 가능한 라우트

- `/article/:id` (id = 64-char lowercase hex) — backend `/api/articles/[id]` 가 살아있는 즉시 SSR 동작.
- 카드 클릭 분기는 BE가 `hasContent`를 응답에 포함하기 시작하는 첫 시점부터 자동 활성화.
