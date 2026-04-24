---
name: nuxt-frontend
description: Nuxt 3 + Vue 3 프론트엔드 구현 스킬. Vue 컴포넌트 작성, 페이지 구성, composable 추출, Pinia 스토어 구현, useFetch/useAsyncData 데이터 패칭, 레이아웃 설계, 폼 처리, 스타일링을 수행. "컴포넌트 만들어", "페이지 구현", "프론트 작업", "화면 구현", "Vue", "UI 만들기" 요청 시 반드시 사용할 것.
---

# Nuxt Frontend Skill

## 전제 조건

작업 전 `_workspace/00_architecture.md`를 읽는다. 없으면 nuxt-architecture 스킬을 먼저 실행한다.

## 컴포넌트 작성 표준

### 기본 구조

```vue
<script setup lang="ts">
// 1. 타입 임포트
import type { UserDTO } from '~/types/user'

// 2. Props / Emits
const props = defineProps<{
  user: UserDTO
  loading?: boolean
}>()

const emit = defineEmits<{
  update: [data: Partial<UserDTO>]
  close: []
}>()

// 3. Composable
const { submit, isSubmitting } = useForm()

// 4. 반응형 상태
const isOpen = ref(false)

// 5. Computed
const displayName = computed(() => props.user.name || 'Anonymous')
</script>

<template>
  <!-- 시맨틱 HTML + ARIA -->
</template>
```

### 컴포넌트 분류

```
components/ui/          # 도메인 무관 재사용 컴포넌트
  Button.vue            # variant, size, loading props
  Input.vue             # v-model, error, label
  Modal.vue             # v-model:open, teleport to body

components/[feature]/   # 특정 기능 컴포넌트
  UserCard.vue
  UserForm.vue
```

## 페이지 구현 패턴

```vue
<!-- pages/users/index.vue -->
<script setup lang="ts">
// SEO
useHead({ title: '사용자 목록' })

// definePageMeta - SSR/SSG/auth guard
definePageMeta({
  middleware: 'auth',  // middleware/auth.ts
})

// 데이터 패칭
const { data: users, pending, error } = useFetch<UserDTO[]>('/api/users')
</script>

<template>
  <div>
    <LoadingSpinner v-if="pending" />
    <ErrorMessage v-else-if="error" :error="error" />
    <UserList v-else :users="users ?? []" />
  </div>
</template>
```

## Composable 작성 패턴

composables/로 분리해야 하는 기준:
- 2개 이상의 컴포넌트/페이지에서 동일 로직 사용
- 비즈니스 로직이 컴포넌트와 섞임
- 상태 + 액션 조합

```ts
// composables/usePagination.ts
export function usePagination(totalRef: Ref<number>, pageSize = 10) {
  const page = ref(1)
  const totalPages = computed(() => Math.ceil(totalRef.value / pageSize))

  function next() { if (page.value < totalPages.value) page.value++ }
  function prev() { if (page.value > 1) page.value-- }

  return { page: readonly(page), totalPages, next, prev }
}
```

## 폼 처리

```vue
<script setup lang="ts">
const form = reactive({ email: '', password: '' })
const errors = reactive({ email: '', password: '' })
const isSubmitting = ref(false)

function validate() {
  errors.email = !form.email.includes('@') ? '이메일 형식이 아닙니다' : ''
  errors.password = form.password.length < 8 ? '8자 이상 필요합니다' : ''
  return !errors.email && !errors.password
}

async function handleSubmit() {
  if (!validate()) return
  isSubmitting.value = true
  try {
    await $fetch('/api/auth/login', { method: 'POST', body: form })
    navigateTo('/dashboard')
  } catch (e: any) {
    errors.email = e.data?.message ?? '로그인 실패'
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

## useFetch 패턴 빠른 참조

```ts
// 기본
const { data, pending, error, refresh } = useFetch('/api/items')

// 쿼리 파라미터 (반응형)
const page = ref(1)
const { data } = useFetch('/api/items', {
  query: { page },  // page가 바뀌면 자동 재요청
})

// 조건부 실행
const userId = computed(() => isLoggedIn.value ? user.value?.id : null)
const { data } = useFetch(() => `/api/users/${userId.value}`, {
  watch: [userId],
})

// POST 전송
const { execute } = useFetch('/api/items', {
  method: 'POST',
  body: formData,
  immediate: false,  // 수동 실행
})
```

## 스타일링 가이드

- 전역 스타일은 `assets/css/main.css`
- 컴포넌트 스타일은 `<style scoped>`
- 디자인 토큰(색상, 간격)은 CSS 변수로 정의
- Tailwind 사용 시 `nuxt.config.ts`에 `@nuxtjs/tailwindcss` 설정

```css
/* assets/css/main.css */
:root {
  --color-primary: #3b82f6;
  --color-danger: #ef4444;
  --spacing-base: 8px;
}
```

## 접근성 체크리스트

모든 인터랙티브 요소에 대해:
- [ ] 버튼은 `<button>`, 링크는 `<a>` (div 클릭 이벤트 금지)
- [ ] 이미지에 `alt` 속성
- [ ] 폼 필드에 연결된 `<label>`
- [ ] 모달 열릴 때 포커스 이동, 닫힐 때 트리거 버튼으로 복귀
- [ ] 에러 메시지는 `role="alert"`

## 자주 사용하는 Nuxt 유틸

```ts
// 라우팅
const router = useRouter()
const route = useRoute()
navigateTo('/path')

// 알림/피드백 (별도 composable 없을 시)
const toast = useToast() // Nuxt UI 사용 시

// 환경 설정
const config = useRuntimeConfig()
const apiBase = config.public.apiBase

// 쿠키
const token = useCookie('auth-token', { secure: true, httpOnly: true })
```

## 참고 문서

컴포넌트 패턴 심화: `references/component-patterns.md`
