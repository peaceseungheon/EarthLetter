// server/api/countries.get.ts
// Returns every registered country with `hasSources` / `sourceCount`.

import type { CountriesResponseDTO } from '~/types/dto'
import { listCountriesWithHasSources } from '../utils/repositories/countries'

export default defineEventHandler(async (event): Promise<CountriesResponseDTO> => {
  setResponseHeader(event, 'Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  const items = await listCountriesWithHasSources()
  return { items }
})
