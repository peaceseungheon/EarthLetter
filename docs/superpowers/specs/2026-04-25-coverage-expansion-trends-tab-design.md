# 이터레이션 6 설계 — 커버리지 확장 + 국가별 트렌드 탭

**날짜:** 2026-04-25  
**상태:** 승인됨  
**목표:** 토픽·국가 커버리지 확대 + 국가 페이지에 트렌드 탭 추가

---

## 1. 토픽 확장

### 변경 내용

현재 3개 토픽 → 8개로 확대.

| 토픽 slug | 한국어 레이블 | 상태 |
|-----------|--------------|------|
| `military` | 군사·안보 | 기존 |
| `economy` | 경제·무역 | 기존 |
| `politics` | 정치·외교 | 기존 |
| `environment` | 환경·기후 | 신규 |
| `technology` | 기술·혁신 | 신규 |
| `health` | 보건·의료 | 신규 |
| `culture` | 문화·사회 | 신규 |
| `sports` | 스포츠 | 신규 |

### 영향 범위

- DB `Topic` 시드 데이터에 5개 행 추가
- 각 토픽·국가 조합에 맞는 RSS 소스 발굴 후 `Source` 시드 추가
- `TopicTabs.vue`는 동적 렌더링 — UI 수정 없음
- `pages/country/[code]/[topic].vue` 라우트는 slug 기반 — 수정 없음

---

## 2. 국가 확장

### 목표

30개국 → **50개국** (20개국 추가)

### 추가 후보

| 지역 | 국가 |
|------|------|
| 아시아·태평양 | 파키스탄, 방글라데시, 스리랑카, 카자흐스탄, 미얀마 |
| 유럽 | 스웨덴, 노르웨이, 체코, 루마니아, 헝가리 |
| 중동·아프리카 | 이라크, 리비아, 에티오피아, 케냐, 탄자니아 |
| 아메리카 | 베네수엘라, 칠레, 콜롬비아, 쿠바 |

### 영향 범위

- DB `Country` + `Source` 시드 데이터 추가
- `WorldMap.vue` 색상·범례는 동적 — 자동 반영
- 기존 `countries` API, `WorldMapPath` 컴포넌트 수정 없음

---

## 3. 국가별 트렌드 탭

### UX

`/country/[code]` 페이지의 기존 토픽 탭 행에 **"Trends"** 탭을 마지막에 추가.  
탭 클릭 → 국가의 토픽별 기사량 라인 차트 표시 + 7일 / 30일 / 90일 기간 토글.

### 신규 API

```
GET /api/countries/[code]/trends?days=30
```

**응답:**
```ts
Array<{
  topic: string   // e.g. "politics"
  date: string    // ISO date "YYYY-MM-DD"
  count: number
}>
```

**구현:**
- Prisma `groupBy(['topicId', 'publishedAt'])` + `_count` 집계
- `publishedAt` 를 서버 레벨에서 `YYYY-MM-DD` 문자열로 변환 후 groupBy (Prisma는 날짜 truncate groupBy 미지원)
- 렌더링: SSR + SWR 1시간 캐시 (`maxAge: 3600`)
- 인증 불필요 (공개 엔드포인트)

### 신규 파일

| 경로 | 역할 |
|------|------|
| `server/api/countries/[code]/trends.get.ts` | 집계 API |
| `components/CountryTrendsChart.vue` | 차트 렌더링 + 기간 토글 |
| `components/skeletons/CountryTrendsSkeleton.vue` | 로딩 placeholder |

### 수정 파일

| 경로 | 변경 내용 |
|------|----------|
| `pages/country/[code]/index.vue` | "Trends" 탭 분기 추가, lazy fetch |

### 차트 라이브러리

- `chart.js` + `vue-chartjs`
- 토픽별 고정 색상 매핑 (`CountryTrendsChart.vue` 내 상수로 정의):
  `politics → #4e79a7`, `economy → #f28e2b`, `military → #e15759`,
  `environment → #59a14f`, `technology → #76b7b2`, `health → #edc948`,
  `culture → #b07aa1`, `sports → #ff9da7`
- 차트 타입: 멀티 라인 (토픽 = 계열)

### 렌더링 전략

탭 클릭 시 lazy fetch — 페이지 첫 로드에 차트 데이터 요청하지 않아 초기 LCP 보호.

---

## 4. 변경 없음 (의도적)

- `TopicTabs.vue` — 동적 렌더링, 수정 불필요
- `WorldMap.vue` — 동적 색상·범례, 수정 불필요
- Admin 대시보드 — 소스 관리 UI 그대로 사용 가능
- `ArticleCard.vue`, `ArticleList.vue` — 변경 없음

---

## 5. 개발 순서

1. DB 시드: 토픽 5개 추가
2. DB 시드: 국가 20개 + 소스 발굴 추가
3. `trends.get.ts` API 구현 + 단위 테스트
4. `CountryTrendsSkeleton.vue` 신규
5. `CountryTrendsChart.vue` 신규 (chart.js 설치 포함)
6. `pages/country/[code]/index.vue` 탭 분기 추가

---

**다음 단계:** 구현 플랜 작성
