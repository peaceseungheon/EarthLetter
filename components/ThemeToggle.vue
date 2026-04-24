<script setup lang="ts">
// Cycles @nuxt/color-mode preference: system -> light -> dark -> system.
// Icon is rendered from inline SVG to avoid an extra dependency.

const colorMode = useColorMode()

const labels: Record<string, string> = {
  system: 'System theme',
  light: 'Light theme',
  dark: 'Dark theme'
}

function cycle() {
  const order = ['system', 'light', 'dark'] as const
  const idx = order.indexOf(colorMode.preference as (typeof order)[number])
  const next = order[(idx + 1) % order.length] ?? 'system'
  colorMode.preference = next
}
</script>

<template>
  <button
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-black/10 text-ink hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/15 dark:text-ink-dark dark:hover:bg-surface-dark-muted"
    :aria-label="labels[colorMode.preference] ?? 'Theme toggle'"
    :title="labels[colorMode.preference] ?? 'Theme toggle'"
    @click="cycle"
  >
    <ClientOnly>
      <svg
        v-if="colorMode.value === 'dark'"
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
      </svg>
      <svg
        v-else
        class="size-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="4" />
        <path
          d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        />
      </svg>
      <template #fallback>
        <span class="size-5" />
      </template>
    </ClientOnly>
  </button>
</template>
