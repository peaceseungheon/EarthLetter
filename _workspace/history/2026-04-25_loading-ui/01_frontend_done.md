# 01_frontend_done — 로딩 UI 구현 완료

## 신규 파일
- components/LoadingSpinner.vue
- components/skeletons/HomeFeaturedSkeleton.vue
- components/skeletons/CountryOverviewSkeleton.vue

## 수정 파일
- layouts/default.vue — NuxtLoadingIndicator 추가
- pages/index.vue — pending 분기 추가
- pages/country/[code]/index.vue — lazy fetch + CountryOverviewSkeleton

## 특이사항
- `pages/country/[code]/index.vue`: 기존 `await Promise.all(TOPIC_SLUGS.map(...))` 패턴을 `useFetch(..., { lazy: true })` 배열로 전환. `topicResults`는 computed로, `topicsPending`은 `some(f => f.pending.value)` 집계 computed로 처리.
- `LoadingSpinner.vue`: `computed(() => sizeMap[props.size]).value` destructure 대신 `sizeConfig` computed ref를 템플릿에서 직접 참조하는 방식으로 구현하여 TS 오류 방지.
- `components/skeletons/` 디렉토리 신규 생성.
