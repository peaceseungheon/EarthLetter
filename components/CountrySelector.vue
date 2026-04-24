<script setup lang="ts">
// Accessible country picker. Complements <WorldMap> for (a) screen readers,
// (b) small map targets, (c) keyboard-only users who prefer typing.

import { computed, ref } from 'vue'
import type { CountryDTO } from '~/types/dto'

interface Props {
  countries: CountryDTO[]
  /** Only include countries with feeds (default true). */
  clickableOnly?: boolean
  /** Visible label above the control. */
  label?: string
}
const props = withDefaults(defineProps<Props>(), {
  clickableOnly: true,
  label: 'Or search for a country'
})

const emit = defineEmits<{ select: [code: string] }>()

const query = ref('')

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  const base = props.clickableOnly
    ? props.countries.filter((c) => c.hasSources)
    : props.countries
  if (!q) return base.slice().sort((a, b) => a.nameEn.localeCompare(b.nameEn))
  return base
    .filter(
      (c) =>
        c.nameEn.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q)
    )
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
})

function onChange(e: Event) {
  const code = (e.target as HTMLSelectElement).value
  if (code) emit('select', code)
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <label
      for="country-selector"
      class="text-sm font-medium text-ink dark:text-ink-dark"
    >
      {{ props.label }}
    </label>

    <div class="flex flex-col gap-2 sm:flex-row">
      <input
        v-model="query"
        type="search"
        placeholder="Filter by name…"
        aria-label="Filter countries"
        class="flex-1 rounded-md border border-black/10 bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-surface-dark dark:text-ink-dark dark:placeholder:text-ink-dark-muted"
      >

      <select
        id="country-selector"
        class="rounded-md border border-black/10 bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-surface-dark dark:text-ink-dark"
        @change="onChange"
      >
        <option value="">Select a country…</option>
        <option
          v-for="c in filtered"
          :key="c.code"
          :value="c.code"
        >
          {{ c.nameEn }}{{ c.sourceCount > 0 ? ` (${c.sourceCount})` : '' }}
        </option>
      </select>
    </div>

    <p
      v-if="filtered.length === 0"
      class="text-xs text-ink-muted dark:text-ink-dark-muted"
    >
      No countries match "{{ query }}".
    </p>
  </div>
</template>
