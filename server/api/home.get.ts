// server/api/home.get.ts
// Latest 12 articles across all enabled sources (home featured strip).

import type { HomeResponseDTO } from '~/types/dto'
import { findLatestAcrossSources } from '../utils/repositories/articles'

const FEATURED_COUNT = 12

export default defineEventHandler(async (event): Promise<HomeResponseDTO> => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  const featured = await findLatestAcrossSources(FEATURED_COUNT)
  return { featured }
})
