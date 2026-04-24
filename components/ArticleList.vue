<script setup lang="ts">
import type { ArticleDTO } from '~/types/dto'

interface Props {
  articles: ArticleDTO[]
  loading?: boolean
  error?: string | null
  /** Render an AdSlot after every Nth card; 0 disables. Default 5. */
  adEveryN?: number
  /** AdSense slot ID for in-feed ads; required when adEveryN > 0. */
  adSlotId?: string
}
const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: null,
  adEveryN: 5,
  adSlotId: ''
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Loading skeleton -->
    <div
      v-if="props.loading && props.articles.length === 0"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
      aria-busy="true"
    >
      <div
        v-for="n in 6"
        :key="n"
        class="animate-pulse rounded-lg border border-black/5 bg-surface-muted p-4 dark:border-white/10 dark:bg-surface-dark-muted"
      >
        <div class="mb-3 aspect-[16/9] w-full rounded bg-black/5 dark:bg-white/10" />
        <div class="h-4 w-1/3 rounded bg-black/5 dark:bg-white/10" />
        <div class="mt-2 h-5 w-3/4 rounded bg-black/5 dark:bg-white/10" />
        <div class="mt-2 h-3 w-full rounded bg-black/5 dark:bg-white/10" />
      </div>
    </div>

    <!-- Error -->
    <EmptyState
      v-else-if="props.error"
      title="Something went wrong"
      :message="props.error"
      icon="error"
    />

    <!-- Empty -->
    <EmptyState
      v-else-if="props.articles.length === 0"
      title="No articles yet"
      message="We haven't collected stories for this selection. Our feeds refresh hourly — please check back soon."
    />

    <!-- List -->
    <div v-else class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <template v-for="(article, idx) in props.articles" :key="article.id">
        <ArticleCard :article="article" />
        <div
          v-if="
            props.adEveryN > 0 &&
            props.adSlotId &&
            (idx + 1) % props.adEveryN === 0 &&
            idx !== props.articles.length - 1
          "
          class="sm:col-span-2 lg:col-span-3"
        >
          <AdSlot
            :slot-id="props.adSlotId"
            format="horizontal"
            :min-height-px="120"
            label="Advertisement"
          />
        </div>
      </template>
    </div>
  </div>
</template>
