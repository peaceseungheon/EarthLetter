// server/utils/repositories/sources.ts
//
// Source enumeration used by the ingestion pipeline + admin CRUD + failure
// bookkeeping (Feature F auto-disable). Route handlers never touch `prisma`
// directly — they call these functions so tests can stub at this seam.

import { Prisma } from '@prisma/client'
import { createError } from 'h3'
import type {
  AdminSourceCreateDTO,
  AdminSourceDTO,
  AdminSourcePatchDTO,
  AdminSourcesQueryDTO,
  AdminSourcesResponseDTO,
  IsoCountryCode,
  TopicSlug
} from '~/types/dto'
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
      feedUrl: true
    },
    orderBy: { id: 'asc' }
  })
}

// ---------------------------------------------------------------------------
// Feature F — ingestion failure bookkeeping
// ---------------------------------------------------------------------------

/**
 * Reset the consecutive-failure counter for a source after a successful fetch.
 *
 * Uses `updateMany` with a `failCount > 0` guard so the common already-zero
 * case is a no-op write (avoids row-level churn on healthy feeds).
 */
export async function recordSourceSuccess(id: number): Promise<void> {
  await prisma.source.updateMany({
    where: { id, failCount: { gt: 0 } },
    data: { failCount: 0 }
  })
}

/**
 * Atomically increment `failCount` and stamp `lastFailedAt`. If the new count
 * crosses the threshold, flip `enabled=false` + set `disabledAt=now()` in a
 * second write and report `{ autoDisabled: true }` to the caller.
 *
 * Prisma's `{ increment: 1 }` is translated into a single atomic SQL
 * statement, which defuses the race described in architecture § 10 (F-1).
 */
export async function recordSourceFailure(
  id: number,
  threshold: number
): Promise<{ autoDisabled: boolean }> {
  const now = new Date()

  const updated = await prisma.source.update({
    where: { id },
    data: {
      failCount: { increment: 1 },
      lastFailedAt: now
    },
    select: { id: true, failCount: true, enabled: true, disabledAt: true }
  })

  if (updated.failCount >= threshold && updated.enabled) {
    await prisma.source.update({
      where: { id },
      data: {
        enabled: false,
        disabledAt: now
      }
    })
    return { autoDisabled: true }
  }

  return { autoDisabled: false }
}

// ---------------------------------------------------------------------------
// Feature E — admin CRUD
// ---------------------------------------------------------------------------

type SourceWithCount = Prisma.SourceGetPayload<{
  include: { _count: { select: { articles: true } } }
}>

function toAdminSourceDTO(row: SourceWithCount): AdminSourceDTO {
  return {
    id: row.id,
    countryCode: row.countryCode as IsoCountryCode,
    topicSlug: row.topicSlug as TopicSlug,
    name: row.name,
    feedUrl: row.feedUrl,
    enabled: row.enabled,
    failCount: row.failCount,
    lastFailedAt: row.lastFailedAt ? row.lastFailedAt.toISOString() : null,
    disabledAt: row.disabledAt ? row.disabledAt.toISOString() : null,
    articleCount: row._count.articles,
    createdAt: row.createdAt.toISOString()
  }
}

function buildAdminWhere(
  filters: AdminSourcesQueryDTO
): Prisma.SourceWhereInput {
  const where: Prisma.SourceWhereInput = {}

  if (filters.country) {
    where.countryCode = filters.country
  }
  if (filters.topic) {
    where.topicSlug = filters.topic
  }

  // enabled filter: 'true' | 'false' | 'all' (default all → no constraint)
  if (filters.enabled === 'true') {
    where.enabled = true
  } else if (filters.enabled === 'false') {
    where.enabled = false
  }

  // disabled filter:
  //   'auto'   → disabledAt IS NOT NULL (auto-disabled by ingest)
  //   'manual' → enabled=false AND disabledAt IS NULL (manually toggled off)
  //   'any' / undefined → no additional constraint
  if (filters.disabled === 'auto') {
    where.disabledAt = { not: null }
  } else if (filters.disabled === 'manual') {
    where.enabled = false
    where.disabledAt = null
  }

  return where
}

export async function listAdminSources(
  filters: AdminSourcesQueryDTO
): Promise<AdminSourcesResponseDTO> {
  const where = buildAdminWhere(filters)

  const [rows, total] = await Promise.all([
    prisma.source.findMany({
      where,
      include: { _count: { select: { articles: true } } },
      orderBy: [{ countryCode: 'asc' }, { topicSlug: 'asc' }, { id: 'asc' }]
    }),
    prisma.source.count({ where })
  ])

  return {
    items: rows.map(toAdminSourceDTO),
    total
  }
}

export async function findAdminSource(
  id: number
): Promise<AdminSourceDTO | null> {
  const row = await prisma.source.findUnique({
    where: { id },
    include: { _count: { select: { articles: true } } }
  })
  return row ? toAdminSourceDTO(row) : null
}

/**
 * Create a new Source row. Feed URLs are globally unique; Prisma surfaces
 * `P2002` on collision which we translate to a 409 CONFLICT so the admin UI
 * can render a friendly duplicate-URL message.
 */
export async function createSource(
  input: AdminSourceCreateDTO
): Promise<AdminSourceDTO> {
  try {
    const row = await prisma.source.create({
      data: {
        countryCode: input.countryCode,
        topicSlug: input.topicSlug,
        name: input.name,
        feedUrl: input.feedUrl,
        enabled: true
      },
      include: { _count: { select: { articles: true } } }
    })
    return toAdminSourceDTO(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      throw createError({
        statusCode: 409,
        statusMessage: 'CONFLICT',
        data: {
          statusCode: 409,
          statusMessage: 'CONFLICT',
          message: 'A source with this feedUrl already exists.'
        }
      })
    }
    throw err
  }
}

/**
 * Apply a partial patch. If the caller flips `enabled=true`, we also reset
 * `failCount=0` and clear `disabledAt` so a re-enabled source starts fresh
 * in the next ingestion run (architecture § 2.3).
 */
export async function updateSource(
  id: number,
  patch: AdminSourcePatchDTO
): Promise<AdminSourceDTO> {
  const data: Prisma.SourceUpdateInput = {}

  if (patch.name !== undefined) {
    data.name = patch.name
  }
  if (patch.enabled !== undefined) {
    data.enabled = patch.enabled
    if (patch.enabled === true) {
      data.failCount = 0
      data.disabledAt = null
    }
  }

  try {
    const row = await prisma.source.update({
      where: { id },
      data,
      include: { _count: { select: { articles: true } } }
    })
    return toAdminSourceDTO(row)
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: 'NOT_FOUND',
        data: {
          statusCode: 404,
          statusMessage: 'NOT_FOUND',
          message: `Source ${id} not found.`
        }
      })
    }
    throw err
  }
}

/**
 * Hard-delete a source plus all its Article rows (cascade via schema FK).
 * Article count is measured inside the transaction so the response can warn
 * about destroyed archive rows.
 */
export async function deleteSource(
  id: number
): Promise<{ deletedArticles: number }> {
  try {
    const result = await prisma.$transaction(async (tx) => {
      const deletedArticles = await tx.article.count({
        where: { sourceId: id }
      })
      await tx.source.delete({ where: { id } })
      return { deletedArticles }
    })
    return result
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2025'
    ) {
      throw createError({
        statusCode: 404,
        statusMessage: 'NOT_FOUND',
        data: {
          statusCode: 404,
          statusMessage: 'NOT_FOUND',
          message: `Source ${id} not found.`
        }
      })
    }
    throw err
  }
}
