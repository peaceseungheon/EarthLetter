# Backend Done — Trending Feed (이터레이션 7)

## 생성/수정 파일
- [x] `types/dto.ts` — TrendingItemDTO, TrendingResponseDTO 추가
- [x] `tests/api/trending-spikeratio.spec.ts` — 스파이크 공식 단위 테스트
- [x] `server/utils/repositories/trending.ts` — findTrending() Prisma $queryRaw
- [x] `server/api/trending.get.ts` — GET /api/trending (SWR 1h)
- [x] `nuxt.config.ts` — /trending routeRule 추가 (swr: 3600)

## API 계약
`GET /api/trending → TrendingResponseDTO (TrendingItemDTO[])`

```ts
interface TrendingItemDTO {
  countryCode: string   // ISO-3166 alpha-2
  countryName: string   // Country.name_en
  topicSlug: string
  todayCount: number    // 최근 24h 기사 수
  avg7dCount: number    // 이전 7일 일평균 (rounded to 2dp)
  spikeRatio: number    // ((today/avg7d) - 1) × 100, rounded to 1dp
}
```

필터: `total_7d >= 5` (기준선 볼륨 부족 조합 제외)
정렬: spikeRatio DESC LIMIT 15
캐시: Cache-Control `s-maxage=3600, stale-while-revalidate=3600`

## 테스트 결과
```
✓ tests/api/trending-spikeratio.spec.ts (4 tests) 2ms
Test Files  1 passed (1)
    Tests  4 passed (4)
```

## typecheck 결과
오류 없음 (vue-tsc --noEmit 출력 없음)
