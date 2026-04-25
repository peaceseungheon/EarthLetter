<script setup lang="ts">
// Country overview: 3 topic sections (latest 5 each).

import { computed } from 'vue'
import { createError } from 'h3'
import { useRoute } from 'vue-router'
import type { ArticlesResponseDTO, TopicSlug } from '~/types/dto'
import { TOPIC_META, TOPIC_SLUGS, isIsoCountryCode } from '~/types/domain'
import { useCountriesStore } from '~/stores/countries'

const route = useRoute()
const rawCode = String(route.params.code ?? '').toUpperCase()

if (!isIsoCountryCode(rawCode)) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}

const countriesStore = useCountriesStore()
await useAsyncData(`country-meta-${rawCode}`, async () => {
  await countriesStore.fetchIfStale()
  return true
})

const country = computed(() => countriesStore.byCode(rawCode))

if (!country.value) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}

// Fetch latest 5 per topic with lazy: true to avoid blocking navigation.
const topicFetches = TOPIC_SLUGS.map((topic) => {
  return useFetch<ArticlesResponseDTO>('/api/articles', {
    key: `country-${rawCode}-${topic}-top5`,
    query: { country: rawCode, topic, page: 1, pageSize: 5 },
    server: true,
    lazy: true
  })
})

const topicsPending = computed(() =>
  topicFetches.some(f => f.pending.value)
)

const topicResults = computed(() =>
  TOPIC_SLUGS.map((topic, i) => ({
    topic,
    items: topicFetches[i]!.data.value?.items ?? []
  }))
)

useSiteSeo({
  title: `${country.value.nameEn} — EarthLetter`,
  description: `Latest military, economy, and politics news for ${country.value.nameEn}.`,
  ogType: 'website'
})
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-10 px-4 py-8">
    <CountryHeader :country="country!" />

    <AdSlot slot-id="country-leaderboard" format="horizontal" :min-height-px="90" />

    <CountryOverviewSkeleton v-if="topicsPending" />
    <template v-else>
      <section
        v-for="group in topicResults"
        :key="group.topic"
        class="flex flex-col gap-4"
      >
        <div class="flex items-end justify-between">
          <div>
            <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
              {{ TOPIC_META[group.topic as TopicSlug].labelEn }}
            </h2>
            <p class="text-sm text-ink-muted dark:text-ink-dark-muted">
              {{ TOPIC_META[group.topic as TopicSlug].description }}
            </p>
          </div>
          <NuxtLink
            :to="`/country/${country!.code}/${group.topic}`"
            class="text-sm font-medium text-accent hover:underline"
          >
            View all →
          </NuxtLink>
        </div>

        <ArticleList
          :articles="group.items"
          :ad-every-n="0"
        />
      </section>
    </template>
  </div>
</template>
