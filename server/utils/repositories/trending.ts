import type { TrendingItemDTO } from '~/types/dto'
import { prisma } from '../prisma'

export async function findTrending(): Promise<TrendingItemDTO[]> {
  const rows = await prisma.$queryRaw<TrendingItemDTO[]>`
    WITH today AS (
      SELECT s.country_code,
             s.topic_slug,
             COUNT(*)::int AS today_count
      FROM   "Article" a
      JOIN   "Source"  s ON a.source_id = s.id
      WHERE  a.published_at >= NOW() - INTERVAL '24 hours'
      GROUP  BY s.country_code, s.topic_slug
    ),
    baseline AS (
      SELECT s.country_code,
             s.topic_slug,
             COUNT(*)::int AS total_7d
      FROM   "Article" a
      JOIN   "Source"  s ON a.source_id = s.id
      WHERE  a.published_at >= NOW() - INTERVAL '8 days'
        AND  a.published_at <  NOW() - INTERVAL '24 hours'
      GROUP  BY s.country_code, s.topic_slug
    )
    SELECT
      t.country_code                                                          AS "countryCode",
      c.name_en                                                               AS "countryName",
      t.topic_slug                                                            AS "topicSlug",
      t.today_count                                                           AS "todayCount",
      ROUND((b.total_7d / 7.0)::numeric, 2)::float                           AS "avg7dCount",
      ROUND(((t.today_count::float / (b.total_7d / 7.0) - 1) * 100)::numeric, 1)::float
                                                                              AS "spikeRatio"
    FROM   today t
    JOIN   baseline b
           ON  t.country_code = b.country_code
           AND t.topic_slug   = b.topic_slug
    JOIN   "Country" c ON c.code = t.country_code
    WHERE  b.total_7d >= 5
    ORDER  BY "spikeRatio" DESC
    LIMIT  15
  `
  return rows
}
