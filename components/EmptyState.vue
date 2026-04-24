<script setup lang="ts">
interface Props {
  title?: string
  message?: string
  icon?: 'inbox' | 'globe' | 'error'
}
withDefaults(defineProps<Props>(), {
  title: 'Nothing here yet',
  message: 'Check back soon — our feeds update hourly.',
  icon: 'inbox'
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-black/10 bg-surface-muted p-8 text-center dark:border-white/15 dark:bg-surface-dark-muted"
    role="status"
  >
    <svg
      v-if="icon === 'inbox'"
      class="size-10 text-ink-muted dark:text-ink-dark-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <path d="M3 12h6l2 3h2l2-3h6" />
      <path d="M5 5h14l2 9v5H3v-5l2-9Z" />
    </svg>
    <svg
      v-else-if="icon === 'globe'"
      class="size-10 text-ink-muted dark:text-ink-dark-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </svg>
    <svg
      v-else
      class="size-10 text-ink-muted dark:text-ink-dark-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v6M12 16v.5" />
    </svg>

    <h3 class="text-base font-semibold text-ink dark:text-ink-dark">
      {{ title }}
    </h3>
    <p class="max-w-md text-sm text-ink-muted dark:text-ink-dark-muted">
      {{ message }}
    </p>
    <slot />
  </div>
</template>
