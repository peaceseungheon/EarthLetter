<template>
  <div
    class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <div
      v-for="n in 6"
      :key="n"
      class="animate-pulse rounded-lg border border-black/5 bg-surface-muted p-4 dark:border-white/10 dark:bg-surface-dark-muted"
    >
      <div class="mb-3 aspect-[16/9] w-full rounded bg-black/5 dark:bg-white/10" />
      <div class="h-4 w-1/3 rounded bg-black/5 dark:bg-white/10" />
      <div class="mt-2 h-5 w-3/4 rounded bg-black/5 dark:bg-white/10" />
      <div class="mt-2 h-3 w-full rounded bg-black/5 dark:bg-white/10" />
    </div>
    <span class="sr-only">Loading featured articles</span>
  </div>
</template>
