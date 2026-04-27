<script setup lang="ts">
import { TOPIC_META } from '~/types/domain'

const { data, pending } = useTrending()
const top5 = computed(() => (data.value ?? []).slice(0, 5))
const showSkeleton = computed(() => pending.value && top5.value.length === 0)

function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map(c => String.fromCodePoint(0x1F1E6 - 65 + c.charCodeAt(0)))
    .join('')
}

function topicLabel(slug: string): string {
  return TOPIC_META[slug as keyof typeof TOPIC_META]?.labelEn ?? slug
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
        Trending right now
      </h2>
      <NuxtLink
        to="/trending"
        class="text-sm text-accent hover:underline"
      >
        View all →
      </NuxtLink>
    </div>

    <TrendingSkeleton v-if="showSkeleton" :rows="5" />

    <div
      v-else-if="top5.length > 0"
      class="flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10"
    >
      <NuxtLink
        v-for="item in top5"
        :key="`${item.countryCode}-${item.topicSlug}`"
        :to="`/country/${item.countryCode}/${item.topicSlug}`"
        class="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-muted dark:hover:bg-surface-dark-muted"
      >
        <span class="text-xl leading-none" aria-hidden="true">{{ flagEmoji(item.countryCode) }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink dark:text-ink-dark">
            {{ item.countryName }}
          </p>
          <p class="text-xs text-ink-muted dark:text-ink-dark-muted">
            {{ topicLabel(item.topicSlug) }}
          </p>
        </div>
        <TrendingBadge :ratio="item.spikeRatio" />
      </NuxtLink>
    </div>

    <p
      v-else
      class="text-sm text-ink-muted dark:text-ink-dark-muted"
    >
      No trending spikes detected in the last 24 hours.
    </p>
  </div>
</template>
