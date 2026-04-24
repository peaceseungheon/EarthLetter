// composables/useCountries.ts
//
// Thin wrapper around the Pinia countries store for call sites that only
// need a reactive list + refresh hook. Prefer `useCountriesStore()` directly
// when you need getters like `byCode`.

import type { CountryDTO } from '~/types/dto'
import { useCountriesStore } from '~/stores/countries'
import { storeToRefs } from 'pinia'

export interface UseCountriesResult {
  countries: Ref<CountryDTO[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  refresh: () => Promise<void>
  ensureLoaded: () => Promise<void>
}

export function useCountries(): UseCountriesResult {
  const store = useCountriesStore()
  const { items, loading, error } = storeToRefs(store)
  return {
    countries: items,
    loading,
    error,
    refresh: () => store.refresh(),
    ensureLoaded: () => store.fetchIfStale()
  }
}
