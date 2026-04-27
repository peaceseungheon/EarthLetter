<script setup lang="ts">
import type { TrendingItemDTO } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

interface Props {
  items: TrendingItemDTO[]
}
defineProps<Props>()

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
  <ol
    class="flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10"
  >
    <li
      v-for="(item, i) in items"
      :key="`${item.countryCode}-${item.topicSlug}`"
    >
      <NuxtLink
        :to="`/country/${item.countryCode}/${item.topicSlug}`"
        class="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-surface-muted dark:hover:bg-surface-dark-muted"
      >
        <span class="w-6 shrink-0 text-right text-sm font-bold tabular-nums text-ink-muted dark:text-ink-dark-muted">
          {{ i + 1 }}
        </span>
        <span class="text-xl leading-none" aria-hidden="true">{{ flagEmoji(item.countryCode) }}</span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-ink dark:text-ink-dark">
            {{ item.countryName }}
          </p>
          <p class="text-xs text-ink-muted dark:text-ink-dark-muted">
            {{ topicLabel(item.topicSlug) }}
            <span class="ml-2 opacity-70">
              {{ item.todayCount }} articles today · {{ item.avg7dCount.toFixed(1) }} avg/day
            </span>
          </p>
        </div>
        <TrendingBadge :ratio="item.spikeRatio" />
      </NuxtLink>
    </li>
    <li
      v-if="items.length === 0"
      class="px-4 py-6 text-center text-sm text-ink-muted dark:text-ink-dark-muted"
    >
      No trending spikes detected in the last 24 hours.
    </li>
  </ol>
</template>
