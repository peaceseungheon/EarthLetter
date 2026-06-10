// composables/useArticles.ts
//
// Pagination-aware wrapper over `useArticlesStore`. Components pass reactive
// refs for `country`, `topic`, `page`; this composable re-loads on change and
// exposes a memoized page record.

import { computed } from 'vue'
import type { ArticleDTO, TopicSlug } from '~/types/dto'
import { useArticlesStore } from '~/stores/articles'

export interface UseArticlesInput {
  country: Ref<string> | ComputedRef<string>
  topic: Ref<TopicSlug> | ComputedRef<TopicSlug>
  page: Ref<number> | ComputedRef<number>
  pageSize?: number
}

export interface UseArticlesResult {
  items: ComputedRef<ArticleDTO[]>
  total: ComputedRef<number>
  totalPages: ComputedRef<number>
  loading: Ref<boolean>
  error: Ref<string | null>
  reload: () => Promise<void>
  /**
   * Pending useAsyncData promise for the current load. Pages await this
   * (e.g. alongside the countries fetch via Promise.all) so SSR HTML
   * includes the article list.
   */
  asyncData: Promise<unknown>
}

export function useArticles(input: UseArticlesInput): UseArticlesResult {
  const store = useArticlesStore()

  async function reload(): Promise<void> {
    await store.load({
      country: input.country.value,
      topic: input.topic.value,
      page: input.page.value,
      pageSize: input.pageSize
    })
  }

  // useAsyncData (instead of a manual immediate watch) so that:
  // - SSR awaits the load and the article list ships in the HTML payload
  //   (store state is serialized by @pinia/nuxt; the boolean payload entry
  //   keeps the handler from re-running during hydration).
  // - Param changes re-run the load via `watch`; the store's FRESH_MS cache
  //   keeps client-side navigation (pagination/topic tabs/back) cheap.
  // Key is derived from the initial params only (stable string key);
  // per-page memoization lives in the store, not the payload.
  const asyncData = useAsyncData(
    `articles:${input.country.value.toUpperCase()}:${input.topic.value}:${input.page.value}`,
    async () => {
      await reload()
      return true
    },
    {
      watch: [
        () => input.country.value,
        () => input.topic.value,
        () => input.page.value
      ]
    }
  )

  const current = computed(() => store.current)

  return {
    items: computed(() => current.value?.items ?? []),
    total: computed(() => current.value?.total ?? 0),
    totalPages: computed(() => current.value?.totalPages ?? 0),
    loading: toRef(store, 'loading'),
    error: toRef(store, 'error'),
    reload,
    asyncData
  }
}
