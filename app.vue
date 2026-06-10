<script setup lang="ts">
// Root component — keep minimal. Page-specific meta lives in each page
// via useSeoMeta(). See architecture § 10 (SEO) and § 8 (map renders inside
// pages/index.vue, not here).

useSeoMeta({
  titleTemplate: (title) =>
    title ? `${title} — EarthLetter` : 'EarthLetter — World news by country',
  description:
    'Click a country on the world map to read curated English-language news on military, economy, and politics.',
  ogType: 'website',
  ogSiteName: 'EarthLetter',
  ogImage: '/og-default.png',
  twitterCard: 'summary_large_image'
})
</script>

<template>
  <!-- FOUC is prevented by @nuxtjs/color-mode's inlined <html> class script.
       Do NOT wrap the app in <ColorScheme> — with preference 'system' the mode
       is unknown on the server, so ColorScheme SSRs only its placeholder and
       every page ships as an empty shell (no SEO, no SSR'd articles). -->
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
