# Phase 3 — QA Report

**Date:** 2026-04-24
**Author:** qa agent

## TL;DR

**Critical: 0 / Major: 2 / Minor: 5**

구현이 아키텍처 명세에 충실하게 작성됨. 프로덕션 배포 전 2개 Major 버그 수정 필요:
1. `logout.post.ts` 쿠키 삭제 시 보안 속성 누락
2. `placeholder.example` URL 3개 프로덕션 차단 필요

---

## 1. API 계약 경계면 교차 확인

| Endpoint | BE 반환 타입 | FE 소비자 | 판정 |
|---|---|---|---|
| GET `/api/admin/sources` | `AdminSourcesResponseDTO` | `stores/adminSources.ts:98` | ✅ |
| POST `/api/admin/sources` | `AdminSourceDTO` (201) | `stores/adminSources.ts:151` | ✅ |
| PATCH `/api/admin/sources/:id` | `AdminSourceDTO` | `stores/adminSources.ts:131,191` | ✅ |
| DELETE `/api/admin/sources/:id` | `AdminSourceDeleteResponseDTO` | `stores/adminSources.ts:169` | ✅ |

`AdminSourceDTO` 필드 커버리지: `id`, `countryCode`, `topicSlug`, `name`, `feedUrl`, `enabled`, `failCount`, `lastFailedAt`, `disabledAt`, `articleCount` 모두 FE에서 소비됨. `createdAt` 미표시 — minor, 버그 아님.

---

## 2. 인증 흐름

| 항목 | 파일:라인 | 상태 |
|---|---|---|
| `requireAdminSession` 구현 | `server/utils/auth.ts:71` | ✅ |
| timing-safe compare | `server/utils/auth.ts:17–22` | ✅ |
| 빈 secret guard (length < 8 → 500) | `server/utils/auth.ts:75` | ✅ |
| Cookie HttpOnly/Secure/SameSite/MaxAge 설정 | `session.post.ts:120–124` | ✅ |
| `deleteCookie` 보안 속성 | `logout.post.ts:11` | 🟠 Bug #1 |
| `isAuthenticated()` API probe 방식 | `useAdminAuth.ts:52–66` | ✅ (설계 의도) |
| rate limit (5회/10분/IP) | `session.post.ts:57` | ✅ |

---

## 3. Feature F — 인제스트 파이프라인

| 항목 | 파일:라인 | 상태 |
|---|---|---|
| `recordSourceSuccess` 내부 try/catch | `ingest.ts:78–81` | ✅ |
| `recordSourceFailure` 내부 try/catch | `ingest.ts:95–103` | ✅ |
| Prisma `{ increment: 1 }` atomic | `sources.ts:73–77` | ✅ |
| auto-disable 조건 (failCount >= threshold) | `sources.ts:82` | 🟠 Bug #2 (이중 카운트 위험) |
| `disabledAt` 자동 설정 | `sources.ts:87` | ✅ |
| re-enable 시 `failCount=0`, `disabledAt=null` 리셋 | `sources.ts:239–241` | ✅ |
| `IngestResponseDTO.autoDisabled` 반환 | `ingest.ts:116–123` | ✅ |

---

## 4. 스키마

| 항목 | 파일:라인 | 상태 |
|---|---|---|
| `Source.failCount Int @default(0)` | `schema.prisma:38` | ✅ |
| `Source.lastFailedAt DateTime?` | `schema.prisma:39` | ✅ |
| `Source.disabledAt DateTime?` | `schema.prisma:40` | ✅ |
| `Source.createdAt DateTime @default(now())` | `schema.prisma:41` | ✅ |
| `Article.source onDelete: Cascade` | `schema.prisma:62` | ✅ |
| `@@index([enabled, disabledAt])` | `schema.prisma:48` | ✅ |

---

## 5. routeRules

| 항목 | 상태 |
|---|---|
| `/admin/**` Cache-Control: no-store, private | ✅ |
| `/admin/**` X-Robots-Tag: noindex, nofollow | ✅ |
| `/admin/**` robots: false | ✅ |
| `/api/admin/**` cors: false | ✅ |
| `/admin/**` ssr: true 명시 | 🟡 Bug #5 (글로벌 default 의존 — 기능 동일) |

---

## 6. 시드 데이터

| 항목 | 상태 |
|---|---|
| 기존 10개국 유지 | ✅ |
| 신규 20개국 추가 (AU NZ SG PH ID IT ES NL PL UA CA BR MX AR AE SA TR ZA NG EG) | ✅ |
| 총 30개국, 90개 소스 | ✅ |
| upsert 패턴 유지 | ✅ |
| `placeholder.example` URL 3개 존재 | 🟠 Bug #6 (프로덕션 차단 필요) |

---

## 7. 버그 목록

### 🟠 Major

**Bug #1 — `logout.post.ts` 쿠키 삭제 시 보안 속성 누락**

- 파일: `server/api/admin/session/logout.post.ts:11`
- `deleteCookie(event, ADMIN_COOKIE_NAME, { path: '/' })` — `httpOnly`, `secure`, `sameSite` 속성 누락
- Safari ITP 등 strict 환경에서 쿠키가 삭제되지 않을 수 있음
- **Fix:** `deleteCookie(event, ADMIN_COOKIE_NAME, { path: '/', httpOnly: true, secure: true, sameSite: 'strict' })`

**Bug #2 — `recordSourceFailure` 두 번의 별도 Prisma 호출 → autoDisabled 이중 카운트 가능**

- 파일: `server/utils/repositories/sources.ts:82–93`
- increment와 disable이 트랜잭션으로 묶이지 않음 → 동시 인제스트 실행 시 둘 다 `failCount >= threshold` 조건을 만족해 `autoDisabled`가 2로 집계될 수 있음
- 데이터 손상은 없음 (disabled는 idempotent); 카운트 부정확 문제
- **Fix (권고):** 두 update를 `prisma.$transaction`으로 묶기

**Bug #6 — seed.ts에 `placeholder.example` URL 3개 존재**

- 파일: `prisma/seed.ts:648` (PL economy), `prisma/seed.ts:754` (AR politics), `prisma/seed.ts:789` (SA economy)
- 프로덕션 시드 실행 시 즉시 실패 → 5회 후 auto-disable
- **Fix:** 실제 RSS URL로 교체하거나 `enabled: false` 로 pre-disable 상태로 seeding

### 🟡 Minor

**Bug #3 — `isAuthenticated()` 인증 프로브가 전체 소스 목록을 로드**
- `composables/useAdminAuth.ts:53` — 더 가벼운 전용 엔드포인트로 교체 가능 (UX 비용만)

**Bug #4 — `filtered` getter와 서버 필터가 항상 동기화됐다고 가정**
- `stores/adminSources.ts:66–82` — 백그라운드 fetch 시 미미한 데이터 가시성 위험

**Bug #5 — `/admin/**` routeRule에 `ssr: true` 명시 없음**
- `nuxt.config.ts:95` — 글로벌 default 의존; 향후 변경 시 브레이킹 리스크

---

## 8. Phase-3 Exit Criteria

| 조건 | 상태 |
|---|---|
| 모든 admin API 엔드포인트 정상 DTO 반환 | ✅ |
| FE ↔ BE DTO 계약 완전 일치 | ✅ |
| timing-safe + empty-secret guard | ✅ |
| 쿠키 보안 속성 설정 (로그인) | ✅ |
| 쿠키 삭제 시 보안 속성 포함 (로그아웃) | ❌ Bug #1 |
| `recordSourceFailure` atomic increment | ✅ |
| ingest inner try/catch 존재 | ✅ |
| `IngestResponseDTO.autoDisabled` 반환 | ✅ |
| Prisma 스키마 4개 필드 + Cascade + 인덱스 | ✅ |
| routeRules no-store + noindex + robots:false | ✅ |
| 30개국 upsert 시드 | ✅ |
| placeholder URL 없음 | ❌ Bug #6 |

**프로덕션 배포 차단 항목:** Bug #1, Bug #6
