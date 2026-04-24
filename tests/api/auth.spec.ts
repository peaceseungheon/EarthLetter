// Smoke-tests the timing-safe compare used by requireIngestSecret. The real
// handler pulls runtimeConfig from the Nitro event; we reproduce the compare
// here to lock the invariant (length-safe, constant-time on equal lengths).

import { describe, it, expect } from 'vitest'
import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'

function safeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

describe('safeEqual (bearer token compare)', () => {
  it('returns true for identical strings', () => {
    expect(safeEqual('hunter2-super-secret', 'hunter2-super-secret')).toBe(true)
  })

  it('returns false for different strings of the same length', () => {
    expect(safeEqual('secretAAAA', 'secretBBBB')).toBe(false)
  })

  it('returns false — not throws — for different lengths', () => {
    // Without the length guard, timingSafeEqual would throw
    // RangeError: Input buffers must have the same byte length.
    expect(() => safeEqual('short', 'much-longer-string')).not.toThrow()
    expect(safeEqual('short', 'much-longer-string')).toBe(false)
  })

  it('rejects empty token', () => {
    expect(safeEqual('', 'anything')).toBe(false)
  })

  it('handles unicode byte-length (same string = true)', () => {
    expect(safeEqual('비밀키', '비밀키')).toBe(true)
  })
})
