# 01_frontend_done.md — 이터레이션 8 프론트엔드 구현 완료 보고

> 작성: Frontend Dev Agent / 2026-06-10
> 기준 문서: `_workspace/00_architecture.md` § 6 (frontend-dev 작업 범위)

---

## 1. 생성/수정 파일

### 신규

| 파일 | 내용 |
|------|------|
| `composables/useGlobeProjection.ts` | topo 1회 로드(`shallowRef`, WorldMap 41~47행 패턴) + `geoOrthographic` projection/path 파생. `shapes`(WorldMap `MapShape` 동일 구조 — 색상 해시·팔레트·`numericToAlpha2` 이식), `spherePath`, `graticulePath`(`geoGraticule10`, 모듈 상수), `availableCount`, `centroidOf(code)`(뒷면 null), `lonLatOf(code)`(초기 회전 파생용) 반환 |
| `composables/useGlobeRotation.ts` | Pointer Events 드래그(rAF 코얼레싱: pointermove는 델타 누적만, 적용은 프레임당 1회), 관성(최근 ~100ms 평균 속도, ×0.95/frame, <0.01°/frame 정지, reduced-motion 시 스킵), 자동회전 3°/s deltaTime 기반 + **4중 정지 조건 전부 구현**(reduced-motion 미시작 / 인터랙션 pause + 5s 무입력 재개 / IntersectionObserver 뷰포트 밖 rAF 중단 / visibilitychange 백그라운드 중단). `onUnmounted`에서 rAF·옵저버·리스너·타이머 전부 해제 |
| `composables/useCountryPreview.ts` | 250ms 디바운스(`open`) + 디바운스 없는 `openImmediate`(키보드) + Map 캐시 TTL 5분 + in-flight Promise 공유 + `AbortController`(close 시 abort). 응답 stale 판정은 Promise identity 비교 — abort/교체된 요청은 에러로 표면화되지 않음 |
| `composables/useMapMode.ts` | `useState<'globe'\|'flat'>` 기본 'globe', localStorage `earthletter-map-mode`. SSR은 항상 globe, onMounted에서 저장값 반영(컴포넌트 스왑 — hydration 안전) |
| `components/CountryPreviewPopover.vue` | presentational(패칭 없음). 고정 width 280px, centroid % 앵커 + placement별 transform(top/bottom/left/right), 스켈레톤 3행(레이아웃 점프 방지)/빈 상태("No recent articles")/에러("Couldn't load preview") 상태, `hasContent=true`만 `/article/:id` NuxtLink, 토픽 뱃지 + 제목 1줄 ellipsis + `useRelativeTime`, primary "View all →" 버튼, `role="status"` + `aria-live="polite"` + `id="globe-preview"` |
| `components/GlobeMap.vue` | WorldMap과 props/emits 계약 동일 + `autoRotate?`, `initialRotation?`(기본 `[0,-15,0]`), `focusCountryCode?`(아래 § 3-1). sphere(바다) → graticule → 국가 path(WorldMap의 fill/aria/tabindex/키보드 핸들러 이식 + `aria-describedby="globe-preview"`) → trending amber 오버레이(pointer-events-none, 국가 위) → 팝오버 → 범례. fine pointer 호버 → 250ms 디바운스 프리뷰 / 클릭 즉시 이동, coarse pointer 2-탭 모델(1탭 프리뷰, 2탭·View all 이동, 바다 탭 닫기), focus → 즉시 프리뷰, Enter/Space → 이동, Escape → 닫기. 드래그 중 호버 차단 + 팝오버 즉시 닫기. 경계 플립: xPct>60 → left, yPct<35 → bottom, 그 외 top |
| `components/MapModeToggle.vue` | 3D/2D 버튼, `aria-pressed`, `update:mode` emit. 페이지에서 지도 우상단 absolute 오버레이로 배치 |

### 수정

| 파일 | 내용 |
|------|------|
| `pages/index.vue` | `useMapMode()` + 모드 분기(`GlobeMap`/`WorldMap`) + `MapModeToggle`(우상단). `AvailableCountriesStrip`/`CountrySelector` 보존(§ 9-5) |
| `pages/trending.vue` | 동일 분기 + `focusCountryCode = items[0]?.countryCode`를 GlobeMap에 전달(1위 국가 정면 회전) |

### 무수정 (제약 준수)

- `components/WorldMap.vue` — 한 줄도 수정 안 함 (§ 9-7)
- `types/dto.ts` — backend-dev가 추가한 `CountryPreview*` DTO를 import만 함
- `server/**` — 무접촉

## 2. 검증 결과

| 항목 | 결과 |
|------|------|
| `pnpm typecheck` | **통과 (exit 0)** — backend 구현이 먼저 완료되어 server/ 쪽 에러 없이 전체 통과 |
| `pnpm lint` | **통과 (0 errors)** — 유일한 warning은 기존 `ArticleContent.vue`의 `vue/no-v-html` (이번 변경과 무관, 기존재) |
| 런타임 성능 검증(§ 6.8: 드래그 프레임 16/33ms, 백그라운드 rAF 정지) | **미수행** — 브라우저 수동 측정 항목으로 QA 단계 위임 (QA 체크리스트 § 10에 이미 포함) |

## 3. 설계 대비 변경 사항과 사유

1. **trending 초기 회전: `initialRotation` 좌표 전달 → `focusCountryCode` prop 추가로 변경.**
   - 설계 § 6.7은 페이지가 1위 국가 centroid 경위도를 계산해 `initialRotation`으로 전달하라고 했으나, centroid 계산에는 topo 데이터가 필요하고 topo는 GlobeMap(useGlobeProjection) 내부에만 로드된다. 또한 `useTrending()`은 `lazy: true`라 SSR 시점에 데이터가 없을 수 있어, 페이지에서 좌표를 만들면 서버/클라이언트 setup 값이 갈려 hydration mismatch 위험이 있다.
   - 대신 GlobeMap이 `focusCountryCode`를 받아 **setup에서 결정적으로**(서버·클라이언트 동일 prop) `geoCentroid` 기반 회전을 파생하고, lazy 데이터가 마운트 후 도착하는 경우엔 **사용자가 아직 인터랙션하지 않았을 때 1회만** `rotateTo`로 반영한다(§ 9-3 "초기값 1회만 사용" 준수 — 이후 refetch 변화는 무시). `initialRotation` prop 자체는 설계대로 존재(홈 기본 상수 `[0,-15,0]`).
2. **setPointerCapture는 3px 이동 후 지연 시작.** pointerdown 즉시 캡처하면 click 이벤트가 캡처 요소(svg)로 재타게팅되어 국가 클릭 내비게이션이 깨진다. 탭/클릭은 캡처 없이 path 타깃을 유지하고, 3px 초과 이동 시점에 캡처를 걸어 드래그가 svg 밖으로 나가도 추적되게 했다. 드래그 후 click 오발은 `lastDragDistance > 5px` 가드로 차단.
3. **팝오버 props에 `countryCode`/`countryName` 추가.** 설계 § 6.4의 4개 props(preview/status/anchor/placement)만으로는 로딩 헤더와 **에러 상태의 "View all →" 링크**(§ 6.3: 에러여도 국가 페이지 이동은 가능해야 함)를 만들 수 없어 보강.
4. **trending amber 오버레이를 국가 path 위에 렌더.** WorldMap은 오버레이 `<g>`가 국가 path보다 앞(아래 레이어)에 있으나, 설계 § 2-D8 문구("국가 path 위에 겹쳐 그린다")를 따라 GlobeMap에서는 국가 위 레이어로 배치했다. WorldMap은 무수정 원칙에 따라 그대로 둠.
5. **국가→국가 이동 시 150ms 닫기 유예.** "국가도 팝오버도 아닌 곳"에서만 닫힌다는 § 6.4 규칙을 구현하기 위해 pointerleave에 150ms 유예를 두고, 팝오버 pointerenter가 이를 취소한다.
6. **WorldMap의 커서 추적 이름 툴팁은 이식하지 않음.** 팝오버 헤더가 국가명을 표시하므로 중복이며, 설계도 globe에는 팝오버만 명시.

## 4. 후속(QA) 참고

- 드래그 프레임 타임/백그라운드 CPU 0% 수렴/reduced-motion은 § 10 체크리스트대로 브라우저에서 검증 필요.
- 2-탭 모델 판별은 `matchMedia('(pointer: coarse)')` 1회 평가(onMounted). 하이브리드 기기(터치+마우스)는 coarse로 분류됨.
- `_workspace/02_backend_done.md` 기준 API는 계약(§ 5)대로 완료 — 프론트는 `$fetch('/api/countries/{code}/preview')`만 사용.

## 5. QA 피드백 반영 (2026-06-10, `_workspace/03_qa_report.md` § 3 Medium 2건)

### BUG-1 [Medium] closeTimer 언마운트 미정리 → 죽은 컴포넌트에서 rAF 루프 재시작 누수

- 재현 경로: 국가 호버 → 바다로 이동(`scheduleClose` 150ms 타이머) → 즉시 라우팅 이탈 → 타이머 발화 → `closePreview` → `resumeAfterIdle` → 5s 뒤 `startLoop`가 언마운트된 컴포넌트의 rAF를 재가동(옵저버 해제로 `inViewport=true` 고정 → 영구 루프).
- 수정 (이중 방어, QA 수정안 둘 다 적용):
  1. `components/GlobeMap.vue` — `onUnmounted(cancelScheduledClose)` 추가 (1차 차단: 타이머 자체를 제거).
  2. `composables/useGlobeRotation.ts` — `disposed` 플래그 추가. `onUnmounted`에서 `disposed = true`, `startLoop()`/`scheduleIdleResume()` 진입부에 `if (disposed) return` 가드 (2차 차단: 어떤 늦은 호출자도 언마운트 후 루프·타이머를 재가동 불가).

### BUG-2 [Medium] 키보드 사용자가 팝오버 내부 도달 불가 + 팝오버 포커스 중 Escape 미동작

- 증상: Tab으로 국가 path → 팝오버 NuxtLink로 포커스 이동 시 path `blur` → `scheduleClose` 발동 → 포커스를 머금은 채 팝오버가 닫힘. 또한 `@keydown.escape`가 svg에만 걸려 있어 포커스가 팝오버 내부일 때 Escape가 동작하지 않음.
- 수정 (`components/GlobeMap.vue`):
  1. 팝오버에 `@focusin`(popoverHovered=true + cancelScheduledClose) / `@focusout`(popoverHovered=false + scheduleClose) 추가 — 포커스도 호버와 동일하게 "팝오버 위에 있음"으로 취급(§ 2-D7 "키보드 = 호버와 동급"의 일관 적용). focusin/focusout은 버블되므로 래퍼 루트 바인딩으로 내부 링크 전체를 커버.
  2. `@keydown.escape="closePreview"`를 svg에서 외곽 컨테이너 div로 이동 — 팝오버 포함 모든 자손에서 keydown이 버블되어 Escape가 항상 닫기로 동작.
- WorldMap.vue는 계속 무수정 (§ 9-7 준수).

### 재검증 결과

| 항목 | 결과 |
|------|------|
| `pnpm test` | **통과** — 14 files / 101 tests passed (globe-rotation, country-preview 단위 테스트 포함) |
| `pnpm typecheck` | **통과 (exit 0)** |
| `pnpm lint` | **통과 (0 errors)** — warning 1건은 기존 `ArticleContent.vue` `vue/no-v-html` (기존재, 무관) |
