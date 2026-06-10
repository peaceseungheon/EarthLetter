// QA — Iteration 8: useCountryPreview debounce / cache / in-flight dedupe /
// abort behavior (architecture § 6.3, § 2-D4).
//
// Runs in plain node: `$fetch` is stubbed on globalThis, timers + Date are
// faked. The composable calls onUnmounted() outside a component instance,
// which only triggers a Vue warning — silenced below.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useCountryPreview } from '~/composables/useCountryPreview'
import type { CountryPreviewResponseDTO } from '~/types/dto'

interface Deferred {
  promise: Promise<CountryPreviewResponseDTO>
  resolve: (v: CountryPreviewResponseDTO) => void
  reject: (e: unknown) => void
}

function deferred(): Deferred {
  let resolve!: (v: CountryPreviewResponseDTO) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<CountryPreviewResponseDTO>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function previewOf(code: string): CountryPreviewResponseDTO {
  return { countryCode: code, countryName: `Country ${code}`, items: [] }
}

interface FetchCall {
  url: string
  signal: AbortSignal | undefined
  deferred: Deferred
}

let calls: FetchCall[] = []
let warnSpy: { mockRestore: () => void }

function flush(): Promise<void> {
  // Two microtask hops: promise.then chain inside the composable.
  return Promise.resolve().then(() => Promise.resolve()).then(() => undefined)
}

beforeEach(() => {
  vi.useFakeTimers()
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  calls = []
  const fetchMock = (url: string, opts?: { signal?: AbortSignal }) => {
    const d = deferred()
    calls.push({ url, signal: opts?.signal, deferred: d })
    return d.promise
  }
  ;(globalThis as { $fetch?: unknown }).$fetch = fetchMock
})

afterEach(() => {
  vi.useRealTimers()
  warnSpy.mockRestore()
  delete (globalThis as { $fetch?: unknown }).$fetch
})

describe('useCountryPreview — hover-intent debounce', () => {
  it('does not fetch before 250 ms', () => {
    const { open } = useCountryPreview()
    open('KR')
    vi.advanceTimersByTime(249)
    expect(calls).toHaveLength(0)
  })

  it('fetches exactly once after 250 ms on the preview endpoint', () => {
    const { open, state } = useCountryPreview()
    open('KR')
    vi.advanceTimersByTime(250)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('/api/countries/KR/preview')
    expect(state.value).toMatchObject({ code: 'KR', status: 'loading' })
  })

  it('replaces the timer when the hover target changes (only last code fetched)', () => {
    const { open } = useCountryPreview()
    open('KR')
    vi.advanceTimersByTime(100)
    open('JP')
    vi.advanceTimersByTime(250)
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('/api/countries/JP/preview')
  })

  it('close() during the debounce window produces zero requests (<250 ms graze)', () => {
    const { open, close } = useCountryPreview()
    open('KR')
    vi.advanceTimersByTime(200)
    close()
    vi.advanceTimersByTime(10_000)
    expect(calls).toHaveLength(0)
  })

  it('openImmediate skips the debounce (keyboard focus path)', () => {
    const { openImmediate } = useCountryPreview()
    openImmediate('KR')
    expect(calls).toHaveLength(1)
  })
})

describe('useCountryPreview — cache (TTL 5 min)', () => {
  it('re-opening the same country within the TTL costs zero requests', async () => {
    const { openImmediate, close, state } = useCountryPreview()
    openImmediate('KR')
    calls[0]!.deferred.resolve(previewOf('KR'))
    await flush()
    expect(state.value).toMatchObject({ code: 'KR', status: 'ready' })

    close()
    openImmediate('KR')
    expect(calls).toHaveLength(1) // cache hit — no new network call
    expect(state.value).toMatchObject({ code: 'KR', status: 'ready' })
    expect(state.value?.data).toEqual(previewOf('KR'))
  })

  it('refetches after the 5-minute TTL expires', async () => {
    const { openImmediate, close } = useCountryPreview()
    openImmediate('KR')
    calls[0]!.deferred.resolve(previewOf('KR'))
    await flush()
    close()

    vi.advanceTimersByTime(5 * 60 * 1000 + 1)
    openImmediate('KR')
    expect(calls).toHaveLength(2)
  })
})

describe('useCountryPreview — in-flight dedupe + abort', () => {
  it('two opens for the same code share one request', async () => {
    const { openImmediate, state } = useCountryPreview()
    openImmediate('KR')
    openImmediate('KR')
    expect(calls).toHaveLength(1)
    calls[0]!.deferred.resolve(previewOf('KR'))
    await flush()
    expect(state.value).toMatchObject({ code: 'KR', status: 'ready' })
  })

  it('close() aborts the in-flight request and clears state', () => {
    const { openImmediate, close, state } = useCountryPreview()
    openImmediate('KR')
    expect(calls[0]!.signal?.aborted).toBe(false)
    close()
    expect(calls[0]!.signal?.aborted).toBe(true)
    expect(state.value).toBeNull()
  })

  it('switching country aborts the previous fetch and never surfaces it', async () => {
    const { openImmediate, state } = useCountryPreview()
    openImmediate('KR')
    openImmediate('JP')
    // New code replaces the controller and aborts the old one.
    expect(calls[0]!.signal?.aborted).toBe(true)
    expect(calls).toHaveLength(2)

    calls[0]!.deferred.reject(new DOMException('aborted', 'AbortError'))
    calls[1]!.deferred.resolve(previewOf('JP'))
    await flush()
    expect(state.value).toMatchObject({ code: 'JP', status: 'ready' })
  })

  it('a failed fetch surfaces status "error" for the hovered country', async () => {
    const { openImmediate, state } = useCountryPreview()
    openImmediate('KR')
    calls[0]!.deferred.reject(new Error('500'))
    await flush()
    expect(state.value).toMatchObject({ code: 'KR', status: 'error' })
  })

  it('an error is not cached — the next hover retries', async () => {
    const { openImmediate, state } = useCountryPreview()
    openImmediate('KR')
    calls[0]!.deferred.reject(new Error('500'))
    await flush()

    openImmediate('KR')
    expect(calls).toHaveLength(2)
    calls[1]!.deferred.resolve(previewOf('KR'))
    await flush()
    expect(state.value).toMatchObject({ code: 'KR', status: 'ready' })
  })
})
