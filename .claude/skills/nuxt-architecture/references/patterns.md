# 디자인 패턴 상세 참고

## Repository Pattern (서버 레이어)

API 핸들러가 DB 쿼리를 직접 포함하면 테스트 어렵고 재사용 불가. Repository로 분리한다.

```ts
// server/utils/repositories/userRepository.ts
import { prisma } from '~/server/utils/prisma'

export const userRepository = {
  async findById(id: string) {
    return prisma.user.findUnique({ where: { id } })
  },
  async findByEmail(email: string) {
    return prisma.user.findUnique({ where: { email } })
  },
  async create(data: Prisma.UserCreateInput) {
    return prisma.user.create({ data })
  }
}

// server/api/users/[id].get.ts
import { userRepository } from '~/server/utils/repositories/userRepository'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const user = await userRepository.findById(id!)
  if (!user) throw createError({ statusCode: 404, message: 'User not found' })
  return toUserDTO(user) // DTO 변환
})
```

## DTO 변환 패턴

```ts
// types/user.ts
export interface UserDTO {
  id: string
  name: string
  email: string
  createdAt: string
}

// server/utils/dto/userDTO.ts
import type { User } from '@prisma/client'
import type { UserDTO } from '~/types/user'

export function toUserDTO(user: User): UserDTO {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt.toISOString()
  }
}
```

## Composable Pattern (클라이언트)

```ts
// composables/useUser.ts
export function useUser(userId: string) {
  const { data: user, pending, error, refresh } = useFetch<UserDTO>(
    `/api/users/${userId}`,
    { lazy: false }
  )

  const fullName = computed(() => user.value?.name ?? '')

  async function updateProfile(updates: Partial<UserDTO>) {
    await $fetch(`/api/users/${userId}`, { method: 'PATCH', body: updates })
    await refresh()
  }

  return { user, pending, error, fullName, updateProfile }
}
```

## Container/Presenter 패턴

```vue
<!-- pages/users/[id].vue (Container) -->
<script setup lang="ts">
const route = useRoute()
const { user, pending, updateProfile } = useUser(route.params.id as string)
</script>

<template>
  <UserProfile
    v-if="user"
    :user="user"
    :loading="pending"
    @update="updateProfile"
  />
  <LoadingSpinner v-else-if="pending" />
</template>

<!-- components/UserProfile.vue (Presenter - UI만 담당) -->
<script setup lang="ts">
defineProps<{ user: UserDTO; loading: boolean }>()
defineEmits<{ update: [updates: Partial<UserDTO>] }>()
</script>
```

## Pinia Optimistic Update 패턴

```ts
// stores/useCartStore.ts
export const useCartStore = defineStore('cart', () => {
  const items = ref<CartItem[]>([])

  async function addItem(product: Product) {
    // 1. 낙관적 업데이트 (즉각 UI 반영)
    items.value.push({ ...product, quantity: 1 })

    try {
      // 2. 서버 동기화
      await $fetch('/api/cart', { method: 'POST', body: { productId: product.id } })
    } catch {
      // 3. 실패 시 롤백
      items.value = items.value.filter(i => i.id !== product.id)
      useToast().error('장바구니 추가 실패')
    }
  }

  return { items, addItem }
})
```

## 서버 미들웨어 인증 패턴

```ts
// server/middleware/auth.ts
export default defineEventHandler((event) => {
  const publicPaths = ['/api/auth/', '/api/health']
  if (publicPaths.some(p => event.path.startsWith(p))) return

  const token = getCookie(event, 'auth-token')
  if (!token) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // JWT 검증
  try {
    const payload = verifyJWT(token)
    event.context.user = payload
  } catch {
    throw createError({ statusCode: 401, message: 'Invalid token' })
  }
})
```

## useAsyncData vs useFetch 선택 기준

```
useFetch: URL이 정적이거나 단순 ref인 경우 (대부분의 상황)
useAsyncData + $fetch: 복잡한 조건부 호출, 동일 키로 여러 소스 통합할 때

// 언제 lazy 옵션을 쓰는가
lazy: true   → 페이지 전환을 블로킹하지 않음, 로딩 스피너 표시
lazy: false  → 데이터 없이 페이지 렌더 불가 (SEO 크리티컬 페이지)
```
