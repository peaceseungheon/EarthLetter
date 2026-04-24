// composables/useAdminSources.ts
//
// Thin composable facade over `useAdminSourcesStore`. Call sites that only
// need the reactive list + mutation helpers can depend on this; direct
// access to the Pinia store is still fine when you want the filter-state
// setters or the `filtered` getter.
//
// The `filters` ref is watched and triggers `store.fetch()` on change, so
// the component layer just mutates `filters.value` to re-query.

import { ref, watch } from 'vue'
import type {
  AdminSourceCreateDTO,
  AdminSourceDTO,
  AdminSourceDeleteResponseDTO,
  AdminSourcesQueryDTO
} from '~/types/dto'
import { useAdminSourcesStore } from '~/stores/adminSources'

export interface UseAdminSourcesResult {
  items: Ref<AdminSourceDTO[]>
  total: Ref<number>
  loading: Ref<boolean>
  error: Ref<string | null>
  filters: Ref<AdminSourcesQueryDTO>
  refresh: () => Promise<void>
  toggleSource: (id: number, enabled: boolean) => Promise<void>
  createSource: (input: AdminSourceCreateDTO) => Promise<AdminSourceDTO>
  deleteSource: (id: number) => Promise<AdminSourceDeleteResponseDTO>
  updateSourceName: (id: number, name: string) => Promise<void>
}

export function useAdminSources(
  initialFilters?: AdminSourcesQueryDTO
): UseAdminSourcesResult {
  const store = useAdminSourcesStore()

  const filters = ref<AdminSourcesQueryDTO>({
    enabled: 'all',
    ...(initialFilters ?? {})
  })

  const items = toRef(store, 'items')
  const total = toRef(store, 'total')
  const loading = toRef(store, 'loading')
  const error = toRef(store, 'error')

  // Sync local filters → store + refetch. Deep watch because the filter
  // object is mutated in place by form controls (v-model on nested keys).
  watch(
    filters,
    (next) => {
      store.setFilters(next)
      void store.fetch()
    },
    { deep: true, immediate: true }
  )

  return {
    items,
    total,
    loading,
    error,
    filters,
    refresh: () => store.fetch(),
    toggleSource: (id, enabled) => store.toggle(id, enabled),
    createSource: (input) => store.create(input),
    deleteSource: (id) => store.remove(id),
    updateSourceName: (id, name) => store.updateName(id, name)
  }
}
