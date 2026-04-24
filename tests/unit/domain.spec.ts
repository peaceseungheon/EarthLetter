import { describe, it, expect } from 'vitest'
import {
  isIsoCountryCode,
  isTopicSlug,
  toIsoCountryCode,
  TOPIC_META,
  TOPIC_SLUGS,
} from '../../types/domain'

describe('isTopicSlug', () => {
  it('accepts the three canonical slugs', () => {
    expect(isTopicSlug('military')).toBe(true)
    expect(isTopicSlug('economy')).toBe(true)
    expect(isTopicSlug('politics')).toBe(true)
  })

  it('rejects unknown slugs', () => {
    expect(isTopicSlug('sports')).toBe(false)
    expect(isTopicSlug('')).toBe(false)
    expect(isTopicSlug('MILITARY')).toBe(false)
  })

  it('TOPIC_SLUGS matches TOPIC_META keys exactly', () => {
    const metaKeys = Object.keys(TOPIC_META).sort()
    const slugs = [...TOPIC_SLUGS].sort()
    expect(metaKeys).toEqual(slugs)
  })
})

describe('isIsoCountryCode', () => {
  it('accepts ISO-3166 alpha-2 codes case-insensitively', () => {
    expect(isIsoCountryCode('US')).toBe(true)
    expect(isIsoCountryCode('kr')).toBe(true)
  })

  it('rejects non-alpha-2 shapes', () => {
    expect(isIsoCountryCode('USA')).toBe(false)
    expect(isIsoCountryCode('1')).toBe(false)
    expect(isIsoCountryCode('U1')).toBe(false)
    expect(isIsoCountryCode('')).toBe(false)
  })
})

describe('toIsoCountryCode', () => {
  it('normalizes to uppercase', () => {
    expect(toIsoCountryCode('kr')).toBe('KR')
    expect(toIsoCountryCode('De')).toBe('DE')
  })

  it('throws on invalid input', () => {
    expect(() => toIsoCountryCode('USA')).toThrow()
    expect(() => toIsoCountryCode('')).toThrow()
  })
})
