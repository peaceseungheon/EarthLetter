<script setup lang="ts">
const year = new Date().getFullYear()
</script>

<template>
  <footer class="border-t border-black/5 dark:border-white/10">
    <div
      class="mx-auto flex max-w-6xl flex-wrap items-center gap-4 px-4 py-6 text-sm text-ink-muted dark:text-ink-dark-muted"
    >
      <span>&copy; {{ year }} EarthLetter</span>
      <nav class="flex gap-4">
        <NuxtLink to="/about" class="hover:text-ink dark:hover:text-ink-dark">
          About
        </NuxtLink>
        <NuxtLink to="/privacy" class="hover:text-ink dark:hover:text-ink-dark">
          Privacy
        </NuxtLink>
        <NuxtLink to="/terms" class="hover:text-ink dark:hover:text-ink-dark">
          Terms
        </NuxtLink>
      </nav>
      <span class="ml-auto text-xs">
        News aggregated from public RSS feeds. Follow each link for original
        reporting.
      </span>
    </div>
  </footer>
</template>
