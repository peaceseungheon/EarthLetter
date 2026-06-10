import type { TrendingItemDTO } from '~/types/dto'
import { prisma } from '../prisma'

// Identifier convention: the migration created quoted camelCase columns
// ("publishedAt", "countryCode", …) — unquoted snake_case identifiers would
// fold to lowercase and fail with `column does not exist`. Same convention
// as upsertArticle (repositories/articles.ts).
export async function findTrending(): Promise<TrendingItemDTO[]> {
  const rows = await prisma.$queryRaw<TrendingItemDTO[]>`
    WITH today AS (
      SELECT s."countryCode",
             s."topicSlug",
             COUNT(*)::int AS today_count
      FROM   "Article" a
      JOIN   "Source"  s ON a."sourceId" = s."id"
      WHERE  a."publishedAt" >= NOW() - INTERVAL '24 hours'
        AND  s."enabled"
      GROUP  BY s."countryCode", s."topicSlug"
    ),
    baseline AS (
      SELECT s."countryCode",
             s."topicSlug",
             COUNT(*)::int AS total_7d
      FROM   "Article" a
      JOIN   "Source"  s ON a."sourceId" = s."id"
      WHERE  a."publishedAt" >= NOW() - INTERVAL '8 days'
        AND  a."publishedAt" <  NOW() - INTERVAL '24 hours'
        AND  s."enabled"
      GROUP  BY s."countryCode", s."topicSlug"
    )
    SELECT
      t."countryCode"                                                         AS "countryCode",
      c."nameEn"                                                              AS "countryName",
      t."topicSlug"                                                           AS "topicSlug",
      t.today_count                                                           AS "todayCount",
      ROUND((b.total_7d / 7.0)::numeric, 2)::float                           AS "avg7dCount",
      ROUND(((t.today_count::float / (b.total_7d / 7.0) - 1) * 100)::numeric, 1)::float
                                                                              AS "spikeRatio"
    FROM   today t
    JOIN   baseline b
           ON  t."countryCode" = b."countryCode"
           AND t."topicSlug"   = b."topicSlug"
    JOIN   "Country" c ON c."code" = t."countryCode"
    WHERE  b.total_7d >= 5
    ORDER  BY "spikeRatio" DESC
    LIMIT  15
  `
  return rows
}
