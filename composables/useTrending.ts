import type { TrendingResponseDTO } from '~/types/dto'

export function useTrending() {
  return useFetch<TrendingResponseDTO>('/api/trending', { lazy: true })
}
