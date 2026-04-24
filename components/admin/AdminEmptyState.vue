<script setup lang="ts">
// Shown inside <SourceTable> when the current filter selection yields
// zero rows. The reset action is purely advisory — the parent decides
// how to clear filters.

defineEmits<{ reset: [] }>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900"
    role="status"
  >
    <svg
      viewBox="0 0 24 24"
      class="size-8 text-slate-400"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>

    <h3 class="text-base font-semibold text-slate-800 dark:text-slate-100">
      No sources found
    </h3>
    <p class="max-w-md text-sm text-slate-500 dark:text-slate-400">
      No sources match the current filters. Try widening the selection or
      clear all filters to see every source.
    </p>

    <button
      type="button"
      class="inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
      @click="$emit('reset')"
    >
      Clear filters
    </button>
  </div>
</template>
