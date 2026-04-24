// composables/useHomeFeatured.ts
// See architecture § 5 (home SSR+SWR) and § 4 (HomeResponseDTO).
//
// Wraps useFetch so SSR renders `/api/home` once and the client rehydrates
// without re-issuing the request.

import type { HomeResponseDTO } from '~/types/dto'

export function useHomeFeatured() {
  return useFetch<HomeResponseDTO>('/api/home', {
    key: 'home-featured',
    // Empty-state default prevents template `?.` chains everywhere.
    default: () => ({ featured: [] }) as HomeResponseDTO,
    server: true,
    lazy: false
  })
}
