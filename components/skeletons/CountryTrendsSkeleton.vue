<template>
  <div
    class="flex flex-col gap-4"
    role="status"
    aria-busy="true"
    aria-live="polite"
  >
    <span class="sr-only">Loading trends…</span>
    <!-- period toggle placeholder -->
    <div class="flex gap-2">
      <div
        v-for="i in 3"
        :key="i"
        class="h-9 w-16 animate-pulse rounded-full bg-surface-muted dark:bg-surface-dark-muted"
      />
    </div>
    <!-- chart area placeholder -->
    <div class="h-64 animate-pulse rounded-xl bg-surface-muted dark:bg-surface-dark-muted" />
  </div>
</template>
