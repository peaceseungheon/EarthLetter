# 00_architecture.md — 이터레이션 8: 3D 지구본 WorldMap + 국가 호버 프리뷰

> 작성: Architect Agent / 2026-06-10
> 대상 독자: frontend-dev, backend-dev, qa
> 전제 사실 확인: `WorldMapPath.vue`는 존재하지 않음(요청서 오기). 평면 지도 로직은 `components/WorldMap.vue` 단일 파일에 있음. WorldMap 사용처는 `pages/index.vue`, `pages/trending.vue` 두 곳. `prisma/schema.prisma`의 `Article.publishedAt` 존재 확인 완료. `GET /api/articles`는 `country+topic` 필수 + 페이지네이션 구조 확인 완료.

---

## 1. 기능 개요

평면 SVG 세계지도를 **드래그로 회전 가능한 orthographic(정사영) 3D 지구본**으로 전환하고, **국가 호버 시 해당 국가의 최신 기사 3건 프리뷰 팝오버**를 띄운다.

- 시각 차별화: idle 시 천천히 자동 회전하는 지구본.
- UX 차별화: 클릭/페이지 이동 없이 호버만으로 국가별 최신 뉴스 헤드라인 훑기.
- 기존 기능(국가 클릭 → `/country/:code`, 커버 국가 색상, 범례, trending amber 오버레이)은 전부 유지.

---

## 2. 설계 결정 요약 (Why First)

### D1. 렌더링: d3-geo `geoOrthographic` + SVG 유지 (canvas/WebGL 도입 안 함)

| 옵션 | 평가 |
|------|------|
| **SVG + d3-geo (채택)** | 신규 의존성 0. 국가별 `<path>`가 실제 DOM 노드 → pointer events·`tabindex`·`aria-label`·CSS hover가 공짜. 호버 프리뷰의 히트테스트가 브라우저 네이티브. |
| canvas | 드래그 프레임당 렌더는 빠르지만 히트테스트(국가 식별)를 직접 구현(색상 피킹 or point-in-polygon)해야 하고 접근성(키보드 포커스, aria)을 전부 재발명. |
| WebGL(three.js 등) | 신규 의존성 + 번들 수백 KB. 110m 해상도 177개 국가에는 과잉. |

**성능 근거**: countries-110m은 피처 177개, topo 원본 ~108KB. orthographic은 뒷면 반구가 projection 단계에서 클리핑되므로 프레임당 실제 그려지는 path는 ~90개 내외. d3 `geoPath` 재계산은 110m 해상도에서 프레임당 수 ms 수준 — rAF 스로틀과 결합하면 데스크톱/중급 모바일에서 충분히 60fps 근접. **SVG로 충분하다.** 50m/10m로 해상도를 올리는 순간 canvas 전환이 필요해지지만, 그건 이 이터레이션 범위 밖이며 `useGlobeProjection` 경계 덕에 추후 교체 가능.

### D2. 드래그 회전: Pointer Events + rAF 코얼레싱(coalescing) + 간단한 관성

- **Pointer Events 단일 경로**: `pointerdown/pointermove/pointerup` + `setPointerCapture`. 마우스·터치·펜을 한 코드로 처리. SVG에 `touch-action: none`(터치 드래그가 페이지 스크롤로 새지 않게).
- **회전 모델**: `rotation = [λ, φ, 0]`. `λ += dx × k`, `φ = clamp(φ − dy × k, −80, 80)`. 감도 `k = 0.25 × (기준스케일 / 현재스케일)` — 단순 비례식이면 충분(쿼터니언/versor 도입은 줌 기능이 없는 현 단계에선 과설계).
- **rAF 코얼레싱**: pointermove에서는 누적 델타만 기록, 실제 `projection.rotate()` + path 재계산은 `requestAnimationFrame` 콜백에서 1회/프레임만 수행. Vue 반응성 비용을 줄이기 위해 프레임당 갱신되는 것은 `rotation` ref 하나뿐이고 path 문자열은 그로부터 파생(computed)된다.
- **관성**: 채택(경량). pointerup 시점 속도를 지수 감쇠(`v *= 0.95/frame`, `|v| < 0.01°`에서 정지). 외부 라이브러리(d3-inertia) 불필요 — 20줄짜리 구현. `prefers-reduced-motion`이면 관성 비활성.

### D3. 자동 회전(idle): 채택 — 단, 4중 정지 조건

차별화 가치가 크므로 채택하되 비용을 명시적으로 통제한다. 속도 `3°/s`(deltaTime 기반, 프레임률 독립).

**정지 조건 (모두 필수 구현)**:
1. `prefers-reduced-motion: reduce` → 아예 시작 안 함 (접근성).
2. 사용자 인터랙션(드래그 시작, 국가 호버/포커스, 팝오버 열림) → 일시 정지, 인터랙션 종료 후 5s 무입력이면 재개.
3. `IntersectionObserver` — 지구본이 뷰포트 밖이면 rAF 루프 자체를 중단 (CPU/배터리).
4. `document.visibilitychange` — 탭 백그라운드 시 중단.

**트레이드오프**: 상시 path 재계산 = 상시 CPU 사용. 위 1·3·4 조건이 이를 "보이는 동안만"으로 한정한다. QA는 백그라운드 탭에서 CPU 0% 수렴을 확인할 것.

### D4. 호버 프리뷰 데이터: 신규 경량 엔드포인트 `GET /api/countries/[code]/preview`

`GET /api/articles` 재사용 **불가** 판정. 이유:
1. `topic`이 필수 파라미터 — 프리뷰는 "국가의 전 토픽 최신 N건"이므로 계약이 안 맞음 (토픽 8개 × 병렬 호출은 논외).
2. `ArticleDTO`는 `summary`, `imageUrl`, `link`, `source` 객체 포함 — 팝오버는 제목·토픽·시각·sourceName만 쓰므로 페이로드 낭비.
3. 호버는 고빈도 이벤트라 응답이 작을수록 좋다 (목표 < 1KB).

기존 `server/api/countries/[code]/trends.get.ts` 디렉토리 패턴을 그대로 따른다. 캐싱은 3겹:
- **서버**: `Cache-Control: public, s-maxage=300, stale-while-revalidate=900` (articles.get.ts와 동일 정책 — CDN이 국가당 1회/5분만 origin 히트).
- **클라이언트 메모리**: `useCountryPreview` 내부 `Map<code, {data, fetchedAt}>`, TTL 5분. 같은 세션에서 같은 국가 재호버 시 네트워크 0회.
- **in-flight dedupe**: 같은 code의 진행 중 요청은 Promise 공유. 호버가 떠나면 `AbortController.abort()`.

**hover intent**: 250ms 디바운스. 포인터가 250ms 이상 같은 국가에 머물 때만 fetch + 팝오버 오픈. 지구본 드래그 중에는 호버 처리 전체 비활성(드래그로 국가 위를 스치며 요청 폭주하는 것 방지).

### D5. 팝오버 위치: 국가 centroid 고정 + 경계 플립 (커서 추적 아님)

- 커서 추적은 회전하는 구면 위에서 잔상처럼 흔들리고, 프리뷰는 "읽는" UI라 정지된 앵커가 옳다. `geoPath.centroid(feature)`(SVG 좌표) → 컨테이너 상대 % 좌표로 환산해 absolute 배치.
- 화면 경계 클리핑: 컨테이너 기준 앵커가 우측 40% 영역이면 좌측으로, 상단 35% 영역이면 아래로 플립하는 단순 규칙. (floating-ui 의존성 추가하지 않음 — 단일 컨테이너 내 단순 플립이면 충분.)
- 팝오버 표시 중에는 자동 회전 정지(D3-2)이므로 앵커가 움직이지 않는다. 사용자가 팝오버 표시 중 드래그를 시작하면 팝오버 즉시 닫음.

### D6. 모바일(호버 부재) 인터랙션: 2-탭 모델

- **1번째 탭**(coarse pointer): 국가 선택 + 프리뷰 팝오버 오픈 (페이지 이동 없음).
- **2번째 탭**(같은 국가) 또는 팝오버 내 "View all →" 버튼: `/country/:code` 이동.
- 다른 국가 탭: 팝오버가 그 국가로 교체. 바다/팝오버 밖 탭: 닫기.
- 판별: `matchMedia('(pointer: coarse)')`. fine pointer에서는 기존처럼 1클릭 즉시 이동(호버가 프리뷰 담당).

### D7. 접근성: 키보드 = 호버와 동급

- 국가 path `focus`(키보드 Tab) → 호버와 동일하게 프리뷰 오픈(디바운스 없이 즉시), `blur`/`Escape` → 닫기. `Enter`/`Space` → 국가 페이지 이동(기존 동작 유지).
- 팝오버: `role="status"` + `aria-live="polite"` 영역으로 두고(포커스 이동 강제하지 않음 — hover card 패턴), path에 `aria-describedby="globe-preview"` 연결.
- 기존 `aria-label`(`${name} — view news` / `no feeds yet`) 유지.

### D8. 기존 사용처 호환: **동일 계약의 GlobeMap으로 양쪽 페이지 교체, WorldMap은 보존 + 토글 제공**

- `GlobeMap.vue`는 `WorldMap.vue`와 **props/emit 계약 동일**(`countries`, `trendingCountries?`, `@country-click`). 따라서 페이지 수정은 태그명 교체 수준.
- `WorldMap.vue`는 삭제하지 않는다. `MapModeToggle`(2D/3D 버튼, localStorage `earthletter-map-mode` 저장)로 평면 지도 폴백 제공 — 저사양 기기·"전체를 한눈에" 니즈(지구본은 반구만 보임) 대응. 기본값은 **3D**.
- **trendingCountries 오버레이**: 평면과 동일하게 amber 반투명 path를 국가 path 위에 겹쳐 그린다. orthographic projection이 뒷면을 자동 클리핑하므로 추가 로직 불필요. 단, 지구본에서는 트렌딩 국가가 뒷면에 있을 수 있으므로 trending.vue에 한해 **초기 회전을 1위 트렌딩 국가 centroid가 정면에 오도록** 설정한다(차별화 + 실용).

### D9. SSR: **초기 1프레임을 SSR로 렌더 + 클라이언트에서 인터랙션 hydrate** (client-only 아님)

- d3-geo path 생성은 순수 JS — 서버에서도 동일하게 동작한다. **결정적(deterministic) 초기 회전값**으로 첫 프레임 SVG를 SSR에 포함하면 LCP에 지도가 들어가고 `<ClientOnly>` 대비 깜빡임/레이아웃 시프트가 없다. 기존 WorldMap도 SSR 렌더였으므로 회귀 없음.
- **hydration mismatch 방지 규칙(중요)**: 초기 회전은 상수(홈 `[0, -15, 0]` — 유라시아/아프리카 정면)이거나 SSR 데이터에서 파생(trending: 1위 국가 centroid — 서버/클라이언트 동일 데이터로 동일 계산). `Math.random()`/`Date.now()` 기반 초기값 금지. 자동 회전·이벤트 리스너는 `onMounted` 이후에만 시작.
- 라우트 캐싱: 변경 없음. `/` swr 300, `/trending` swr 3600 그대로 유효(SSR 산출물이 결정적이므로 캐시 가능). 신규 API는 자체 Cache-Control로 처리.

---

## 3. 디렉토리 구조 (신규/수정)

```
EarthLetter/
├── components/
│   ├── GlobeMap.vue                      [신규] 지구본 오케스트레이터 (SVG, 범례, 오버레이)
│   ├── CountryPreviewPopover.vue         [신규] 프리뷰 팝오버 (presentational, 데이터 주입식)
│   ├── MapModeToggle.vue                 [신규] 2D/3D 토글 버튼
│   └── WorldMap.vue                      [유지] 2D 폴백 (수정 없음)
├── composables/
│   ├── useGlobeProjection.ts             [신규] topo 로드 + feature 변환 + projection/path 파생
│   ├── useGlobeRotation.ts               [신규] 드래그·관성·자동회전·rAF 루프
│   ├── useCountryPreview.ts              [신규] 디바운스 + Map 캐시 + abort + in-flight dedupe
│   └── useMapMode.ts                     [신규] 2D/3D 모드 localStorage 영속화
├── pages/
│   ├── index.vue                         [수정] WorldMap → 모드 분기 (GlobeMap | WorldMap) + 토글
│   └── trending.vue                      [수정] 동일 + 1위 트렌딩 국가 초기 포커스
├── server/
│   ├── api/countries/[code]/preview.get.ts   [신규] 프리뷰 엔드포인트
│   └── utils/repositories/articles.ts        [수정] findRecentByCountry() 추가
└── types/dto.ts                          [수정] CountryPreview* DTO 추가
```

`GlobeMap.vue`가 800라인을 넘지 않도록 회전/프리뷰 로직은 반드시 composable로 분리한다(파일 분리 규칙).

---

## 4. 핵심 패턴 + 적용 근거

| 패턴 | 적용처 | 근거 |
|------|--------|------|
| Composable 분리 (로직/뷰 분리) | useGlobeRotation, useCountryPreview, useGlobeProjection | 회전 수학·캐시 로직을 컴포넌트에서 떼어 단위 테스트 가능하게. Nuxt-First: Vue 반응성 위에 구축, 외부 상태 라이브러리 불필요 |
| 계약 동일 컴포넌트 교체 | GlobeMap ↔ WorldMap | 사용처 변경 최소화 + 2D 폴백을 공짜로 확보 |
| rAF 코얼레싱 | useGlobeRotation | 고빈도 pointermove를 프레임당 1회 갱신으로 압축 — SVG 재계산 비용 통제의 핵심 |
| Stale-While-Revalidate 3겹 캐시 | preview API + useCountryPreview | 호버는 고빈도·저가치 요청 — CDN(s-maxage), 메모리 Map(TTL), in-flight dedupe로 origin 부하를 국가당 5분 1회로 제한 |
| Repository 패턴 유지 | findRecentByCountry | 기존 seam 유지 — 핸들러는 prisma를 직접 만지지 않는다. `LIST_SELECT`/`resolveHasContentSet` 재사용 |
| 결정적 SSR 첫 프레임 | GlobeMap 초기 회전 | hydration mismatch 없이 LCP에 지도 포함 |

---

## 5. API 계약 (contract-frozen — 이 섹션만 보고 양측 독립 구현 가능해야 함)

### 5.1 신규: `GET /api/countries/[code]/preview`

| 항목 | 값 |
|------|-----|
| 경로 파라미터 | `code` — ISO-3166 alpha-2. 핸들러에서 `toUpperCase()` 후 `/^[A-Z]{2}$/` 검증 |
| 쿼리 파라미터 | `limit` — 선택. 정수 1~5, 기본 3. 범위 밖이면 400 |
| 성공 (200) | `CountryPreviewResponseDTO` (아래) |
| 400 | `ApiErrorDTO` — code 형식 위반 또는 limit 범위 위반 (`statusMessage: 'BAD_REQUEST'`) |
| 404 | `ApiErrorDTO` — Country 테이블에 미등록 국가 (`statusMessage: 'NOT_FOUND'`). 기사 0건은 404가 아니라 `items: []`로 200 |
| 응답 헤더 | `Cache-Control: public, s-maxage=300, stale-while-revalidate=900` |
| 정렬 | `publishedAt desc`, 전 토픽 통합, enabled 소스만 |

### 5.2 types/dto.ts 추가분 (그대로 복사 구현)

```ts
// ---------- Country hover preview (Iteration 8) ----------

/** 팝오버 1행. ArticleDTO의 경량 부분집합 — link/summary/imageUrl 미포함. */
export interface CountryPreviewArticleDTO {
  id: string            // sha256(link); hasContent=true면 /article/:id 라우팅에 사용
  title: string
  topicSlug: TopicSlug
  sourceName: string
  publishedAt: string   // ISO-8601 UTC
  hasContent: boolean   // true → 내부 /article/:id, false → 프리뷰에서 링크 미제공(국가 페이지로 유도)
}

export interface CountryPreviewResponseDTO {
  countryCode: IsoCountryCode
  countryName: string                 // Country.nameEn
  items: CountryPreviewArticleDTO[]   // 최대 limit건, 최신순. 0건 가능
}
```

### 5.3 응답 예시

```json
{
  "countryCode": "KR",
  "countryName": "Republic of Korea",
  "items": [
    {
      "id": "a1b2…",
      "title": "Korea unveils new budget plan",
      "topicSlug": "economy",
      "sourceName": "Korea Herald Economy",
      "publishedAt": "2026-06-10T02:11:00.000Z",
      "hasContent": true
    }
  ]
}
```

### 5.4 기존 API — 변경 없음

`/api/articles`, `/api/countries`, `/api/home`, `/api/trending` 모두 무변경. 프론트는 trending 초기 회전에 기존 `useTrending()` 데이터를 재사용한다(신규 호출 없음).

---

## 6. frontend-dev 작업 범위

### 6.1 `composables/useGlobeProjection.ts` [신규]
- 입력: `width`, `height`(SVG 단위), `rotation: Ref<[number, number, number]>`.
- topo 로드(`~/assets/geo/countries-110m.json` 동적 import — WorldMap.vue 41~47행 패턴 재사용), `feature()` 변환은 1회만 수행해 `shallowRef`에 보관(불변).
- `geoOrthographic().scale(min(w,h)/2 - margin).translate([w/2, h/2]).rotate(rotation)` + `geoPath`.
- 반환: `shapes: ComputedRef<GlobeShape[]>`(WorldMap의 `MapShape` 동일 구조: code/name/d/clickable/fill/trendingIntensity — 색상 해시·팔레트·numericToAlpha2 로직을 WorldMap에서 그대로 가져옴), `spherePath`(바다 원: `path({type:'Sphere'})`), `graticulePath`(d3-geo `geoGraticule10()`, 시각 폴리시), `centroidOf(code): {x,y} | null`(팝오버 앵커용 — 뒷면이면 null).
- 뒷면 판정: `path(feature)`가 null/빈 문자열이면 자동 제외(d3가 클리핑).

### 6.2 `composables/useGlobeRotation.ts` [신규]
- 상태: `rotation = ref<[λ, φ, 0]>(initial)`, `isDragging`, `isAutoRotating`.
- 드래그: pointerdown(`setPointerCapture`) → pointermove에서 델타 누적만 → rAF에서 `λ += dx·k`, `φ = clamp(φ − dy·k, −80, 80)` 적용. `k = 0.25`(scale 보정 포함).
- 관성: pointerup 시 최근 2~3프레임 평균 속도로 시작, 프레임당 ×0.95 감쇠, 0.01°/frame 미만 시 정지. `prefers-reduced-motion`이면 스킵.
- 자동 회전: `3°/s`(deltaTime 기반). § 2-D3의 4중 정지 조건(reduced-motion / 인터랙션+5s 유예 / IntersectionObserver / visibilitychange) 전부 구현. `onUnmounted`에서 rAF·옵저버 해제.
- API: `{ rotation, isDragging, pause(), resumeAfterIdle(), bind(el) }`.

### 6.3 `composables/useCountryPreview.ts` [신규]
- `open(code)`: 250ms 디바운스(타이머 교체식). 발화 시 캐시 Map 확인(TTL 5분) → miss면 `$fetch<CountryPreviewResponseDTO>('/api/countries/' + code + '/preview')`, AbortController 보관, 동일 code in-flight Promise 공유.
- `close()`: 디바운스 타이머 취소 + 진행 중 fetch abort.
- 반환: `{ state: Ref<{ code, status: 'loading'|'ready'|'error', data? } | null>, open, openImmediate(code) /* 키보드 포커스용, 디바운스 없음 */, close }`.
- 에러 시 팝오버에 "Couldn't load preview" 1줄 + 국가 페이지 이동은 계속 가능(에러를 삼키되 UI에 표시).

### 6.4 `components/CountryPreviewPopover.vue` [신규]
- Props: `preview: CountryPreviewResponseDTO | null`, `status`, `anchor: {xPct, yPct}`, `placement: 'top'|'bottom'|'left'|'right'`. 데이터 패칭 없음(presentational).
- 내용: 국가명 헤더, 기사 ≤3행(토픽 뱃지 + 제목 1줄 ellipsis + `useRelativeTime` 상대시각), 하단 "View all →"(`/country/:code`). `hasContent=true`인 행만 `/article/:id` NuxtLink, 아니면 비링크 텍스트.
- 0건: "No recent articles" + View all 버튼 유지. loading: 3행 스켈레톤(팝오버 크기 고정 — 레이아웃 점프 방지, 고정 width 280px).
- `role="status"` 영역, 컨테이너 내 absolute 배치(%), pointer-events: auto(팝오버 위로 마우스 이동 시 닫히지 않게 — 닫힘 판정은 "국가도 팝오버도 아닌 곳"으로).

### 6.5 `components/GlobeMap.vue` [신규]
- Props/emits: **WorldMap과 동일** + `autoRotate?: boolean = true`, `initialRotation?: [number, number, number]`.
- 구성: 바다 sphere(은은한 배경색) → graticule(얇은 선) → 국가 path들(WorldMap의 fill/aria/tabindex/키보드 핸들러 이식) → trending amber 오버레이(pointer-events-none) → CountryPreviewPopover → 범례(WorldMap 것 재사용 수준 복제).
- 인터랙션 배선: hover(fine pointer) → `preview.open(code)`(클릭 시 즉시 이동 유지). coarse pointer → § 2-D6 2-탭 모델. focus → `openImmediate`, Escape → close. `isDragging` 동안 호버 처리 차단·팝오버 닫기.
- SSR: 초기 회전 prop은 상수/SSR 데이터 파생만 허용. 리스너·자동회전은 onMounted.
- `prefers-reduced-motion` 시 기존 pulse 애니메이션 규칙도 WorldMap과 동일하게 무효화.

### 6.6 `components/MapModeToggle.vue` + `composables/useMapMode.ts` [신규]
- `useMapMode`: `mode: Ref<'globe' | 'flat'>`, 기본 'globe', localStorage `earthletter-map-mode`. **SSR에서는 항상 'globe'로 렌더하고 onMounted에서 저장값 반영**(localStorage는 서버에 없음 — hydration mismatch 주의, 반영 시 단순 컴포넌트 스왑이라 안전).
- 토글 버튼: 지도 우상단 오버레이, `aria-pressed` 사용.

### 6.7 `pages/index.vue`, `pages/trending.vue` [수정]
- `<WorldMap …/>` → `mode==='globe' ? <GlobeMap …/> : <WorldMap …/>` + `<MapModeToggle/>`. props/이벤트 바인딩 변경 없음.
- trending.vue: `initialRotation`을 1위 트렌딩 국가의 centroid 경도/위도(클라·서버 동일 데이터 `items[0]`에서 파생)로 전달. 트렌딩 0건이면 홈과 동일 상수.

### 6.8 검증 책임 (frontend)
- 드래그 중 Chrome Performance 패널에서 프레임 16ms 이내(데스크톱) / 33ms 이내(모바일 에뮬레이션 4x slowdown) 확인.
- 백그라운드 탭/뷰포트 밖에서 rAF 정지 확인.

## 7. backend-dev 작업 범위

### 7.1 `server/utils/repositories/articles.ts` [수정 — 함수 1개 추가]
```ts
export async function findRecentByCountry(
  country: string,
  limit: number
): Promise<CountryPreviewArticleDTO[]>
```
- `where: { source: { countryCode: country, enabled: true } }`, `orderBy: { publishedAt: 'desc' }`, `take: limit`.
- select는 `id, title, publishedAt, source { name, topicSlug }`만 (contentHtml 미선택 불변식 준수).
- `hasContent`는 기존 `resolveHasContentSet()` 재사용(동일 2단계 쿼리 패턴).
- 인덱스: `Article @@index([publishedAt desc])` + `Source @@index([countryCode, topicSlug])` 조합으로 현 규모(50개국, 7일 보존) 충분. **스키마 변경 없음, 마이그레이션 없음.**

### 7.2 `server/api/countries/[code]/preview.get.ts` [신규]
- 기존 `countries/[code]/trends.get.ts`·`articles.get.ts`의 검증/에러 패턴 답습:
  1. `getRouterParam(event, 'code')` → upper → `/^[A-Z]{2}$/` 아니면 400 (`bad()` 헬퍼 패턴 복제).
  2. `limit` = `parsePositiveInt(query.limit, 3, 5)` → NaN이면 400.
  3. `countryExists(code)` false → 404 (`repositories/countries.ts` 재사용). 국가명은 동일 repo에서 조회(필요 시 `findCountryByCode` 추가 — 기존 repo 확인 후 있으면 재사용).
  4. `findRecentByCountry(code, limit)` 호출, `CountryPreviewResponseDTO` 반환.
  5. `setResponseHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')`.
- 반환 타입을 `Promise<CountryPreviewResponseDTO>`로 명시(기존 핸들러 컨벤션).

### 7.3 `types/dto.ts` [수정]
- § 5.2 블록을 그대로 추가. (frontend와 공유 파일 — 충돌 방지 위해 backend-dev가 먼저 커밋하고 frontend는 그 타입을 import.)

### 7.4 검증 책임 (backend)
- 응답 페이로드 < 1KB(limit=3 기준) 확인.
- 404/400/200-빈배열 케이스 수동 curl 검증 + 캐시 헤더 존재 확인.

---

## 8. 렌더링 전략 요약

| 항목 | 결정 |
|------|------|
| 지구본 초기 프레임 | **SSR 포함**(결정적 회전값). client-only 금지 — LCP·CLS 보호 |
| 인터랙션(드래그/자동회전/호버) | onMounted 이후 클라이언트 전용 |
| `/`, `/trending` routeRules | **무변경** (swr 300 / 3600 유지 — SSR 산출 결정적이므로 캐시 안전) |
| `/api/countries/[code]/preview` | routeRules 추가 없음 — 핸들러 Cache-Control로 CDN 캐싱 |
| 2D/3D 모드 | SSR은 항상 globe, 클라이언트 마운트 후 localStorage 반영 |

---

## 9. 위험 요소 및 주의사항

1. **[성능] 저사양 모바일에서 드래그 프레임 드랍**: 110m+rAF 코얼레싱으로 대부분 흡수되지만, QA에서 4x CPU throttle 기준 33ms/frame 초과 시 1차 완화책은 "드래그 중 graticule·trending 오버레이 숨김", 2차는 canvas 전환(useGlobeProjection 경계 유지가 보험). 또한 2D 토글이 최종 폴백.
2. **[성능] 자동 회전의 상시 CPU 사용**: 4중 정지 조건(§ 2-D3)이 미구현되면 배터리 이슈로 직결. QA 필수 체크 항목.
3. **[정합성] hydration mismatch**: 초기 회전에 비결정 값 사용 금지(§ 2-D9). trending 초기 회전은 SSR과 클라이언트가 같은 `useTrending` 데이터를 보므로 안전하지만, 클라이언트 refetch로 1위가 바뀌어도 **회전을 따라 바꾸지 말 것**(초기값 1회만 사용).
4. **[UX] 호버 요청 폭주**: 250ms 디바운스 + 드래그 중 호버 차단 + abort가 모두 구현되어야 함. 셋 중 하나라도 빠지면 빠른 마우스 이동에서 요청 수십 개 발생.
5. **[접근성] 회전 UI의 키보드 사용자**: 드래그 없이는 뒷면 국가에 도달 불가 → Tab 순회는 "현재 보이는" path만 도는 게 아니라 전체 path가 DOM에 있으므로(뒷면은 d=null로 미렌더) 뒷면 국가는 포커스 불가. 완화: 기존 `CountrySelector`(검색)와 `AvailableCountriesStrip`이 페이지에 공존하므로 모든 국가 접근 경로는 보존됨 — 페이지에서 이 컴포넌트들을 제거하지 말 것.
6. **[모바일] 2-탭 모델의 발견 가능성**: 첫 탭이 이동이 아니라는 변화를 사용자가 모를 수 있음 — 팝오버 하단 "View all →" 버튼을 시각적으로 명확한 primary 버튼으로.
7. **[호환] WorldMap.vue 무수정 원칙**: 2D 폴백이 회귀하지 않도록 이번 이터레이션에서 WorldMap.vue는 건드리지 않는다. 공통화 욕심(범례 추출 등)은 다음 이터레이션으로.
8. **[데이터] 국가는 등록됐지만 기사 0건**: 404가 아니라 빈 items — 프론트는 빈 상태 문구 필수(§ 6.4).
9. **[보안] code 파라미터**: 정규식 검증으로 Prisma 쿼리 전 차단(기존 패턴 유지). limit 상한 5 강제로 페이로드 남용 방지.

---

## 10. QA 핸드오프 체크리스트 (요약)

- [ ] 드래그 회전: 마우스/터치/펜, φ 클램프(극지 뒤집힘 없음), 관성 감쇠
- [ ] 자동 회전: reduced-motion 미동작 / 탭 백그라운드·뷰포트 밖 rAF 정지 / 인터랙션 후 5s 재개
- [ ] 프리뷰: 250ms 미만 스침에 요청 0회, 동일 국가 재호버 5분 내 네트워크 0회, 팝오버 경계 플립
- [ ] 모바일: 1탭 프리뷰 → 2탭/버튼 이동, 바다 탭 닫기
- [ ] 키보드: Tab → 프리뷰, Enter 이동, Escape 닫기
- [ ] API: 400/404/200-빈배열, Cache-Control 헤더, 페이로드 < 1KB
- [ ] SSR: view-source에 지구본 path 존재, hydration 경고 0건, 2D 토글 후 새로고침 시 모드 유지
- [ ] trending: amber 오버레이 표시 + 1위 국가 정면 초기 회전
