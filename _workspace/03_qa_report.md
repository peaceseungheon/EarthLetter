# QA Report — 로딩 UI 구현 교차 검증

**날짜:** 2026-04-25
**검증 방법:** 코드 레벨 정적 검증 (브라우저 실행 없음)
**검증자:** qa-tester agent

---

## 1. 파일 존재 확인

| 파일 | 상태 |
|------|------|
| `layouts/default.vue` | PASS — 존재, NuxtLoadingIndicator 포함 |
| `components/LoadingSpinner.vue` | PASS — 존재 |
| `components/skeletons/HomeFeaturedSkeleton.vue` | PASS — 존재 |
| `components/skeletons/CountryOverviewSkeleton.vue` | PASS — 존재 |
| `pages/index.vue` | PASS — featuredPending, showSkeleton, HomeFeaturedSkeleton 모두 포함 |
| `pages/country/[code]/index.vue` | PASS — lazy:true, topicsPending, CountryOverviewSkeleton 포함 |

---

## 2. 설계 일치성 확인

### NuxtLoadingIndicator (layouts/default.vue)

| 속성 | 기대값 | 실제값 | 상태 |
|------|--------|--------|------|
| color | "#2f6bff" | "#2f6bff" | PASS |
| height | 2 | :height="2" | PASS |
| throttle | 200 | :throttle="200" | PASS |
| duration | 3000 | :duration="3000" | PASS |

### LoadingSpinner.vue

| 항목 | 기대 | 실제 | 상태 |
|------|------|------|------|
| role="status" | 있어야 함 | 있음 | PASS |
| aria-live="polite" | 있어야 함 | 있음 | PASS |
| sizeConfig computed | sm/md/lg 분기 정상 | { sm:{px:16,stroke:2}, md:{px:24,stroke:2}, lg:{px:40,stroke:3} } | PASS |

### HomeFeaturedSkeleton.vue

| 항목 | 기대 | 실제 | 상태 |
|------|------|------|------|
| role="status" | 있어야 함 | 있음 | PASS |
| aria-busy="true" | 있어야 함 | 있음 | PASS |
| aria-live="polite" | 있어야 함 | 있음 | PASS |

### CountryOverviewSkeleton.vue

| 항목 | 기대 | 실제 | 상태 |
|------|------|------|------|
| role="status" | 있어야 함 | 있음 | PASS |
| aria-busy="true" | 있어야 함 | 있음 | PASS |
| aria-live="polite" | 있어야 함 | 있음 | PASS |

### pages/index.vue

| 항목 | 기대 | 실제 | 상태 |
|------|------|------|------|
| v-if 조건 | `featured.length > 0 \|\| showSkeleton` | `v-if="featured.length > 0 \|\| showSkeleton"` | PASS |
| showSkeleton 로직 | featuredPending && featured.length === 0 | `computed(() => featuredPending.value && featured.value.length === 0)` | PASS |

---

## 3. 경계 조건 확인

### await Promise.all 패턴 제거 여부
- `pages/country/[code]/index.vue`에서 `Promise.all` 또는 `await useFetch` 패턴: **없음 (PASS)**
- 대신 `useFetch({ lazy: true })` 방식으로 완전 교체됨

### Non-null assertion `topicFetches[i]!`
- `topicFetches[i]!.data.value?.items ?? []` 사용 중
- `topicFetches`는 `TOPIC_SLUGS.map(...)` 결과이며 인덱스 i는 동일한 TOPIC_SLUGS 기반 순회이므로 `undefined` 가능성 없음
- `!` assertion은 TypeScript 컴파일러의 strictNullChecks 경고 억제 목적으로 **정당함 (PASS)**
- `.data.value?.items ?? []` optional chaining으로 런타임 안전성도 보장됨

### topicsPending 체크
- `computed(() => topicFetches.some(f => f.pending.value))`
- `f.pending`은 `useFetch`가 반환하는 Ref<boolean>이며, `.value`로 올바르게 접근
- 하나라도 pending 중이면 skeleton 표시 — **정상 (PASS)**

---

## 4. 접근성 확인

| 컴포넌트 | sr-only 또는 aria-label | 상태 |
|---------|------------------------|------|
| LoadingSpinner | `<span v-else class="sr-only">Loading</span>` + `aria-label` prop | PASS |
| HomeFeaturedSkeleton | `<span class="sr-only">Loading featured articles</span>` | PASS |
| CountryOverviewSkeleton | `<span class="sr-only">Loading country overview</span>` | PASS |
| pages/admin/index.vue 스피너 | `aria-hidden="true"` + 인접 텍스트 "Checking session…" | PASS |

---

## 5. 기존 기능 회귀 확인

### pages/country/[code]/[topic].vue
- `useArticles` composable 사용 확인: PASS
- `ArticleList`에 `:loading="loading"` prop 전달: PASS
- 로딩 UI 로직 변경 없음 (ArticleList 내부 skeleton 처리): PASS
- 회귀 없음

### pages/admin/index.vue
- `authProbing` ref 사용 중 (`authProbing.value = true/false`): PASS
- `authed === null` 조건에서 SVG 스피너 + "Checking session…" 텍스트 표시: PASS
- 기존 인라인 스피너 구조 그대로 유지: PASS
- 회귀 없음

---

## Critical 버그

**없음.** 모든 검증 항목 PASS.

---

## 비고 (Minor)

1. **LoadingSpinner의 aria-label 중복 가능성**: SVG에 `:aria-label="label ?? 'Loading'"` 설정 + 바깥 div에 `role="status"` + `aria-live="polite"` 조합은 일부 스크린리더에서 "Loading Loading" 이중 읽기를 유발할 수 있음. label prop 미전달 시 `<span class="sr-only">Loading</span>`만 남아 SVG의 aria-label="Loading"과 겹침. 기능 영향은 없으나 접근성 polish 수준의 개선 가능.

2. **admin 스피너 미분리**: `pages/admin/index.vue`의 probing 스피너는 인라인 SVG로 구현됨. `LoadingSpinner` 컴포넌트를 재사용하지 않음. 기능상 문제 없으나 디자인 일관성 측면에서 추후 리팩터 고려 가능.

---

**검증 결과: 전체 PASS. Critical 버그 없음.**
