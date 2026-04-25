<script setup lang="ts">
import { computed } from 'vue'
import { createError } from 'h3'
import { useRoute } from 'vue-router'
import { isIsoCountryCode } from '~/types/domain'
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

useSiteSeo({
  title: `${country.value.nameEn} Trends — EarthLetter`,
  description: `Article volume trends by topic for ${country.value.nameEn}, updated hourly.`,
  ogType: 'website'
})
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
    <nav
      class="flex flex-wrap items-center gap-2 text-sm text-ink-muted dark:text-ink-dark-muted"
      aria-label="Breadcrumb"
    >
      <NuxtLink to="/" class="hover:underline">Map</NuxtLink>
      <span aria-hidden="true">›</span>
      <NuxtLink :to="`/country/${country!.code}`" class="hover:underline">
        {{ country!.nameEn }}
      </NuxtLink>
      <span aria-hidden="true">›</span>
      <span class="text-ink dark:text-ink-dark">Trends</span>
    </nav>

    <header>
      <h1 class="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
        Trends — {{ country!.nameEn }}
      </h1>
      <p class="mt-1 text-ink-muted dark:text-ink-dark-muted">
        Article volume by topic over time.
      </p>
    </header>

    <TopicTabs :country-code="country!.code" />

    <AdSlot slot-id="trends-leaderboard" format="horizontal" :min-height-px="90" />

    <CountryTrendsChart :country-code="rawCode" />
  </div>
</template>
