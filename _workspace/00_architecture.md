# 00_architecture — API 통신 로딩 UI 보강

> **이터레이션 목표:** 페이지 네비게이션 및 비동기 데이터 fetch 시 사용자에게
> 일관된 시각적 피드백을 제공한다. 순수 프론트엔드 작업 — 서버/DB/계약 변경 없음.
>
> **소유권:** frontend-dev. backend-dev 변경 없음, QA 는 검증만 수행.

---

## 1. 변경 파일 목록

### 신규 (3)
| 경로 | 역할 |
|------|------|
| `components/LoadingSpinner.vue` | 재사용 가능한 인라인 스피너 (size sm/md/lg, optional label) |
| `components/skeletons/HomeFeaturedSkeleton.vue` | Home featured 섹션 placeholder (6장 그리드) |
| `components/skeletons/CountryOverviewSkeleton.vue` | Country overview 3-section placeholder (Track B) |

### 수정 (3)
| 경로 | 변경 사유 |
|------|----------|
| `layouts/default.vue` | `<NuxtLoadingIndicator>` 추가 — 모든 클라이언트 네비게이션에 상단 진행 바 |
| `pages/index.vue` | `useHomeFeatured()` 의 `pending` 분기로 `HomeFeaturedSkeleton` 노출 |
| `pages/country/[code]/index.vue` | top-level await → lazy 전환, `CountryOverviewSkeleton` 노출 (Track B) |

### 변경 없음 (의도적)
- `pages/country/[code]/[topic].vue` — `ArticleList` 기존 skeleton 이미 적용 ✅
- `pages/admin/**` — 인증/뮤테이션 로딩 이미 충분 ✅
- `nuxt.config.ts` — `NuxtLoadingIndicator` 는 자동 등록, 모듈 추가 불필요

---

## 2. NuxtLoadingIndicator — 위치와 설정

### 배치
`layouts/default.vue` 의 `<SiteHeader />` **위**, root `<div>` 의 첫 번째 자식.

```vue
<!-- layouts/default.vue -->
<template>
  <div
    class="flex min-h-dvh flex-col bg-surface text-ink dark:bg-surface-dark dark:text-ink-dark"
  >
    <NuxtLoadingIndicator
      color="#2f6bff"
      :height="2"
      :throttle="200"
      :duration="3000"
    />
    <SiteHeader />
    <main class="flex-1"><slot /></main>
    <SiteFooter />
  </div>
</template>
```

### 설정 근거
| Prop | 값 | 근거 |
|------|----|----|
| `color` | `#2f6bff` | `tailwind.config.ts` 의 `accent.DEFAULT` 와 동일 |
| `height` | `2` (px) | 1px 은 retina 불가시. 3px 이상은 헤더와 시각적 충돌 |
| `throttle` | `200` (ms) | 100ms 이내 캐시 히트 네비게이션에서 깜빡임 방지 |
| `duration` | `3000` (ms) | 일반 fetch (<2s) 보다 여유 |

---

## 3. LoadingSpinner — 컴포넌트 명세

### Props
```ts
interface Props {
  size?: 'sm' | 'md' | 'lg'  // default: 'md'
  label?: string              // sr-only 포함
  inline?: boolean            // default: false
}
```

### 크기 매핑
| size | px | 사용처 |
|------|----|--------|
| `sm` | 16 | 버튼 내부, 인라인 |
| `md` | 24 | 카드/섹션 헤더 옆 |
| `lg` | 40 | 페이지 중앙 블록 |

---

## 4. Home featured — 스켈레톤 분기

### 변경 전 (pages/index.vue)
```ts
const { data: homeData } = useHomeFeatured()
```
문제: `pending=true && featured.length===0` 시 섹션 자체가 숨겨짐 → CLS 유발

### 변경 후
```ts
const { data: homeData, pending } = useHomeFeatured()
const featured = computed(() => homeData.value?.featured ?? [])
const showSkeleton = computed(() => pending.value && featured.value.length === 0)
```
```vue
<section v-if="featured.length > 0 || showSkeleton" class="flex flex-col gap-4">
  <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
    Latest across the world
  </h2>
  <HomeFeaturedSkeleton v-if="showSkeleton" />
  <ArticleList v-else :articles="featured" :ad-every-n="0" />
</section>
```

---

## 5. Country overview — Track B (lazy 전환)

`await Promise.all([useFetch...])` 을 `lazy: true` 방식으로 전환해
페이지가 즉시 렌더되고 스켈레톤을 표시.

```ts
// useFetch 개별 pending 통합 → 하나의 pending 관리
const allPending = computed(() => topicPendings.some(p => p.value))
```

```vue
<CountryOverviewSkeleton v-if="allPending" />
<template v-else>
  <section v-for="group in topicResults" :key="group.topic">…</section>
</template>
```

---

## 6. API 계약

**없음.** 순수 클라이언트 UI 작업. 새로운 fetch 호출 없음.

---

## 7. 접근성

- 모든 로딩 영역: `role="status"` + `aria-busy="true"` + `aria-live="polite"`
- 스피너 SVG: `aria-label` 또는 `<span class="sr-only">`
- `NuxtLoadingIndicator`: Nuxt 자체 처리

---

## 8. 구현 순서

1. `components/LoadingSpinner.vue` 신규
2. `layouts/default.vue` — NuxtLoadingIndicator 추가
3. `components/skeletons/HomeFeaturedSkeleton.vue` 신규
4. `pages/index.vue` — pending 분기
5. `components/skeletons/CountryOverviewSkeleton.vue` 신규 (Track B)
6. `pages/country/[code]/index.vue` — lazy 전환 (Track B)

---

**문서 버전:** v1 — 2026-04-25  
**다음 단계:** frontend-dev 구현 → qa 검증
