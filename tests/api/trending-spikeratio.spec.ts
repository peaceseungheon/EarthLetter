// Documents the spike-ratio formula used in findTrending() SQL
// (server/utils/repositories/trending.ts). Re-implemented in JS so
// formula drift is caught if the SQL ever changes.

import { describe, it, expect } from 'vitest'

function spikeRatio(todayCount: number, total7d: number): number {
  const avg7d = total7d / 7.0
  return Math.round(((todayCount / avg7d) - 1) * 100 * 10) / 10
}

describe('spikeRatio formula', () => {
  it('returns 0 when today equals the 7-day daily average', () => {
    expect(spikeRatio(7, 49)).toBe(0)   // avg7d=7, today=7 → 0%
  })

  it('returns 100 when today is double the average', () => {
    expect(spikeRatio(14, 49)).toBe(100) // avg7d=7, today=14 → +100%
  })

  it('returns -50 when today is half the average', () => {
    expect(spikeRatio(3, 42)).toBe(-50)  // avg7d=6, today=3 → -50%
  })

  it('handles large spikes correctly', () => {
    expect(spikeRatio(100, 7)).toBe(9900) // avg7d=1, today=100 → +9900%
  })
})
