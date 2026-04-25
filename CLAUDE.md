# EarthLetter — Nuxt 풀스택 프로젝트

## 하네스: Nuxt 풀스택 개발

**목표:** architect(설계), frontend-dev(프론트), backend-dev(백엔드), qa(검증) 4인 팀으로 Nuxt 3 풀스택 기능을 설계부터 QA까지 완결 개발

**트리거:** 기능 개발, 컴포넌트 구현, API 설계, 아키텍처 검토 등 Nuxt 관련 개발 작업 요청 시 `nuxt-fullstack-orchestrator` 스킬을 사용하라. 설계/패턴 질문만 있을 때는 `nuxt-architecture` 스킬을 직접 사용해도 된다. 단순 질문은 직접 응답 가능.

## 기능 이력 문서 관리 규칙

`_workspace/FEATURES.md`는 완료된 모든 기능의 단일 진실 공급원이다.

**필수 업데이트 시점:** 이터레이션이 QA까지 완료되어 `_workspace/history/`로 이관되는 시점에 반드시 `FEATURES.md`를 업데이트한다.

**기록 내용:**
- 이터레이션 목록 테이블에 행 추가 (날짜, 기능명, 상태)
- 상세 섹션에 주요 변경 사항 추가 (신규 파일, DB 변경, API, 렌더링 전략 등)

**책임:** `nuxt-fullstack-orchestrator` 스킬의 이터레이션 완료 단계에서 orchestrator가 `FEATURES.md` 업데이트를 마지막 작업으로 수행한다.

---

## _workspace/ 이력 관리 규칙

모든 이터레이션 산출물은 `_workspace/history/YYYY-MM-DD_<기능명>/` 하위 디렉토리에 보관한다. `_workspace/` 루트에는 현재 진행 중인 문서만 유지한다. `_workspace_prev/` 같은 루트 수준 이력 디렉토리는 사용하지 않는다.

```
_workspace/
├── history/
│   └── 2026-04-22_mvp-init/   # 완료된 이터레이션
└── 00_architecture.md          # 현재 진행 중인 문서들
```

**변경 이력:**
| 날짜 | 변경 내용 | 대상 | 사유 |
|------|----------|------|------|
| 2026-04-21 | 초기 구성 | 전체 | Nuxt 풀스택 하네스 신규 구축 |
| 2026-04-24 | _workspace 이력 관리 규칙 추가 | 전체 | history/ 하위 디렉토리 방식으로 통일 |
