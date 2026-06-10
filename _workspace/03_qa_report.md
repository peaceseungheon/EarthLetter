# 이터레이션 8 QA 리포트 — 3D 지구본 + 호버 프리뷰

작성: qa agent / 2026-06-10
입력: `_workspace/00_architecture.md`(§ 5 계약, § 10 체크리스트), `01_frontend_done.md`, `02_backend_done.md`

## 결론 요약

**qa:done — Critical 0건, High 0건, Medium 2건, Low 6건.**
경계면(API ↔ 프론트) 불일치 **0건**. 전체 테스트 101건 통과(신규 30건 포함), typecheck/lint 통과(테스트 코드 자체의 초기 lint/type 오류는 QA가 수정 완료).

---

## 1. 검증 항목 체크리스트

| # | 항목 | 결과 | 비고 |
|---|------|------|------|
| 1 | 경계면 교차 비교 (DTO ↔ select/매핑 ↔ 프론트 소비) | **통과** | § 2 상세 |
| 2 | publishedAt Date → ISO 직렬화 | **통과** | `articles.ts:166` `.toISOString()` + 단위 테스트로 고정 |
| 3 | 400/404/200-빈배열 분기 | **통과(정적+단위)** | `preview.get.ts:32-52`. 빈배열은 404 아님(54행 → 200) |
| 4 | limit 1~5 검증 (소수/0/6+/비숫자/중복 파라미터) | **통과(단위)** | `parseLimit` 미러 테스트. `?limit=1&limit=2`(배열)도 400 확인 |
| 5 | 대소문자 처리 (`kr` → `KR`) | **통과** | `preview.get.ts:31` toUpperCase 후 정규식 |
| 6 | Cache-Control 헤더 | **통과(정적)** | 200 경로에서만 `public, s-maxage=300, swr=900` 설정(56행). 에러 응답엔 미설정 — 올바름 |
| 7 | 단위 테스트 작성+실행 | **통과** | 신규 3파일 30테스트, § 4 |
| 8 | SSR hydration 위험 | **통과(정적)** | 초기 회전 상수 `[0,-15,0]`, focus 회전은 setup에서 양측 동일 prop으로 결정적. `useMapMode`는 SSR 'globe' 고정 + onMounted 스왑 |
| 9 | 메모리 누수 (rAF/리스너/옵저버) | **부분 실패** | `useGlobeRotation` onUnmounted 정리는 완전. 단 GlobeMap `closeTimer` 미정리 → BUG-1 (Medium) |
| 10 | 드래그 중 호버 차단 | **통과(정적)** | `onCountryEnter`가 `isDragging` 체크 + `watch(isDragging)`이 팝오버 닫음 + pointer capture가 enter 이벤트 자체 차단 |
| 11 | abort 처리 | **통과(단위)** | close() abort, 국가 전환 시 이전 fetch abort, abort된 응답 미표면화 모두 테스트로 검증 |
| 12 | WorldMap.vue 무수정 | **통과** | `git status`에 WorldMap.vue 없음 (마지막 변경 커밋 5577c13 이전) |
| 13 | 회귀: pnpm test | **통과** | 14파일 101테스트 all pass |
| 14 | 회귀: pnpm typecheck | **통과** | exit 0 (QA 테스트 코드의 `vi.spyOn` 타입 오류 1건은 QA가 자체 수정) |
| 15 | 회귀: pnpm lint | **통과** | 0 errors. 잔여 warning 1건은 기존 `ArticleContent.vue` vue/no-v-html (기존재) |
| 16 | 접근성 정적 체크 | **부분 실패** | aria-describedby ✓, role=status+aria-live ✓, aria-pressed ✓, tabindex ✓, Escape는 svg 내부에서만 동작 → BUG-2 (Medium) |
| 17 | 브라우저 실측 (드래그 프레임 타임, 백그라운드 CPU 0%, 실 curl, 페이로드 실측) | **미검증** | dev 서버 기동에 DATABASE_URL 필요(.env 부재). 지시에 따라 DB/.env 미생성. § 10 수동 체크리스트로 이관 |
| 18 | 팝오버 경계 플립, 모바일 2-탭, reduced-motion 동작 | **미검증(브라우저 필요)** | 코드 경로는 정적 확인 완료 — 구현 존재함 |

## 2. 경계면 교차 비교 — 불일치 0건

3중 대조: 계약(§ 5.2) ↔ `types/dto.ts:100-113` ↔ `articles.ts:161-168`(매핑) ↔ `CountryPreviewPopover.vue`(소비).

| 필드 | DTO | 백엔드 실제 생산 | 프론트 소비 | 판정 |
|------|-----|------|------|------|
| `countryCode` | IsoCountryCode | `country.code` (`preview.get.ts:59`) | `previewState.code` 기반 라우팅 | 일치 |
| `countryName` | string | `country.nameEn` (60행) | `preview?.countryName ?? countryName` (nullable 안전) | 일치 |
| `items[].id` | string | row.id | `:key`, `/article/${id}` | 일치 |
| `items[].title` | string | row.title | 표시 | 일치 |
| `items[].topicSlug` | TopicSlug | `r.source.topicSlug as TopicSlug` | `TOPIC_META[slug]?.labelEn ?? slug` (미지 슬러그 안전) | 일치 |
| `items[].sourceName` | string | `r.source.name` → 평탄화 | 표시 | 일치 — snake_case/중첩객체 드리프트 없음 |
| `items[].publishedAt` | ISO string | `.toISOString()` (166행) | `useRelativeTime(iso: string)` — string 시그니처 일치, NaN 가드 있음 | 일치 |
| `items[].hasContent` | boolean | `resolveHasContentSet` 2단계 쿼리 | `v-if="item.hasContent"` 내부 링크 분기 | 일치 |

- camelCase 일관 ✓, 배열/단수 혼동 없음 ✓, 빈 items에 대한 프론트 빈 상태 문구("No recent articles") 존재 ✓ (§ 9-8 충족)
- lean select 불변식: `contentHtml/summary/link/imageUrl` 미선택 — 단위 테스트로 고정 (`country-preview-contract.spec.ts`)
- `enabled: true` 소스 필터 + `publishedAt desc` + `take: limit` — 단위 테스트로 고정

## 3. 발견 버그 목록

### BUG-1 [Medium] GlobeMap `closeTimer` 언마운트 미정리 → 사후 타이머 체인이 죽은 컴포넌트의 rAF 루프 재시작 가능
- 위치: `components/GlobeMap.vue:119,143-149` (+ `composables/useGlobeRotation.ts:177-184`)
- 증상: 팝오버 grace-close 타이머(150ms)가 pending인 상태로 페이지 이탈(언마운트) 시 타이머가 정리되지 않음. 발화하면 `closePreview() → resumeAfterIdle() → scheduleIdleResume()`이 새 idleTimer(5s)를 만들고, 5초 뒤 `startLoop()`이 언마운트된 컴포넌트에서 rAF 루프를 재가동. `useGlobeRotation`의 onUnmounted는 이미 실행된 뒤라(observer 해제됨, inViewport=true 고정) `shouldLoop()`이 계속 true → **무한 rAF 루프 누수**.
- 재현: 국가 호버 → 포인터를 바다로 이동(scheduleClose 발동) → 150ms 안에 다른 페이지로 라우팅.
- 담당: **frontend**. 수정안 (둘 다 권장):
  1. GlobeMap에 `onUnmounted(() => cancelScheduledClose())` 추가.
  2. 방어선: `useGlobeRotation`에 `disposed` 플래그를 두고 onUnmounted에서 set, `startLoop`/`scheduleIdleResume`에서 `if (disposed) return` 가드.

### BUG-2 [Medium] 키보드 사용자가 팝오버 내부 콘텐츠에 도달 불가 + 팝오버 포커스 중 Escape 미동작 (§ 10 "Escape 닫기" 부분 실패)
- 위치: `components/GlobeMap.vue:177-179` (`onCountryBlur`), `267행` (`@keydown.escape`는 svg에만), `336-337행` (popoverHovered는 pointerenter로만 set)
- 증상 1: Tab으로 마지막 국가 path에서 팝오버의 NuxtLink로 포커스 이동 시 blur → `scheduleClose()` 발동, `popoverHovered`(포인터 전용)가 false라 150ms 뒤 팝오버가 **포커스를 머금은 채 닫힘**. 기사 링크/"View all" 버튼을 키보드로 활성화 불가.
- 증상 2: `@keydown.escape`가 svg 요소에만 바인딩 — 포커스가 팝오버 내부(NuxtLink)에 있으면 Escape가 닫지 못함.
- 완화 요인: 국가 path에서 Enter는 국가 페이지로 정상 이동(계약 § 2-D7 핵심 경로는 동작), 모든 국가는 CountrySelector/Strip으로도 접근 가능.
- 담당: **frontend**. 수정안: 팝오버 래퍼에 `@focusin="popoverHovered = true; cancelScheduledClose()"`, `@focusout="popoverHovered = false; scheduleClose()"` 추가하고, Escape는 svg가 아닌 외곽 컨테이너 div(또는 popover 자체)에 `@keydown.escape="closePreview"`로 이동.

### BUG-3 [Low] `aria-describedby="globe-preview"`가 팝오버 닫힘 상태에선 존재하지 않는 id 참조
- 위치: `components/GlobeMap.vue:304`
- 증상: clickable path 전부가 상시 `aria-describedby`를 가지나 대상 id는 팝오버 오픈 시에만 DOM에 존재. 스크린리더는 무시하므로 실해는 적지만 ARIA 명세 위반. 수정안: `:aria-describedby="previewState?.code === shape.code ? 'globe-preview' : undefined"`.

### BUG-4 [Low] `prefers-reduced-motion`을 bind() 시 1회만 평가 — 세션 중 OS 설정 변경 미반영
- 위치: `composables/useGlobeRotation.ts:286-288`. `matchMedia(...).matches` 스냅샷만 사용, change 리스너 없음. 수정안: `addEventListener('change', ...)` + onUnmounted 해제.

### BUG-5 [Low] 캐시 히트 경로에서 타 국가의 in-flight 요청을 abort하지 않음
- 위치: `composables/useCountryPreview.ts:55-59`. A국 fetch 진행 중 B국(캐시 hit) 호버 시 A 요청이 백그라운드에서 완주(결과는 캐시에만 적재, UI 오염 없음 — 테스트로 확인). 네트워크 낭비 1건 수준.

### BUG-6 [Low] 팝오버 anchor가 오픈 시점 1회만 계산 — 관성 회전 중 호버하면 anchor가 국가 위치와 어긋남
- 위치: `components/GlobeMap.vue:218-236` (watch가 `previewState.code` 변경 시에만 재계산, rotation 미추적). 드래그 시작 시 팝오버가 닫히므로 실사용 영향 작음. 수정안(선택): watch 소스에 rotation 포함 또는 관성 중 호버 무시.

### BUG-7 [Low/Info] `assets/geo/countries-110m.json` 워킹트리 변경 — 줄바꿈(LF→CRLF) 전용 churn
- postinstall 복사 스크립트가 Windows에서 재실행되며 발생. 내용 변경 없음. 권장: `git checkout -- assets/geo/countries-110m.json` + `.gitattributes`에 `*.json -text` 또는 해당 파일 `binary` 지정. 담당: backend/chore.

### BUG-8 [Info] 자동 회전 λ 누적 무한 증가 (모듈로 없음)
- `useGlobeRotation.ts:145`. d3는 임의 각도를 수용하므로 기능 문제 없음. 수 시간 연속 구동 시 부동소수 정밀도만 이론상 저하. 조치 불요(기록만).

## 4. 작성한 테스트 + 실행 결과

| 파일 | 테스트 수 | 내용 |
|------|-----------|------|
| `tests/unit/country-preview.spec.ts` | 12 | 디바운스(250ms 미만 0회/타이머 교체/close 취소), openImmediate 무디바운스, 캐시 TTL 5분(히트 0회/만료 재요청), in-flight dedupe(동일 code 1요청), abort(close/국가 전환), 에러 표면화 + 에러 미캐시 |
| `tests/api/country-preview-contract.spec.ts` | 10 | parseLimit/code 검증 미러(기본 3, 1~5, 소수/0/6/배열 → 400, 소문자 정규화), **실제 `findRecentByCountry` 코드**를 prisma mock으로 구동: DTO 키 정확 일치, Date→ISO, hasContent 파생, lean select(contentHtml 등 미선택), enabled+desc+take, 0건 시 단일 쿼리 |
| `tests/unit/globe-rotation.spec.ts` | 8 | 초기 회전 결정성([0,-15,0], 입력 배열 비공유), rotateTo φ ±80 클램프 + γ=0 강제, hasInteracted 후 no-op, 관성 감쇠 모델 드리프트 가드(유한 종료, 40px/f → ≤150프레임) |

실행 결과 (`pnpm test`): **14 files / 101 tests — 전부 통과** (신규 30 포함, 기존 71 회귀 무손상).

테스트 분리 한계 (리포트 기록 의무 사항):
- `preview.get.ts`의 `parseLimit`/`ISO_ALPHA2`는 미export → 핸들러 직접 테스트 불가, 기존 `trending-spikeratio.spec.ts` 스타일의 미러 구현으로 대체(드리프트 가드).
- `useGlobeRotation`의 `clampPhi`/관성 상수 미export, rAF 루프·포인터 핸들러·4중 정지 조건은 DOM 필수 → 공개 API(rotateTo/pause)로 검증 가능한 범위만 단위화, 나머지는 § 10 수동 항목.
- `useGlobeProjection`은 topojson 동적 import + d3 의존이라 node 단위 테스트 비용 대비 가치 낮아 정적 검증으로 대체.

## 5. 회귀 검증

| 명령 | 결과 |
|------|------|
| `pnpm test` | ✅ 101/101 |
| `pnpm typecheck` | ✅ exit 0 |
| `pnpm lint` | ✅ 0 errors (warning 1건은 기존재 `ArticleContent.vue` vue/no-v-html) |

참고: QA가 처음 작성한 테스트에서 lint 오류(import/first) 1건과 typecheck 오류(vi.spyOn 제네릭) 1건이 나와 **QA 테스트 코드 측에서** 수정 후 전체 녹색 확인. 프로덕션 코드는 무수정.

## 6. 미검증 항목 — 사유

- **드래그 프레임 타임(16/33ms), 백그라운드 탭 CPU 0% 수렴, reduced-motion 실동작, 팝오버 경계 플립, 모바일 2-탭, 실 curl(400/404/빈배열/Cache-Control/페이로드<1KB)**: dev 서버 기동에 DATABASE_URL 필요하나 `.env` 부재. 지시("억지로 .env 만들거나 DB 건드리지 말 것")에 따라 미수행. 코드 경로 존재는 전부 정적 확인 완료.

## 7. 권장 수정 사항 (오케스트레이터 지시용)

1. **frontend**: BUG-1 — GlobeMap에 `onUnmounted(cancelScheduledClose)` + useGlobeRotation `disposed` 가드 (5분 작업).
2. **frontend**: BUG-2 — 팝오버 focusin/focusout 처리 + Escape 바인딩 위치 이동 (§ 10 키보드 체크리스트 충족 필요).
3. **chore**: BUG-7 — geo json 워킹트리 복원 + .gitattributes. 커밋 전 처리 권장(13MB급 파일의 무의미 diff 방지).
4. BUG-3~6, 8은 다음 이터레이션 백로그로 기록만.
