---
name: nuxt-backend
description: Nuxt 3 서버 레이어 구현 스킬. Nitro server routes, API 핸들러, 서버 미들웨어, Prisma/Drizzle 데이터베이스, 인증(JWT/세션), 입력 검증, 에러 응답 표준화를 수행. "API 만들어", "서버 구현", "DB 스키마", "백엔드 작업", "server route", "인증 구현" 요청 시 반드시 사용할 것.
---

# Nuxt Backend Skill

## 전제 조건

작업 전 `_workspace/00_architecture.md`를 읽는다. API 계약을 확인 후 구현한다.

## Server Route 구조

```
server/
├── api/
│   ├── users/
│   │   ├── index.get.ts     # GET /api/users
│   │   ├── index.post.ts    # POST /api/users
│   │   └── [id].get.ts      # GET /api/users/:id
│   └── auth/
│       ├── login.post.ts
│       └── logout.post.ts
├── middleware/
│   └── auth.ts              # 모든 요청에 적용
└── utils/
    ├── prisma.ts             # DB 클라이언트 싱글턴
    ├── jwt.ts                # JWT 유틸
    └── repositories/        # Repository 패턴
```

## API 핸들러 기본 구조

```ts
// server/api/users/index.get.ts
import { z } from 'zod'

const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export default defineEventHandler(async (event) => {
  // 1. 입력 검증 (서버에서 항상)
  const query = await getValidatedQuery(event, QuerySchema.parse)

  // 2. 인증 확인 (미들웨어가 처리하지 않는 경우)
  const user = event.context.user
  if (!user) throw createError({ statusCode: 401, message: 'Unauthorized' })

  // 3. 비즈니스 로직 (Repository 위임)
  const { items, total } = await userRepository.findMany({
    page: query.page,
    limit: query.limit,
  })

  // 4. 응답 반환 (DTO 변환)
  return {
    items: items.map(toUserDTO),
    pagination: { page: query.page, limit: query.limit, total },
  }
})
```

## 에러 응답 표준

모든 에러는 h3의 `createError`를 사용한다:

```ts
// 공통 에러 팩토리
throw createError({ statusCode: 400, message: '잘못된 요청입니다' })
throw createError({ statusCode: 401, message: '인증이 필요합니다' })
throw createError({ statusCode: 403, message: '권한이 없습니다' })
throw createError({ statusCode: 404, message: '리소스를 찾을 수 없습니다' })
throw createError({ statusCode: 409, message: '이미 존재합니다' })
```

클라이언트 수신 형식: `{ statusCode, message, data? }`

## 입력 검증

Zod를 사용한다. `getValidatedBody` / `getValidatedQuery`로 자동 에러 처리:

```ts
import { z } from 'zod'

const BodySchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
})

export default defineEventHandler(async (event) => {
  const body = await readValidatedBody(event, BodySchema.parse)
  // 검증 실패 시 자동으로 400 에러
})
```

## Prisma 설정

```ts
// server/utils/prisma.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ log: process.env.NODE_ENV === 'development' ? ['query'] : [] })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

## 인증 미들웨어

```ts
// server/middleware/auth.ts
const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register', '/api/health']

export default defineEventHandler(async (event) => {
  if (PUBLIC_PATHS.some(p => event.path.startsWith(p))) return

  const token = getCookie(event, 'auth-token')
    ?? getRequestHeader(event, 'authorization')?.replace('Bearer ', '')

  if (!token) throw createError({ statusCode: 401, message: '인증이 필요합니다' })

  try {
    event.context.user = verifyJWT(token)
  } catch {
    deleteCookie(event, 'auth-token')
    throw createError({ statusCode: 401, message: '세션이 만료됐습니다' })
  }
})
```

## 환경 변수 관리

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  runtimeConfig: {
    // 서버 전용 (클라이언트에 노출 안 됨)
    jwtSecret: process.env.JWT_SECRET,
    databaseUrl: process.env.DATABASE_URL,
    // 클라이언트 공개
    public: {
      apiBase: process.env.API_BASE ?? '/api',
      appName: 'EarthLetter',
    }
  }
})
```

`.env` 파일 구조:
```
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
NODE_ENV="development"
```

## 보안 체크리스트

API 구현 후 확인:
- [ ] 모든 입력을 서버에서 검증 (Zod)
- [ ] SQL 쿼리에 raw string 없음 (Prisma/Drizzle ORM만 사용)
- [ ] 응답에 비밀번호 해시 등 민감 정보 미포함 (DTO 변환 확인)
- [ ] 인증 필요 엔드포인트에 미들웨어 적용 확인
- [ ] CORS 설정 확인 (`nuxt.config.ts`의 `routeRules`)
- [ ] Rate limiting 필요 여부 검토

## 참고 문서

DB 패턴 심화, tRPC 통합: `references/server-patterns.md`
