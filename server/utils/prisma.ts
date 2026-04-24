// server/utils/prisma.ts
//
// Singleton PrismaClient. Dev hot-reload caches the instance on globalThis to
// avoid exhausting Postgres connections on every HMR. See architecture § 12.2 (E).

import { PrismaClient } from '@prisma/client'

declare global {
   
  var __earthletter_prisma__: PrismaClient | undefined
}

export const prisma: PrismaClient =
  globalThis.__earthletter_prisma__ ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error']
  })

if (process.env.NODE_ENV !== 'production') {
  globalThis.__earthletter_prisma__ = prisma
}
