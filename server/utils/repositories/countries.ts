// server/utils/repositories/countries.ts
//
// Country list with per-country source counts. Returns values already
// shaped as CountryDTO so route handlers stay trivial.

import type { CountryDTO } from '~/types/dto'
import { prisma } from '../prisma'

/**
 * Every country row with its enabled-source count. `hasSources` is the
 * convenience boolean frontends use to grey out non-clickable paths.
 */
export async function listCountriesWithHasSources(): Promise<CountryDTO[]> {
  const countries = await prisma.country.findMany({
    orderBy: { nameEn: 'asc' },
    include: {
      _count: {
        select: {
          sources: { where: { enabled: true } }
        }
      }
    }
  })

  return countries.map((c) => {
    const sourceCount = c._count.sources
    return {
      code: c.code,
      nameEn: c.nameEn,
      nameKo: c.nameKo ?? null,
      hasSources: sourceCount > 0,
      sourceCount
    }
  })
}

/**
 * Single country lookup by ISO alpha-2 code. Returns null when the
 * country is not registered. Narrow select — preview handler only
 * needs code + nameEn.
 */
export async function findCountryByCode(
  code: string
): Promise<{ code: string, nameEn: string } | null> {
  const row = await prisma.country.findUnique({
    where: { code },
    select: { code: true, nameEn: true }
  })
  return row
}

export async function countryExists(code: string): Promise<boolean> {
  const row = await prisma.country.findUnique({
    where: { code },
    select: { code: true }
  })
  return row !== null
}
