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

// 2D/3D map mode — SSR always renders the globe; localStorage preference is
// applied after mount (architecture § 6.6).
const { mode: mapMode, setMode: setMapMode } = useMapMode()

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

// Face the #1 trending country on the globe (architecture § 2-D8, § 6.7).
// GlobeMap derives the rotation from this code deterministically in setup
// (SSR-safe) and only follows later arrivals while the globe is untouched.
const focusCountryCode = computed(() => items.value[0]?.countryCode ?? null)

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
      <div class="relative">
        <MapModeToggle
          :mode="mapMode"
          class="absolute right-3 top-3 z-10"
          @update:mode="setMapMode"
        />
        <GlobeMap
          v-if="mapMode === 'globe'"
          :countries="countries"
          :trending-countries="trendingCountries"
          :focus-country-code="focusCountryCode"
          @country-click="goToCountry"
        />
        <WorldMap
          v-else
          :countries="countries"
          :trending-countries="trendingCountries"
          @country-click="goToCountry"
        />
      </div>
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
