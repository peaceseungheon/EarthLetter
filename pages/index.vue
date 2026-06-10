<script setup lang="ts">
// Home page: world map + featured strip across countries.

import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useCountriesStore } from '~/stores/countries'

useSiteSeo({
  title: 'EarthLetter — World news by country',
  description:
    'Click a country on the world map to read curated English-language news on military, economy, and politics.',
  ogType: 'website'
})

const router = useRouter()
const countriesStore = useCountriesStore()

// 2D/3D map mode — SSR always renders the globe; localStorage preference is
// applied after mount (architecture § 6.6).
const { mode: mapMode, setMode: setMapMode } = useMapMode()

// Start the featured fetch before awaiting countries: non-lazy useFetch
// fires immediately, so both requests run in parallel during SSR
// (architecture P1-F3).
const { data: homeData, pending: featuredPending } = useHomeFeatured()

// SSR: populate the store so WorldMap has data on first paint.
await useAsyncData('countries-hydrate', async () => {
  await countriesStore.fetchIfStale()
  return true
})

const countries = computed(() => countriesStore.items)
const featured = computed(() => homeData.value?.featured ?? [])
const showSkeleton = computed(() => featuredPending.value && featured.value.length === 0)

function goToCountry(payload: { code: string }) {
  router.push(`/country/${payload.code}`)
}

onMounted(() => {
  // Refresh on client if stale (no-op when fresh from SSR).
  void countriesStore.fetchIfStale()
})
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8">
    <section class="flex flex-col gap-3">
      <h1 class="text-3xl font-bold tracking-tight text-ink dark:text-ink-dark">
        World news by country
      </h1>
      <p class="max-w-2xl text-ink-muted dark:text-ink-dark-muted">
        Click a country on the map to read today's headlines on military,
        economy, and politics. Sources are curated English-language outlets,
        refreshed hourly.
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
          @country-click="goToCountry"
        />
        <WorldMap
          v-else
          :countries="countries"
          @country-click="goToCountry"
        />
      </div>
      <AvailableCountriesStrip
        :countries="countries"
        @select="(code) => goToCountry({ code })"
      />
      <CountrySelector
        :countries="countries"
        label="Or search by name"
        @select="(code) => goToCountry({ code })"
      />
    </section>

    <section class="flex flex-col gap-4">
      <TrendingWidget />
    </section>

    <section v-if="featured.length > 0 || showSkeleton" class="flex flex-col gap-4">
      <h2 class="text-xl font-semibold text-ink dark:text-ink-dark">
        Latest across the world
      </h2>
      <HomeFeaturedSkeleton v-if="showSkeleton" />
      <ArticleList v-else :articles="featured" :ad-every-n="0" />
    </section>
  </div>
</template>
