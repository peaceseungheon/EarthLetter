<script setup lang="ts">
// 2D/3D map mode toggle (architecture § 6.6). Presentational — the pages own
// the mode via useMapMode() and persist it to localStorage there.

import type { MapMode } from '~/composables/useMapMode'

interface Props {
  mode: MapMode
}
defineProps<Props>()

const emit = defineEmits<{
  'update:mode': [mode: MapMode]
}>()
</script>

<template>
  <div
    class="inline-flex overflow-hidden rounded-md border border-black/10 bg-surface text-xs font-semibold shadow-sm dark:border-white/10 dark:bg-surface-dark-muted"
    role="group"
    aria-label="Map display mode"
  >
    <button
      type="button"
      :aria-pressed="mode === 'globe'"
      :class="[
        'px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        mode === 'globe'
          ? 'bg-accent text-white'
          : 'text-ink-muted hover:bg-black/5 dark:text-ink-dark-muted dark:hover:bg-white/10',
      ]"
      @click="emit('update:mode', 'globe')"
    >
      3D
    </button>
    <button
      type="button"
      :aria-pressed="mode === 'flat'"
      :class="[
        'px-2.5 py-1.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        mode === 'flat'
          ? 'bg-accent text-white'
          : 'text-ink-muted hover:bg-black/5 dark:text-ink-dark-muted dark:hover:bg-white/10',
      ]"
      @click="emit('update:mode', 'flat')"
    >
      2D
    </button>
  </div>
</template>
