// server/api/countries/[code]/preview.get.ts
// GET /api/countries/:code/preview?limit=3
// Lightweight latest-N headlines for the globe hover popover (Iteration 8).
// All topics merged, enabled sources only, payload target < 1KB at limit=3.

import { createError, defineEventHandler, getQuery, getRouterParam, setResponseHeader } from 'h3'
import type { CountryPreviewResponseDTO } from '~/types/dto'
import { findRecentByCountry } from '../../../utils/repositories/articles'
import { findCountryByCode } from '../../../utils/repositories/countries'

const ISO_ALPHA2 = /^[A-Z]{2}$/
const DEFAULT_LIMIT = 3
const MAX_LIMIT = 5

function bad(message: string) {
  return createError({
    statusCode: 400,
    statusMessage: 'BAD_REQUEST',
    data: { statusCode: 400, statusMessage: 'BAD_REQUEST', message }
  })
}

function parseLimit(raw: unknown): number {
  if (raw === undefined || raw === null || raw === '') return DEFAULT_LIMIT
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1 || n > MAX_LIMIT) return Number.NaN
  return n
}

export default defineEventHandler(async (event): Promise<CountryPreviewResponseDTO> => {
  const rawCode = String(getRouterParam(event, 'code') ?? '').toUpperCase()
  if (!ISO_ALPHA2.test(rawCode)) {
    throw bad('Route param "code" must be ISO-3166 alpha-2.')
  }

  const limit = parseLimit(getQuery(event).limit)
  if (Number.isNaN(limit)) {
    throw bad(`Query param "limit" must be an integer between 1 and ${MAX_LIMIT}.`)
  }

  // Existence check (404 contract) and the preview query are independent —
  // run them in parallel to save one sequential DB round trip (arch § 2-D3).
  const [country, items] = await Promise.all([
    findCountryByCode(rawCode),
    findRecentByCountry(rawCode, limit)
  ])

  if (!country) {
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


  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=900')

  return {
    countryCode: country.code,
    countryName: country.nameEn,
    items
  }
})
