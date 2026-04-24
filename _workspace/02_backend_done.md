# Phase 3 — Backend Day 0 완료

**Date:** 2026-04-24
**Status:** Day 0 완료. frontend-dev 언블록됨.

## 완료된 파일

- `prisma/schema.prisma` — Source: failCount, lastFailedAt, disabledAt, createdAt 추가; Article: onDelete Cascade 추가; 인덱스 추가
- `types/dto.ts` — AdminSourceDTO, AdminSourcesResponseDTO, AdminSourceCreateDTO, AdminSourcePatchDTO, AdminSourceDeleteResponseDTO, AdminSourcesQueryDTO 추가; IngestResponseDTO.autoDisabled 추가
- `.env.example` — el_admin 쿠키 설명 추가

## Day 1+ 남은 작업

- server/utils/auth.ts — requireAdminSession 추가
- server/utils/repositories/sources.ts — CRUD + 실패 집계 함수 추가
- server/utils/services/sourceAdmin.ts — 신규 생성
- server/utils/services/ingest.ts — 실패/성공 집계 + autoDisabled 반환
- server/api/admin/* — 6개 엔드포인트 (session, sources CRUD)
- prisma/seed.ts — 10 → 30개국
- nuxt.config.ts — /admin/** routeRules
- 테스트 파일들

## Day 1+ 완료 — 2026-04-24

### 생성/수정된 파일

- `server/utils/auth.ts` — requireAdminSession 추가
- `server/utils/repositories/sources.ts` — recordSourceSuccess, recordSourceFailure, listAdminSources, findAdminSource, createSource, updateSource, deleteSource 추가
- `server/utils/services/sourceAdmin.ts` — 신규 (검증 + 오케스트레이션)
- `server/utils/services/ingest.ts` — 실패/성공 집계 + autoDisabled 반환
- `server/api/admin/session.post.ts` — 신규
- `server/api/admin/session/logout.post.ts` — 신규
- `server/api/admin/sources.get.ts` — 신규
- `server/api/admin/sources.post.ts` — 신규
- `server/api/admin/sources/[id].patch.ts` — 신규
- `server/api/admin/sources/[id].delete.ts` — 신규
- `nuxt.config.ts` — /admin/**, /api/admin/** routeRules 추가
- `prisma/seed.ts` — 10 → 30개국

### 알려진 약점 (QA용)

1. rate limiting은 in-memory Map — Vercel cold start 시 리셋됨
2. seed.ts의 일부 RSS URL은 `// REVIEW:` 표시 — 실제 URL 검증 필요
3. deleteSource는 onDelete Cascade에 의존하되 articleCount를 별도 쿼리로 카운트 — 경쟁 조건 가능성 낮음
4. requireAdminSession이 runtimeConfig.ingestSecret을 읽는데 이 값이 비어있으면 모든 요청이 통과될 수 있음 — 빈 값 guard 필요
