// stores/countries.ts
// See architecture § 7.1.

import { defineStore } from 'pinia'
import type { CountriesResponseDTO, CountryDTO } from '~/types/dto'

interface CountriesState {
  items: CountryDTO[]
  lastFetched: number | null
  loading: boolean
  error: string | null
}

const STALE_MS = 5 * 60 * 1000

export const useCountriesStore = defineStore('countries', {
  state: (): CountriesState => ({
    items: [],
    lastFetched: null,
    loading: false,
    error: null
  }),

  getters: {
    byCode:
      (state) =>
        (code: string): CountryDTO | null => {
          if (!code) return null
          const target = code.toUpperCase()
          return state.items.find((c) => c.code === target) ?? null
        },
    clickable: (state): CountryDTO[] => state.items.filter((c) => c.hasSources),
    totalSourcesCovered: (state): number =>
      state.items.reduce((sum, c) => sum + c.sourceCount, 0),
    isStale:
      (state) =>
        (ttlMs: number = STALE_MS): boolean =>
          state.lastFetched === null || Date.now() - state.lastFetched > ttlMs
  },

  actions: {
    async fetchIfStale(): Promise<void> {
      if (!this.isStale()) return
      await this.refresh()
    },

    async refresh(): Promise<void> {
      this.loading = true
      this.error = null
      try {
        const { data, error } = await useFetch<CountriesResponseDTO>(
          '/api/countries',
          { key: 'countries-all' }
        )
        if (error.value) throw error.value
        this.items = data.value?.items ?? []
        this.lastFetched = Date.now()
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to load countries'
      } finally {
        this.loading = false
      }
    }
  }
})
