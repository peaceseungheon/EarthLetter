<template>
  <div
    class="flex flex-col gap-10"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <section v-for="n in 3" :key="n" class="flex flex-col gap-4">
      <div class="flex items-end justify-between">
        <div class="flex flex-col gap-2">
          <div class="h-6 w-32 animate-pulse rounded bg-black/5 dark:bg-white/10" />
          <div class="h-3 w-56 animate-pulse rounded bg-black/5 dark:bg-white/10" />
        </div>
        <div class="h-4 w-16 animate-pulse rounded bg-black/5 dark:bg-white/10" />
      </div>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="m in 3"
          :key="m"
          class="animate-pulse rounded-lg border border-black/5 bg-surface-muted p-4 dark:border-white/10 dark:bg-surface-dark-muted"
        >
          <div class="mb-3 aspect-[16/9] w-full rounded bg-black/5 dark:bg-white/10" />
          <div class="h-4 w-1/3 rounded bg-black/5 dark:bg-white/10" />
          <div class="mt-2 h-5 w-3/4 rounded bg-black/5 dark:bg-white/10" />
        </div>
      </div>
    </section>
    <span class="sr-only">Loading country overview</span>
  </div>
</template>
