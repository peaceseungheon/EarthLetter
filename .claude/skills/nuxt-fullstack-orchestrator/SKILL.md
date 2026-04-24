---
name: nuxt-fullstack-orchestrator
description: Nuxt 3 풀스택 웹사이트 개발 팀 오케스트레이터. architect(설계 전략), frontend-dev(프론트엔드), backend-dev(백엔드), qa(품질 검증) 에이전트를 조율한다. "기능 개발해줘", "Nuxt로 만들어줘", "풀스택 구현", "아키텍처부터 구현까지", "다시 실행", "재실행", "이전 결과 개선", "[기능] 추가해줘", "[페이지] 만들어줘", "처음부터 만들어", "업데이트해줘" 요청 시 반드시 사용할 것.
---

# Nuxt Fullstack Orchestrator

## 에이전트 팀 구성

**실행 모드:** 에이전트 팀 (파이프라인 패턴)

| 에이전트 | 파일 | 역할 |
|---------|------|------|
| architect | `.claude/agents/architect.md` | 설계 전략 + 패턴 검토 |
| frontend-dev | `.claude/agents/frontend-dev.md` | Vue/Nuxt 프론트엔드 |
| backend-dev | `.claude/agents/backend-dev.md` | Nitro 서버 + DB |
| qa | `.claude/agents/qa.md` | 통합 검증 + 테스트 |

## Phase 0: 컨텍스트 확인

```
_workspace/ 존재 여부 확인:
  없음 → 초기 실행 → Phase 1부터
  있음 + 사용자가 "다시"/"업데이트"/"개선" → 부분 재실행 → 해당 Phase만
  있음 + 새 기능 요청 → _workspace/를 _workspace_prev/로 이동 → Phase 1부터
```

부분 재실행 시: 요청된 에이전트만 재호출하고 나머지는 기존 산출물 유지.

## Phase 1: 아키텍처 설계 (architect 주도)

**실행 모드:** 단독 (architect만 실행)

```
TeamCreate: team_name="nuxt-dev", members=["architect"]
TaskCreate: "기능 요청 분석 + _workspace/00_architecture.md 생성"

architect 완료 조건: _workspace/00_architecture.md 파일 생성
```

architect 산출물:
- `_workspace/00_architecture.md` — 디렉토리 구조, 패턴, API 계약, 작업 범위

**완료 후:** frontend-dev, backend-dev에게 아키텍처 공유

## Phase 2: 병렬 구현 (frontend-dev + backend-dev)

**실행 모드:** 에이전트 팀 (병렬 실행)

```
TeamCreate: team_name="nuxt-dev-impl", members=["frontend-dev", "backend-dev"]

TaskCreate:
  - "frontend: _workspace/00_architecture.md 기반 프론트엔드 구현"
  - "backend: _workspace/00_architecture.md 기반 백엔드 구현"
  (두 작업 동시 시작 — 의존성 없음)
```

통신 프로토콜:
- API 계약 변경 시: backend-dev → frontend-dev `"api:changed"` 메시지
- 설계 질문 시: 양쪽 → architect (SendMessage)

완료 조건:
- `_workspace/01_frontend_done.md` 생성
- `_workspace/02_backend_done.md` 생성

## Phase 3: QA 검증 (qa 주도)

**실행 모드:** 단독 (qa만 실행)

```
TaskCreate: "경계면 교차 비교 + 버그 리포트 + 테스트 작성"

qa 입력:
  - _workspace/00_architecture.md
  - _workspace/01_frontend_done.md
  - _workspace/02_backend_done.md
  - 실제 소스 파일

qa 완료 조건: _workspace/03_qa_report.md 생성
```

Critical 버그 발견 시:
→ 해당 에이전트에게 SendMessage → 수정 후 재검증 (Phase 3 반복)

## Phase 4: 결과 종합 및 보고

오케스트레이터가 최종 보고를 사용자에게 전달:

```markdown
## 구현 완료 보고

### 생성된 파일
[파일 목록]

### 아키텍처 요약
[주요 패턴 및 설계 결정]

### QA 결과
[통과/실패 항목, 남은 이슈]

### 다음 단계 제안
[추가 가능한 기능, 개선 포인트]
```

## 에러 핸들링

| 상황 | 처리 |
|------|------|
| architect 산출물 불완전 | 가정 명시하고 계속 진행 |
| frontend-dev / backend-dev 간 API 불일치 | 양쪽 agent에게 협의 지시, 최대 1회 재시도 |
| Critical QA 버그 | 해당 agent에게 수정 지시, 재검증 1회 |
| 전체 실패 | 현재까지 완료된 내용 + 실패 원인 보고 |

## 데이터 흐름

```
사용자 요청
    ↓
[architect] → _workspace/00_architecture.md
    ↓
[frontend-dev] → pages/, components/, composables/, stores/
[backend-dev] → server/api/, server/middleware/, server/utils/
    ↓ (병렬)
[qa] → _workspace/03_qa_report.md + tests/
    ↓
최종 보고 (오케스트레이터)
```

## 테스트 시나리오

### 정상 흐름

```
입력: "간단한 할 일 목록 앱 만들어줘. 로그인, CRUD, 실시간 업데이트 없음"
예상 흐름:
  1. architect → 5개 API 엔드포인트, 3개 페이지 명세 생성
  2. frontend-dev + backend-dev 병렬 구현
  3. qa → API shape 교차 비교 통과, 경계면 버그 0건
  4. 최종 보고
```

### 에러 흐름 (API 불일치)

```
상황: backend-dev가 { todo_items } 반환, frontend-dev가 { todos } 기대
처리:
  1. qa가 경계면 불일치 감지 → backend-dev에게 "bug:api" 메시지
  2. backend-dev가 DTO 수정 후 "api:changed" 알림
  3. qa 재검증
```

## 후속 작업 처리

이전 세션에서 구현한 내용에 추가/수정 요청 시:

```
Phase 0에서:
  1. _workspace/ 확인
  2. 어느 에이전트 산출물이 영향받는지 결정
  3. 영향받는 Phase만 재실행
  예: "로그인 페이지 수정" → architect(아키텍처 변경 없으면 skip) + frontend-dev만 재실행 + qa
```
