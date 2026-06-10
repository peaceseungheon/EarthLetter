<script setup lang="ts">
// Presentational hover-preview popover (architecture § 6.4, § 2-D5).
// No data fetching here — GlobeMap.vue owns the useCountryPreview state and
// feeds it in. Anchored at the country centroid (container-relative %) with
// simple boundary flips; fixed 280px width so loading → ready never jumps.

import { computed } from 'vue'
import type { CountryPreviewArticleDTO, CountryPreviewResponseDTO, TopicSlug } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

type Placement = 'top' | 'bottom' | 'left' | 'right'

interface Props {
  /** Country the popover belongs to — needed for "View all" even on error. */
  countryCode: string
  /** Fallback header while loading / on error (from the countries list). */
  countryName: string
  preview: CountryPreviewResponseDTO | null
  status: 'loading' | 'ready' | 'error'
  /** Country centroid as % of the globe container (§ 2-D5). */
  anchor: { xPct: number; yPct: number }
  placement: Placement
}
const props = defineProps<Props>()

const TRANSFORMS: Record<Placement, string> = {
  top: 'translate(-50%, calc(-100% - 12px))',
  bottom: 'translate(-50%, 12px)',
  left: 'translate(calc(-100% - 12px), -50%)',
  right: 'translate(12px, -50%)'
}

const positionStyle = computed(() => ({
  left: `${props.anchor.xPct}%`,
  top: `${props.anchor.yPct}%`,
  transform: TRANSFORMS[props.placement]
}))

const headerName = computed(
  () => props.preview?.countryName ?? props.countryName
)
const items = computed<CountryPreviewArticleDTO[]>(
  () => props.preview?.items ?? []
)

function topicLabel(slug: TopicSlug): string {
  return TOPIC_META[slug]?.labelEn ?? slug
}
</script>

<template>
  <div
    id="globe-preview"
    class="pointer-events-auto absolute z-20 w-[280px] rounded-lg border border-black/10 bg-surface p-3 shadow-xl dark:border-white/10 dark:bg-surface-dark-muted"
    :style="positionStyle"
    role="status"
    aria-live="polite"
  >
    <p class="mb-2 truncate text-sm font-semibold text-ink dark:text-ink-dark">
      {{ headerName }}
    </p>

    <!-- Loading: fixed-size skeleton rows — no layout jump on resolve. -->
    <div
      v-if="status === 'loading'"
      class="flex flex-col gap-2.5"
      aria-hidden="true"
    >
      <div
        v-for="n in 3"
        :key="n"
        class="flex animate-pulse items-center gap-2"
      >
        <span class="h-4 w-14 shrink-0 rounded-full bg-black/10 dark:bg-white/10" />
        <span class="h-4 flex-1 rounded bg-black/10 dark:bg-white/10" />
      </div>
    </div>

    <p
      v-else-if="status === 'error'"
      class="text-xs text-ink-muted dark:text-ink-dark-muted"
    >
      Couldn't load preview
    </p>

    <template v-else>
      <p
        v-if="items.length === 0"
        class="text-xs text-ink-muted dark:text-ink-dark-muted"
      >
        No recent articles
      </p>
      <ul v-else class="flex flex-col gap-2.5">
        <li
          v-for="item in items"
          :key="item.id"
          class="flex items-start gap-2 text-xs"
        >
          <span
            class="mt-0.5 inline-flex shrink-0 items-center rounded-full bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink dark:bg-surface-dark dark:text-ink-dark"
          >
            {{ topicLabel(item.topicSlug) }}
          </span>
          <span class="min-w-0 flex-1">
            <!-- hasContent=true → internal detail route; otherwise plain text
                 (the country page is the catch-all, § 6.4). -->
            <NuxtLink
              v-if="item.hasContent"
              :to="`/article/${item.id}`"
              class="block truncate font-medium text-ink hover:text-accent dark:text-ink-dark"
            >
              {{ item.title }}
            </NuxtLink>
            <span
              v-else
              class="block truncate font-medium text-ink dark:text-ink-dark"
            >
              {{ item.title }}
            </span>
            <span class="block truncate text-ink-muted dark:text-ink-dark-muted">
              {{ item.sourceName }} · {{ useRelativeTime(item.publishedAt) }}
            </span>
          </span>
        </li>
      </ul>
    </template>

    <!-- Visually clear primary button (§ 9-6: 2-tap discoverability). -->
    <NuxtLink
      :to="`/country/${countryCode}`"
      class="mt-3 flex w-full items-center justify-center rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      View all →
    </NuxtLink>
  </div>
</template>
