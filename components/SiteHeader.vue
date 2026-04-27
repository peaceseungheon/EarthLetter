<script setup lang="ts">
// Simple brand bar; dark-mode toggle lives in <ThemeToggle>.
</script>

<template>
  <header
    class="sticky top-0 z-30 border-b border-black/5 bg-surface/80 backdrop-blur dark:border-white/10 dark:bg-surface-dark/80"
  >
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <NuxtLink
        to="/"
        class="inline-flex items-center gap-2 font-semibold tracking-tight text-lg text-ink dark:text-ink-dark"
      >
        <svg
          viewBox="0 0 24 24"
          class="size-6 text-accent"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
        </svg>
        EarthLetter
      </NuxtLink>

      <nav class="flex items-center gap-4 text-sm">
        <NuxtLink
          to="/"
          class="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
        >
          Map
        </NuxtLink>
        <NuxtLink
          to="/trending"
          class="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
        >
          Trending
        </NuxtLink>
        <NuxtLink
          to="/about"
          class="text-ink-muted hover:text-ink dark:text-ink-dark-muted dark:hover:text-ink-dark"
        >
          About
        </NuxtLink>
        <ThemeToggle />
      </nav>
    </div>
  </header>
</template>
