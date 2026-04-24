<script setup lang="ts">
import type { CountryDTO } from '~/types/dto'

interface Props {
  country: CountryDTO
  /** Optional sub-title — e.g. a topic label. */
  subtitle?: string
}
const props = defineProps<Props>()

// ISO-3166 alpha-2 → flag emoji via regional-indicator code points.
const flag = computed(() => {
  const code = props.country.code.toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) return ''
  const a = 0x1f1e6 // 🇦
  const [first, second] = code
  if (!first || !second) return ''
  return (
    String.fromCodePoint(a + (first.charCodeAt(0) - 65)) +
    String.fromCodePoint(a + (second.charCodeAt(0) - 65))
  )
})
</script>

<template>
  <header
    class="flex flex-wrap items-end gap-4 border-b border-black/5 pb-6 dark:border-white/10"
  >
    <span
      class="text-5xl leading-none"
      role="img"
      :aria-label="`${country.nameEn} flag`"
    >
      {{ flag }}
    </span>
    <div class="flex min-w-0 flex-col">
      <p
        v-if="country.nameKo"
        class="text-sm text-ink-muted dark:text-ink-dark-muted"
      >
        {{ country.nameKo }}
      </p>
      <h1 class="text-3xl font-semibold tracking-tight text-ink dark:text-ink-dark">
        {{ country.nameEn }}
      </h1>
      <p
        v-if="subtitle"
        class="mt-1 text-base text-ink-muted dark:text-ink-dark-muted"
      >
        {{ subtitle }}
      </p>
      <p class="mt-1 text-xs text-ink-muted dark:text-ink-dark-muted">
        {{ country.sourceCount }}
        {{ country.sourceCount === 1 ? 'source' : 'sources' }} tracked
      </p>
    </div>
  </header>
</template>
