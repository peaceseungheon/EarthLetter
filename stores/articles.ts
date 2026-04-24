// stores/articles.ts
// See architecture § 7.2.

import { defineStore } from 'pinia'
import type {
  ArticleDTO,
  ArticlesResponseDTO,
  TopicSlug
} from '~/types/dto'

interface ArticlesPageKey {
  country: string
  topic: TopicSlug
  page: number
  pageSize?: number
}

interface ArticlesPage {
  items: ArticleDTO[]
  total: number
  totalPages: number
  page: number
  pageSize: number
  fetchedAt: number
}

interface ArticlesState {
  pages: Record<string, ArticlesPage>
  currentKey: string | null
  loading: boolean
  error: string | null
}

const FRESH_MS = 2 * 60 * 1000

function makeKey(p: ArticlesPageKey): string {
  return `${p.country.toUpperCase()}:${p.topic}:${p.page}`
}

export const useArticlesStore = defineStore('articles', {
  state: (): ArticlesState => ({
    pages: {},
    currentKey: null,
    loading: false,
    error: null
  }),

  getters: {
    current: (state): ArticlesPage | null =>
      state.currentKey ? (state.pages[state.currentKey] ?? null) : null
  },

  actions: {
    async load(params: ArticlesPageKey): Promise<void> {
      const key = makeKey(params)
      this.currentKey = key

      const hit = this.pages[key]
      if (hit && Date.now() - hit.fetchedAt < FRESH_MS) return

      this.loading = true
      this.error = null
      try {
        const query: Record<string, string | number> = {
          country: params.country.toUpperCase(),
          topic: params.topic,
          page: params.page
        }
        if (params.pageSize) query.pageSize = params.pageSize

        const { data, error } = await useFetch<ArticlesResponseDTO>(
          '/api/articles',
          {
            query,
            key: `articles:${key}`
          }
        )
        if (error.value) throw error.value
        const res = data.value
        if (res) {
          this.pages[key] = {
            items: res.items,
            total: res.total,
            totalPages: res.totalPages,
            page: res.page,
            pageSize: res.pageSize,
            fetchedAt: Date.now()
          }
        }
      } catch (e: unknown) {
        this.error =
          e instanceof Error ? e.message : 'Failed to load articles'
      } finally {
        this.loading = false
      }
    },

    clear(): void {
      this.pages = {}
      this.currentKey = null
      this.error = null
    }
  }
})
