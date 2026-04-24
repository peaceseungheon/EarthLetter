// server/utils/repositories/sources.ts
//
// Source enumeration used by the ingestion pipeline.

import { prisma } from '../prisma'

export interface EnabledSource {
  id: number
  countryCode: string
  topicSlug: string
  name: string
  feedUrl: string
}

export async function listEnabledSources(): Promise<EnabledSource[]> {
  return prisma.source.findMany({
    where: { enabled: true },
    select: {
      id: true,
      countryCode: true,
      topicSlug: true,
      name: true,
      feedUrl: true,
    },
    orderBy: { id: 'asc' },
  })
}
