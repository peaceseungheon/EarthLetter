---
name: nuxt-architecture
description: Nuxt 3 풀스택 앱의 아키텍처 설계, 디자인 패턴 선택, 컴포넌트 구조, API 계약, 렌더링 전략, Pinia 스토어 설계를 수행. "아키텍처", "설계", "패턴", "구조", "스토어 설계", "API 계약", "렌더링 전략", "Nuxt 구조 어떻게"와 같은 요청 시 반드시 이 스킬을 사용할 것. 구현 전 설계 단계에서 항상 먼저 실행.
---

# Nuxt Architecture Skill

## 목적

기능 요청을 받아 Nuxt 3 프로젝트의 아키텍처 명세 (`_workspace/00_architecture.md`)를 생성하는 스킬. 코드 작성 전에 팀 전체가 동의한 설계 기반을 만드는 것이 목표다.

## Phase 1: 요구사항 분석

요청에서 다음을 추출한다:

1. **도메인**: 무엇을 만드는가? (e-commerce, 블로그, 대시보드 등)
2. **핵심 엔티티**: 주요 데이터 모델은 무엇인가?
3. **사용자 흐름**: 핵심 사용자 여정(happy path) 3가지
4. **제약 조건**: 성능 요건, 인증 필요 여부, SEO 필요 여부, 팀 규모

요구사항이 불명확하면 가정을 명시하고 진행한다. 질문으로 블로킹하지 않는다.

## Phase 2: 디렉토리 구조 설계

표준 Nuxt 3 구조를 기반으로 한다. 필요한 것만 포함하고, 미래를 위한 빈 디렉토리를 만들지 않는다.

```
project/
├── app.vue                    # 루트 컴포넌트
├── pages/                     # file-based routing
│   └── [...slug].vue
├── components/
│   ├── ui/                    # 재사용 UI (Button, Input, Modal)
│   └── [feature]/             # 기능별 컴포넌트
├── composables/               # 공유 로직 (auto-import)
├── stores/                    # Pinia 스토어 (도메인별)
├── layouts/
│   ├── default.vue
│   └── auth.vue
├── middleware/                # 클라이언트 미들웨어
├── plugins/                   # Nuxt 플러그인
├── server/
│   ├── api/                   # API 엔드포인트
│   ├── middleware/            # 서버 미들웨어
│   └── utils/                 # 서버 유틸
├── types/                     # 공유 TypeScript 타입
└── nuxt.config.ts
```

## Phase 3: 디자인 패턴 선택

요구사항에 맞는 패턴을 선택하고 근거를 제시한다.

### 컴포넌트 패턴

| 패턴 | 사용 시점 | Nuxt 적용 |
|------|----------|----------|
| **Container/Presenter** | 데이터 로직과 UI 분리 필요 | Page 컴포넌트(Container) + UI 컴포넌트(Presenter) |
| **Composable Pattern** | 여러 컴포넌트가 같은 로직 공유 | `composables/use*.ts` |
| **Compound Component** | 관련 컴포넌트 그룹 (예: Form + Field + Error) | `components/Form/` 하위 파일들 |
| **Slot-based** | 유연한 레이아웃 필요 | `<slot>`, `<slot name="header">` |

### 데이터 패턴

| 패턴 | 사용 시점 |
|------|----------|
| **Repository Pattern** | DB 접근 로직을 `server/utils/` 에 분리, API 핸들러는 얇게 유지 |
| **DTO 변환** | DB 모델과 API 응답 shape를 분리 (`toDTO()` 함수) |
| **Optimistic Update** | 즉각적 UI 피드백 필요 시 Pinia 스토어에서 선적용 |

### 상태 관리 패턴

```ts
// 도메인별 스토어 분리 원칙
stores/
  useAuthStore.ts    // 인증 상태
  useCartStore.ts    // 장바구니 (e-commerce의 경우)
  useUIStore.ts      // 모달, 토스트 등 UI 상태

// 스토어 기본 구조
export const useExampleStore = defineStore('example', () => {
  // state (refs)
  const items = ref<Item[]>([])

  // getters (computeds)
  const count = computed(() => items.value.length)

  // actions
  async function fetchItems() { ... }

  return { items, count, fetchItems }
})
```

## Phase 4: 렌더링 전략 결정

페이지별로 렌더링 모드를 명시한다.

| 페이지 유형 | 권장 모드 | `definePageMeta` 설정 |
|-----------|---------|---------------------|
| 랜딩/마케팅 | SSG | `routeRules: { '/': { prerender: true } }` |
| 대시보드/마이페이지 | SSR | (기본값) |
| 검색 결과 | SSR | (기본값, 동적 쿼리) |
| 정적 콘텐츠 | SSG | `prerender: true` |
| 실시간 데이터 | CSR | `ssr: false` |

`nuxt.config.ts`의 `routeRules`로 라우트별 전략을 명시한다.

## Phase 5: API 계약 설계

엔드포인트마다 다음을 정의한다:

```
[METHOD] /api/[resource]
Request: { 필드명: 타입, 필드명?: 타입 }
Response: { 필드명: 타입 }
Error: { statusCode: number, message: string }
Auth: 필요 여부
```

표준 에러 응답:
```ts
// server/utils/error.ts
export const apiError = (statusCode: number, message: string) =>
  createError({ statusCode, statusMessage: message })
```

## Phase 6: 명세 문서 작성

`_workspace/00_architecture.md`를 다음 구조로 작성한다:

```markdown
# 아키텍처 명세

## 전제 조건 및 가정
## 디렉토리 구조 (tree)
## 핵심 패턴 및 근거
## 렌더링 전략 (페이지별 표)
## 상태 관리 설계 (스토어 목록 + 역할)
## API 계약 (엔드포인트 목록)
## 에이전트별 작업 범위
  - frontend-dev 담당
  - backend-dev 담당
## 위험 요소 및 주의사항
```

## 아키텍처 검토 체크리스트

명세 완성 후 자체 검토:

- [ ] Nuxt가 이미 제공하는 기능을 재발명하지 않는가?
- [ ] 페이지 컴포넌트가 비즈니스 로직을 직접 포함하지 않는가? (composable로 분리)
- [ ] API 응답에 민감 정보(비밀번호 해시 등)가 포함되지 않는가?
- [ ] 스토어가 도메인별로 분리되어 있는가?
- [ ] 렌더링 전략이 SEO 요건과 일치하는가?

## 참고 문서

상세 패턴 예시는 `references/patterns.md` 참조.
