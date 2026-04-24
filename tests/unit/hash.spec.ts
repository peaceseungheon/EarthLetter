import { describe, it, expect } from 'vitest'
import { sha256 } from '../../server/utils/hash'

describe('sha256', () => {
  it('produces a lowercase 64-char hex digest', () => {
    const out = sha256('hello')
    expect(out).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic for the same input', () => {
    const a = sha256('https://example.com/article/1')
    const b = sha256('https://example.com/article/1')
    expect(a).toBe(b)
  })

  it('differs for different inputs', () => {
    const a = sha256('https://example.com/a')
    const b = sha256('https://example.com/b')
    expect(a).not.toBe(b)
  })

  it('handles unicode input byte-correctly', () => {
    const out = sha256('한글 테스트')
    expect(out).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is idempotent for a realistic article link (dedup invariant)', () => {
    const link = 'https://www.bbc.co.uk/news/world-europe-12345'
    expect(sha256(link)).toBe(sha256(link))
  })
})
