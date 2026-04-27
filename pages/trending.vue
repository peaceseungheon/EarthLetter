<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useCountriesStore } from '~/stores/countries'

useSiteSeo({
  title: 'Trending Now | EarthLetter',
  description: 'Discover which countries are seeing sudden surges in news coverage right now.',
  ogType: 'website'
})

const router = useRouter()
const countriesStore = useCountriesStore()

await useAsyncData('countries-hydrate-trending', async () => {
  await countriesStore.fetchIfStale()
  return true
})

const countries = computed(() => countriesStore.items)

const { data, pending } = useTrending()
const items = computed(() => data.value ?? [])

const trendingCountries = computed<Record<string, number>>(() =>
  Object.fromEntries(items.value.map(i => [i.countryCode, i.spikeRatio]))
)

const showSkeleton = computed(() => pending.value && items.value.length === 0)

function goToCountry(payload: { code: string }) {
  router.push(`/country/${payload.code}`)
}
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
    <section class="flex flex-col gap-3">
      <h1 class="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
        Trending Now
      </h1>
      <p class="max-w-2xl text-ink-muted dark:text-ink-dark-muted">
        Countries and topics with the biggest surge in news coverage over the last 24 hours
        compared to their 7-day average. Refreshed hourly.
      </p>
    </section>

    <section class="flex flex-col gap-4">
      <WorldMap
        :countries="countries"
        :trending-countries="trendingCountries"
        @country-click="goToCountry"
      />
    </section>

    <section class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
        Top surges
      </h2>
      <TrendingSkeleton v-if="showSkeleton" :rows="10" />
      <TrendingRankingList v-else :items="items" />
    </section>
  </div>
</template>
