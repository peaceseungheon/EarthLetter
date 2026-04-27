import { defineEventHandler, setResponseHeader } from 'h3'
import type { TrendingResponseDTO } from '~/types/dto'
import { findTrending } from '../utils/repositories/trending'

export default defineEventHandler(async (event): Promise<TrendingResponseDTO> => {
  setResponseHeader(
    event,
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=3600'
  )
  return findTrending()
})
