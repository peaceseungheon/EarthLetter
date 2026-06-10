// composables/useCountryPreview.ts
//
// Hover-preview data layer (architecture § 6.3, § 2-D4).
// - 250 ms hover-intent debounce (timer replaced on every open()).
// - In-memory Map cache, TTL 5 min — re-hovering a country costs 0 requests.
// - In-flight dedupe: concurrent open() calls for the same code share one
//   promise; stale responses are ignored via identity comparison.
// - AbortController: close() cancels the running fetch.

import { onUnmounted, ref } from 'vue'
import type { Ref } from 'vue'
import type { CountryPreviewResponseDTO } from '~/types/dto'

const HOVER_DEBOUNCE_MS = 250
const CACHE_TTL_MS = 5 * 60 * 1000

export type PreviewStatus = 'loading' | 'ready' | 'error'

export interface PreviewState {
  code: string
  status: PreviewStatus
  data?: CountryPreviewResponseDTO
}

interface CacheEntry {
  data: CountryPreviewResponseDTO
  fetchedAt: number
}

export interface UseCountryPreviewResult {
  state: Ref<PreviewState | null>
  /** Hover entry point — debounced 250 ms (hover intent). */
  open: (code: string) => void
  /** Keyboard-focus entry point — no debounce (§ 2-D7). */
  openImmediate: (code: string) => void
  /** Cancels the debounce timer and aborts any in-flight fetch. */
  close: () => void
}

export function useCountryPreview(): UseCountryPreviewResult {
  const state = ref<PreviewState | null>(null)

  const cache = new Map<string, CacheEntry>()
  const inFlight = new Map<string, Promise<CountryPreviewResponseDTO>>()
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let abortController: AbortController | null = null

  function clearDebounce(): void {
    if (debounceTimer !== null) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
  }

  function show(code: string): void {
    const hit = cache.get(code)
    if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) {
      state.value = { code, status: 'ready', data: hit.data }
      return
    }

    state.value = { code, status: 'loading' }

    let request = inFlight.get(code)
    if (!request) {
      abortController?.abort()
      const controller = new AbortController()
      abortController = controller
      request = $fetch<CountryPreviewResponseDTO>(
        `/api/countries/${code}/preview`,
        { signal: controller.signal }
      )
      inFlight.set(code, request)
    }

    const tracked = request
    tracked
      .then((data) => {
        if (inFlight.get(code) === tracked) inFlight.delete(code)
        cache.set(code, { data, fetchedAt: Date.now() })
        if (state.value?.code === code) {
          state.value = { code, status: 'ready', data }
        }
      })
      .catch(() => {
        // Superseded or aborted requests must not surface as errors.
        if (inFlight.get(code) !== tracked) return
        inFlight.delete(code)
        if (state.value?.code === code) {
          state.value = { code, status: 'error' }
        }
      })
  }

  function open(code: string): void {
    clearDebounce()
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      show(code)
    }, HOVER_DEBOUNCE_MS)
  }

  function openImmediate(code: string): void {
    clearDebounce()
    show(code)
  }

  function close(): void {
    clearDebounce()
    abortController?.abort()
    abortController = null
    // Aborted promises are dead — drop them so a re-hover starts fresh.
    inFlight.clear()
    state.value = null
  }

  onUnmounted(close)

  return { state, open, openImmediate, close }
}
