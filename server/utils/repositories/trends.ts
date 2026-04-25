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

  const rows = await prisma.$queryRaw<
    Array<{ topic: string; date: string; count: number }>
  >`
    SELECT
      s.topic_slug                                              AS topic,
      TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COUNT(*)::int                                             AS count
    FROM   "Article" a
    JOIN   "Source"  s ON a.source_id = s.id
    WHERE  s.country_code = ${countryCode}
      AND  a.published_at >= ${since}
    GROUP  BY s.topic_slug,
              TO_CHAR(a.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    ORDER  BY date ASC, s.topic_slug ASC
  `

  return rows
}
