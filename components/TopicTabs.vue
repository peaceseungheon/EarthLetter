<script setup lang="ts">
import type { TopicSlug } from '~/types/dto'
import { TOPIC_META, TOPIC_SLUGS } from '~/types/domain'

interface Props {
  countryCode: string
  active?: TopicSlug
}
defineProps<Props>()
</script>

<template>
  <nav
    class="flex flex-wrap gap-2 overflow-x-auto"
    role="tablist"
    aria-label="News topic"
  >
    <NuxtLink
      v-for="slug in TOPIC_SLUGS"
      :key="slug"
      :to="`/country/${countryCode.toUpperCase()}/${slug}`"
      role="tab"
      :aria-selected="active === slug"
      class="inline-flex h-10 items-center justify-center rounded-full border px-4 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      :class="
        active === slug
          ? 'border-accent bg-accent text-white shadow-sm'
          : 'border-black/10 bg-surface text-ink hover:bg-surface-muted dark:border-white/15 dark:bg-surface-dark-muted dark:text-ink-dark dark:hover:bg-surface-dark'
      "
    >
      {{ TOPIC_META[slug].labelEn }}
    </NuxtLink>
  </nav>
</template>
