// server/api/countries/[code]/trends.get.ts
// GET /api/countries/:code/trends?days=30
// Returns per-topic article counts by day for the given country.

import { createError, defineEventHandler, getQuery, getRouterParam, setResponseHeader } from 'h3'
import type { TrendsResponseDTO } from '~/types/dto'
import { findTrends } from '../../../utils/repositories/trends'
import { countryExists } from '../../../utils/repositories/countries'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const VALID_DAYS = new Set([7, 30, 90])

function bad(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: 'BAD_REQUEST',
    data: { statusCode: 400, statusMessage: 'BAD_REQUEST', message }
  })
}

export default defineEventHandler(async (event): Promise<TrendsResponseDTO> => {
  const rawCode = String(getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(rawCode)) {
    throw bad('Route param "code" must be ISO-3166 alpha-2.')
  }

  const rawDays = getQuery(event).days
  const days = rawDays === undefined ? 30 : Number(rawDays)
  if (!VALID_DAYS.has(days)) {
    throw bad('Query param "days" must be 7, 30, or 90.')
  }

  if (!(await countryExists(rawCode))) {
    throw createError({
      statusCode: 404,
      statusMessage: 'NOT_FOUND',
      data: {
        statusCode: 404,
        statusMessage: 'NOT_FOUND',
        message: `Country "${rawCode}" is not registered.`
      }
    })
  }

  const items = await findTrends(rawCode, days)

  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=7200')

  return { items }
})
