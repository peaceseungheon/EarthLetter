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
  <!-- ColorScheme injects the @nuxt/color-mode class onto <html> to avoid FOUC. -->
  <ColorScheme placeholder="...">
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </ColorScheme>
</template>
