<script setup lang="ts">
// Primary SEO surface: paginated article list for one (country, topic).

import { computed } from 'vue'
import { createError } from 'h3'
import { useRoute } from 'vue-router'
import type { TopicSlug } from '~/types/dto'
import { TOPIC_META, isIsoCountryCode, isTopicSlug } from '~/types/domain'
import { useCountriesStore } from '~/stores/countries'

const route = useRoute()

const rawCode = String(route.params.code ?? '').toUpperCase()
const rawTopic = String(route.params.topic ?? '')

if (!isIsoCountryCode(rawCode)) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}
if (!isTopicSlug(rawTopic)) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}

const topic = rawTopic as TopicSlug

const countriesStore = useCountriesStore()
await useAsyncData(`country-header-${rawCode}`, async () => {
  await countriesStore.fetchIfStale()
  return true
})

const country = computed(() => countriesStore.byCode(rawCode))

if (!country.value) {
  throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
}

const pageParam = computed(() => {
  const raw = Number(route.query.page ?? 1)
  return Number.isInteger(raw) && raw >= 1 ? raw : 1
})

const codeRef = computed(() => rawCode)
const topicRef = computed(() => topic)

const { items, total, totalPages, loading, error } = useArticles({
  country: codeRef,
  topic: topicRef,
  page: pageParam,
  pageSize: 20,
})

const topicMeta = computed(() => TOPIC_META[topic])

useSiteSeo({
  title: computed(
    () => `${topicMeta.value.labelEn} news — ${country.value!.nameEn} — EarthLetter`
  ).value,
  description: `${topicMeta.value.description} Headlines for ${country.value!.nameEn}, refreshed hourly from curated sources.`,
  ogType: 'website',
})

// JSON-LD CollectionPage + ItemList — see architecture § 10.
const jsonLd = computed(() => {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: `${topicMeta.value.labelEn} news — ${country.value!.nameEn}`,
    url: `${siteUrl}/country/${country.value!.code}/${topic}`,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: items.value.slice(0, 10).map((a, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: a.link,
        name: a.title,
      })),
    },
  }
})

function makePageUrl(n: number): string {
  const base = `/country/${country.value!.code}/${topic}`
  return n === 1 ? base : `${base}?page=${n}`
}
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
    <JsonLd :data="jsonLd" />

    <nav
      class="flex flex-wrap items-center gap-2 text-sm text-ink-muted dark:text-ink-dark-muted"
      aria-label="Breadcrumb"
    >
      <NuxtLink to="/" class="hover:underline">Map</NuxtLink>
      <span aria-hidden="true">›</span>
      <NuxtLink
        :to="`/country/${country!.code}`"
        class="hover:underline"
      >
        {{ country!.nameEn }}
      </NuxtLink>
      <span aria-hidden="true">›</span>
      <span class="text-ink dark:text-ink-dark">{{ topicMeta.labelEn }}</span>
    </nav>

    <header class="flex flex-col gap-2">
      <h1 class="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
        {{ topicMeta.labelEn }} — {{ country!.nameEn }}
      </h1>
      <p class="text-ink-muted dark:text-ink-dark-muted">
        {{ topicMeta.description }} {{ total }} articles available.
      </p>
    </header>

    <TopicTabs
      :active="topic"
      :country-code="country!.code"
    />

    <AdSlot slot-id="list-leaderboard" format="horizontal" :min-height-px="90" />

    <ArticleList
      :articles="items"
      :loading="loading"
      :error="error"
      :ad-every-n="5"
      ad-slot-id="list-infeed"
    />

    <Pagination
      v-if="totalPages > 1"
      :page="pageParam"
      :total-pages="totalPages"
      :make-url="makePageUrl"
    />
  </div>
</template>
