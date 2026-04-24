import { describe, it, expect } from 'vitest'
import {
  numericToAlpha2,
  NUMERIC_TO_ALPHA2
} from '../../composables/useCountryIdMap'

describe('numericToAlpha2', () => {
  it('maps every launch-set ISO numeric id', () => {
    // Must match prisma/seed.ts Country rows (architecture § 8.2).
    const launch: Array<[string, string]> = [
      ['840', 'US'],
      ['826', 'GB'],
      ['156', 'CN'],
      ['643', 'RU'],
      ['392', 'JP'],
      ['410', 'KR'],
      ['276', 'DE'],
      ['250', 'FR'],
      ['376', 'IL'],
      ['356', 'IN']
    ]
    for (const [num, alpha] of launch) {
      expect(numericToAlpha2(num)).toBe(alpha)
    }
  })

  it('pads numeric ids stripped of leading zeros', () => {
    // world-atlas serializations may strip "012" down to 12 / "12".
    expect(numericToAlpha2(12)).toBe('DZ')
    expect(numericToAlpha2('12')).toBe('DZ')
    expect(numericToAlpha2('012')).toBe('DZ')
  })

  it('returns null for unmapped ids', () => {
    expect(numericToAlpha2('999')).toBeNull()
    expect(numericToAlpha2('')).toBeNull()
  })

  it('table keys are zero-padded 3-digit strings', () => {
    for (const key of Object.keys(NUMERIC_TO_ALPHA2)) {
      expect(key).toMatch(/^\d{3}$/)
    }
  })

  it('no duplicate alpha-2 values in the table (one numeric per country)', () => {
    const seen = new Set<string>()
    for (const alpha of Object.values(NUMERIC_TO_ALPHA2)) {
      expect(seen.has(alpha)).toBe(false)
      seen.add(alpha)
    }
  })
})
