<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  page: number
  totalPages: number
  /** Page URL builder; receives 1-indexed page and returns a route-like string. */
  makeUrl: (page: number) => string
  /** Number of numeric page buttons (excluding ellipses). Default 5. */
  windowSize?: number
}
const props = withDefaults(defineProps<Props>(), { windowSize: 5 })

const hasPrev = computed(() => props.page > 1)
const hasNext = computed(() => props.page < props.totalPages)

const pages = computed<(number | 'ellipsis')[]>(() => {
  const { page, totalPages, windowSize } = props
  if (totalPages <= 1) return []
  const pagesList: (number | 'ellipsis')[] = []
  const half = Math.floor(windowSize / 2)
  let start = Math.max(1, page - half)
  const end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)

  if (start > 1) {
    pagesList.push(1)
    if (start > 2) pagesList.push('ellipsis')
  }
  for (let i = start; i <= end; i++) pagesList.push(i)
  if (end < totalPages) {
    if (end < totalPages - 1) pagesList.push('ellipsis')
    pagesList.push(totalPages)
  }
  return pagesList
})
</script>

<template>
  <nav
    v-if="totalPages > 1"
    class="flex flex-wrap items-center justify-center gap-1"
    aria-label="Pagination"
  >
    <NuxtLink
      v-if="hasPrev"
      :to="props.makeUrl(page - 1)"
      rel="prev"
      class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-black/10 px-3 text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/15 dark:hover:bg-surface-dark-muted"
    >
      Previous
    </NuxtLink>
    <span
      v-else
      aria-hidden="true"
      class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-black/5 px-3 text-sm text-ink-muted opacity-50 dark:border-white/5 dark:text-ink-dark-muted"
    >
      Previous
    </span>

    <template v-for="(p, i) in pages" :key="typeof p === 'number' ? `p-${p}` : `e-${i}`">
      <span
        v-if="p === 'ellipsis'"
        class="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm text-ink-muted dark:text-ink-dark-muted"
        aria-hidden="true"
      >
        …
      </span>
      <NuxtLink
        v-else-if="p !== page"
        :to="props.makeUrl(p)"
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-black/10 px-3 text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/15 dark:hover:bg-surface-dark-muted"
        :aria-label="`Go to page ${p}`"
      >
        {{ p }}
      </NuxtLink>
      <span
        v-else
        aria-current="page"
        class="inline-flex h-9 min-w-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-medium text-white"
      >
        {{ p }}
      </span>
    </template>

    <NuxtLink
      v-if="hasNext"
      :to="props.makeUrl(page + 1)"
      rel="next"
      class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-black/10 px-3 text-sm hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/15 dark:hover:bg-surface-dark-muted"
    >
      Next
    </NuxtLink>
    <span
      v-else
      aria-hidden="true"
      class="inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-black/5 px-3 text-sm text-ink-muted opacity-50 dark:border-white/5 dark:text-ink-dark-muted"
    >
      Next
    </span>
  </nav>
</template>
