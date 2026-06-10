// server/utils/repositories/trends.ts
// Article count per (topic, date) for one country over a rolling window.
// Uses $queryRaw because Prisma's groupBy does not support date-truncation functions.

import type { TrendDataPointDTO } from '~/types/dto'
import { prisma } from '../prisma'

export async function findTrends(
  countryCode: string,
  days: number
): Promise<TrendDataPointDTO[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  // Quoted camelCase identifiers — matches the migration's actual column
  // names (unquoted snake_case would fold to lowercase and fail).
  const rows = await prisma.$queryRaw<
    Array<{ topic: string; date: string; count: number }>
  >`
    SELECT
      s."topicSlug"                                              AS topic,
      TO_CHAR(a."publishedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int                                              AS count
    FROM   "Article" a
    JOIN   "Source"  s ON a."sourceId" = s."id"
    WHERE  s."countryCode" = ${countryCode}
      AND  a."publishedAt" >= ${since}
    GROUP  BY s."topicSlug",
              TO_CHAR(a."publishedAt" AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ORDER  BY date ASC, s."topicSlug" ASC
  `

  return rows
}
