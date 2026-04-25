<script setup lang="ts">
import { computed } from 'vue'
import type { CountryDTO } from '~/types/dto'

const props = defineProps<{ countries: CountryDTO[] }>()
const emit = defineEmits<{ select: [code: string] }>()

// Regional Indicator Symbols: 🇦 = U+1F1E6 = 65 ('A')
function flagEmoji(code: string): string {
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('')
}

const available = computed(() =>
  props.countries
    .filter((c) => c.hasSources)
    .sort((a, b) => a.nameEn.localeCompare(b.nameEn))
)
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between">
      <p class="text-sm text-ink-muted dark:text-ink-dark-muted">
        <span class="font-semibold text-ink dark:text-ink-dark">
          {{ available.length }}
        </span>
        countries with live news — pick one to start reading
      </p>
      <span
        class="hidden text-xs text-ink-muted dark:text-ink-dark-muted sm:block"
        aria-hidden="true"
      >
        scroll →
      </span>
    </div>

    <div
      class="flex gap-2 overflow-x-auto pb-1"
      role="list"
      aria-label="Countries with available news"
      style="scrollbar-width: none"
    >
      <button
        v-for="c in available"
        :key="c.code"
        role="listitem"
        class="group flex flex-shrink-0 items-center gap-1.5 rounded-full border border-black/10 bg-surface px-3 py-1.5 text-sm font-medium text-ink transition-all hover:border-accent hover:bg-accent hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent dark:border-white/10 dark:bg-surface-dark dark:text-ink-dark dark:hover:border-accent dark:hover:bg-accent dark:hover:text-white"
        :aria-label="`Go to ${c.nameEn} news`"
        @click="emit('select', c.code)"
      >
        <span aria-hidden="true">{{ flagEmoji(c.code) }}</span>
        <span>{{ c.nameEn }}</span>
        <span
          v-if="c.sourceCount > 0"
          class="ml-0.5 rounded-full bg-black/8 px-1.5 py-0.5 text-xs font-normal tabular-nums text-ink-muted transition-colors group-hover:bg-white/20 group-hover:text-white dark:bg-white/10 dark:text-ink-dark-muted dark:group-hover:bg-white/20 dark:group-hover:text-white"
          :aria-label="`${c.sourceCount} sources`"
        >
          {{ c.sourceCount }}
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped>
div::-webkit-scrollbar {
  display: none;
}
</style>
