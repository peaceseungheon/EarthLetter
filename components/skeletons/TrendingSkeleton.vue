<script setup lang="ts">
interface Props {
  rows?: number
}
withDefaults(defineProps<Props>(), { rows: 5 })
</script>

<template>
  <div
    role="status"
    aria-busy="true"
    aria-live="polite"
    class="flex flex-col divide-y divide-black/5 overflow-hidden rounded-lg border border-black/5 dark:divide-white/10 dark:border-white/10"
  >
    <div
      v-for="n in rows"
      :key="n"
      class="flex animate-pulse items-center gap-3 px-4 py-3"
    >
      <div class="size-7 shrink-0 rounded-full bg-black/5 dark:bg-white/10" />
      <div class="flex-1 space-y-1.5">
        <div class="h-3.5 w-1/3 rounded bg-black/5 dark:bg-white/10" />
        <div class="h-3 w-1/4 rounded bg-black/5 dark:bg-white/10" />
      </div>
      <div class="h-5 w-14 rounded-full bg-black/5 dark:bg-white/10" />
    </div>
    <span class="sr-only">Loading trending data</span>
  </div>
</template>
