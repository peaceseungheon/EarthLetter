# Frontend Done — Trending Feed (이터레이션 7)

## 생성/수정 파일
- [x] `components/TrendingBadge.vue` — `+127%` 스파이크 배지
- [x] `components/skeletons/TrendingSkeleton.vue` — 로딩 스켈레톤 (rows prop)
- [x] `composables/useTrending.ts` — lazy useFetch wrapper
- [x] `components/TrendingWidget.vue` — 홈 미니 위젯 (top 5)
- [x] `components/TrendingRankingList.vue` — 전체 랭킹 (top 15)
- [x] `pages/trending.vue` — /trending 전용 페이지
- [x] `components/WorldMap.vue` — trendingCountries prop + 앰버 오버레이 레이어 추가
- [x] `pages/index.vue` — TrendingWidget 섹션 삽입
- [x] `components/SiteHeader.vue` — Trending 네비 링크 추가

## typecheck 결과
오류 없음 (vue-tsc --noEmit 출력 없음)

## WorldMap 변경 노트
- `trendingCountries?: Record<string, number>` prop 추가 (optional, withDefaults factory `() => ({})`)
- `MapShape`에 `trendingIntensity: number` 추가
- `pointer-events-none` 별도 `<g>` 오버레이로 기존 click/hover/animation 100% 보존
- 강도 계산: `Math.min(spikeRatio / 500, 1)` → amber rgba 0~0.55 불투명도
- 기존 홈 페이지 WorldMap 호출 무수정 (prop 미전달 시 기존 동작 유지)
