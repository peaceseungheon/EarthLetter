// composables/useArticles.ts
//
// Pagination-aware wrapper over `useArticlesStore`. Components pass reactive
// refs for `country`, `topic`, `page`; this composable re-loads on change and
// exposes a memoized page record.

import { computed, watch } from 'vue'
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

  // Initial + reactive reload. Keep watch() in composable so callers don't
  // duplicate the plumbing per-page.
  watch(
    () => [input.country.value, input.topic.value, input.page.value] as const,
    () => {
      void reload()
    },
    { immediate: true }
  )

  const current = computed(() => store.current)

  return {
    items: computed(() => current.value?.items ?? []),
    total: computed(() => current.value?.total ?? 0),
    totalPages: computed(() => current.value?.totalPages ?? 0),
    loading: toRef(store, 'loading'),
    error: toRef(store, 'error'),
    reload
  }
}
