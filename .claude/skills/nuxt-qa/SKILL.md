---
name: nuxt-qa
description: Nuxt 3 풀스택 앱의 품질 검증 스킬. API shape vs 프론트 useFetch 교차 비교, Vitest 단위/통합 테스트, Playwright E2E, 경계면 버그(nullable 불일치, camelCase/snake_case, 날짜 포맷) 탐지, 보안 취약점 검토를 수행. "테스트 작성", "QA", "버그 검증", "품질 확인", "테스트 코드" 요청 시 반드시 사용할 것.
---

# Nuxt QA Skill

## 핵심 원칙: 경계면 교차 비교

QA의 핵심은 API 응답 shape와 프론트 소비 코드를 **동시에 읽고 비교**하는 것이다.

```
검증 순서:
1. _workspace/00_architecture.md → API 계약 원본
2. server/api/*.ts → 실제 응답 shape (DTO 변환 후)
3. composables/ 또는 pages/ → useFetch 타입 어노테이션
4. 세 곳이 일치하는지 확인
```

## 경계면 버그 패턴 목록

이 패턴들을 코드에서 적극 탐지한다:

| 패턴 | 예시 | 확인 방법 |
|------|------|---------|
| **Nullable 불일치** | API: `name: string \| null` vs 프론트: `name: string` | 타입 정의 교차 확인 |
| **배열/단수 불일치** | API: `{ user: User }` vs 프론트: `data.users` | 응답 키 이름 확인 |
| **camelCase/snake_case** | API: `created_at` vs 프론트: `createdAt` | Prisma 설정 + 응답 확인 |
| **날짜 포맷** | API: ISO string vs 프론트: Date 객체 기대 | 직렬화 확인 |
| **중첩 객체 누락** | API: `{ user: { profile: ... } }` vs 프론트: `data.profile` 직접 접근 | 응답 구조 확인 |
| **페이지네이션 키** | API: `{ data, total }` vs 프론트: `{ items, count }` | 페이지네이션 응답 확인 |

## Vitest 설정 및 테스트 패턴

```ts
// vitest.config.ts
import { defineVitestConfig } from '@nuxt/test-utils/config'

export default defineVitestConfig({
  test: {
    environment: 'nuxt',
    globals: true,
  }
})
```

### Composable 테스트

```ts
// tests/unit/composables/usePagination.test.ts
import { usePagination } from '~/composables/usePagination'

describe('usePagination', () => {
  it('초기 페이지는 1', () => {
    const total = ref(100)
    const { page } = usePagination(total)
    expect(page.value).toBe(1)
  })

  it('next()는 마지막 페이지를 초과하지 않는다', () => {
    const total = ref(20) // pageSize 기본값 10 → totalPages=2
    const { page, next } = usePagination(total)
    next(); next(); next() // 3번 호출
    expect(page.value).toBe(2) // 최대 2
  })
})
```

### API 통합 테스트

```ts
// tests/integration/api/users.test.ts
import { $fetch } from '@nuxt/test-utils'

describe('GET /api/users', () => {
  it('인증 없이 401 반환', async () => {
    const error = await $fetch('/api/users', { ignoreResponseError: true })
      .catch(e => e)
    expect(error.statusCode).toBe(401)
  })

  it('응답 shape 검증', async () => {
    const data = await $fetch('/api/users', {
      headers: { Authorization: `Bearer ${getTestToken()}` }
    })
    expect(data).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: expect.any(String), name: expect.any(String) })
      ]),
      pagination: expect.objectContaining({ page: 1, total: expect.any(Number) })
    })
  })
})
```

## Playwright E2E 설정

```ts
// playwright.config.ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  }
})
```

### E2E 테스트 패턴

```ts
// tests/e2e/auth.spec.ts
import { test, expect } from '@playwright/test'

test('로그인 성공 후 대시보드 이동', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'password123')
  await page.click('[type="submit"]')
  await expect(page).toHaveURL('/dashboard')
})

test('잘못된 비밀번호 시 에러 메시지 표시', async ({ page }) => {
  await page.goto('/login')
  await page.fill('[name="email"]', 'test@example.com')
  await page.fill('[name="password"]', 'wrong')
  await page.click('[type="submit"]')
  await expect(page.getByRole('alert')).toContainText('로그인 실패')
})
```

## QA 리포트 형식

`_workspace/03_qa_report.md`에 작성:

```markdown
# QA 리포트

## 검증 요약
| 항목 | 상태 | 비고 |
|------|------|------|
| API shape 교차 비교 | ✅ 통과 | - |
| 인증 미들웨어 | ✅ 통과 | - |
| 폼 검증 | ⚠️ 부분 통과 | email 검증 누락 |

## 발견된 버그

### [Critical] GET /api/users 응답 snake_case vs 프론트 camelCase 불일치
- 위치: server/api/users/index.get.ts L23 vs composables/useUsers.ts L8
- 증상: `created_at` 반환 → 프론트에서 `user.createdAt` 접근 → undefined
- 수정 방법: DTO 변환 시 camelCase로 통일

## 작성된 테스트 파일
- tests/unit/composables/*.test.ts
- tests/integration/api/*.test.ts

## 미검증 항목
- E2E 테스트 (개발 서버 없음)
```

## 보안 검토 체크리스트

- [ ] XSS: `v-html` 사용 여부 + 입력 새니타이즈
- [ ] CSRF: POST/PATCH/DELETE에 CSRF 토큰 또는 SameSite 쿠키
- [ ] 민감 정보 노출: 응답에 비밀번호, 토큰 미포함
- [ ] 권한 검증: 다른 사용자의 리소스 접근 차단 여부
- [ ] 환경 변수: `.env` 미커밋, `runtimeConfig.public`에 시크릿 없음
