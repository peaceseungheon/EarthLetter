// stores/adminSources.ts
//
// Pinia store for the admin source dashboard. Owns the canonical list,
// server-side filter params, loading/error state, and all CRUD mutations.
// See architecture § 7 (Admin UI flow) and § 3 (DTO contract).
//
// Optimistic update policy:
//   - `toggle`: flip locally first, PATCH, rollback on error.
//   - `create` / `remove` / `updateName`: wait for server response, then
//     reconcile the list. These are low-frequency so we prefer correctness.

import { defineStore } from 'pinia'
import type {
  AdminSourceCreateDTO,
  AdminSourceDTO,
  AdminSourceDeleteResponseDTO,
  AdminSourcesQueryDTO,
  AdminSourcesResponseDTO
} from '~/types/dto'

interface AdminSourcesState {
  items: AdminSourceDTO[]
  total: number
  loading: boolean
  error: string | null
  filters: AdminSourcesQueryDTO
}

function defaultFilters(): AdminSourcesQueryDTO {
  return { enabled: 'all' }
}

function normaliseQuery(
  filters: AdminSourcesQueryDTO
): Record<string, string> {
  const q: Record<string, string> = {}
  if (filters.country) q.country = filters.country
  if (filters.topic) q.topic = filters.topic
  if (filters.enabled) q.enabled = filters.enabled
  if (filters.disabled) q.disabled = filters.disabled
  return q
}

function extractErrorMessage(e: unknown, fallback: string): string {
  const structured = (e as { data?: { message?: string } }).data?.message
  if (structured) return structured
  if (e instanceof Error) return e.message
  return fallback
}

export const useAdminSourcesStore = defineStore('adminSources', {
  state: (): AdminSourcesState => ({
    items: [],
    total: 0,
    loading: false,
    error: null,
    filters: defaultFilters()
  }),

  getters: {
    /**
     * Client-side filter used as a safety net on top of the server filter
     * (e.g. when the server returns `enabled=all` but the UI wants to
     * narrow further without a round-trip).
     */
    filtered: (state): AdminSourceDTO[] => {
      const { country, topic, enabled, disabled } = state.filters
      return state.items.filter((item) => {
        if (country && item.countryCode !== country) return false
        if (topic && item.topicSlug !== topic) return false
        if (enabled === 'true' && !item.enabled) return false
        if (enabled === 'false' && item.enabled) return false
        if (disabled === 'auto' && item.disabledAt === null) return false
        if (
          disabled === 'manual'
          && !(item.enabled === false && item.disabledAt === null)
        ) {
          return false
        }
        return true
      })
    }
  },

  actions: {
    setFilters(next: AdminSourcesQueryDTO): void {
      this.filters = { ...next }
    },

    resetFilters(): void {
      this.filters = defaultFilters()
    },

    async fetch(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const res = await $fetch<AdminSourcesResponseDTO>(
          '/api/admin/sources',
          {
            method: 'GET',
            query: normaliseQuery(this.filters),
            credentials: 'include'
          }
        )
        this.items = res?.items ?? []
        this.total = res?.total ?? 0
      } catch (e: unknown) {
        this.items = []
        this.total = 0
        this.error = extractErrorMessage(e, 'Failed to load sources')
      } finally {
        this.loading = false
      }
    },

    async toggle(id: number, enabled: boolean): Promise<void> {
      const idx = this.items.findIndex((s) => s.id === id)
      if (idx === -1) return
      const snapshot = this.items[idx]
      if (!snapshot) return
      // Optimistic flip. If we're enabling, also clear fail bookkeeping so
      // the UI reflects the server's transactional reset immediately.
      this.items.splice(idx, 1, {
        ...snapshot,
        enabled,
        failCount: enabled ? 0 : snapshot.failCount,
        disabledAt: enabled ? null : snapshot.disabledAt
      })
      try {
        const updated = await $fetch<AdminSourceDTO>(
          `/api/admin/sources/${id}`,
          {
            method: 'PATCH',
            body: { enabled },
            credentials: 'include'
          }
        )
        this.items.splice(idx, 1, updated)
      } catch (e: unknown) {
        // Rollback — caller surfaces the error via `error`.
        this.items.splice(idx, 1, snapshot)
        this.error = extractErrorMessage(e, 'Failed to update source')
        throw e
      }
    },

    async create(input: AdminSourceCreateDTO): Promise<AdminSourceDTO> {
      this.error = null
      try {
        const created = await $fetch<AdminSourceDTO>('/api/admin/sources', {
          method: 'POST',
          body: input,
          credentials: 'include'
        })
        // Prepend so the newest source is visible without a full refetch.
        this.items = [created, ...this.items]
        this.total += 1
        return created
      } catch (e: unknown) {
        this.error = extractErrorMessage(e, 'Failed to create source')
        throw e
      }
    },

    async remove(id: number): Promise<AdminSourceDeleteResponseDTO> {
      this.error = null
      try {
        const res = await $fetch<AdminSourceDeleteResponseDTO>(
          `/api/admin/sources/${id}`,
          {
            method: 'DELETE',
            credentials: 'include'
          }
        )
        this.items = this.items.filter((s) => s.id !== id)
        this.total = Math.max(0, this.total - 1)
        return res
      } catch (e: unknown) {
        this.error = extractErrorMessage(e, 'Failed to delete source')
        throw e
      }
    },

    async updateName(id: number, name: string): Promise<void> {
      const idx = this.items.findIndex((s) => s.id === id)
      if (idx === -1) return
      this.error = null
      try {
        const updated = await $fetch<AdminSourceDTO>(
          `/api/admin/sources/${id}`,
          {
            method: 'PATCH',
            body: { name },
            credentials: 'include'
          }
        )
        this.items.splice(idx, 1, updated)
      } catch (e: unknown) {
        this.error = extractErrorMessage(e, 'Failed to update source name')
        throw e
      }
    }
  }
})
