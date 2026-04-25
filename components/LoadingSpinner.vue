<script setup lang="ts">
const props = withDefaults(defineProps<{
  size?: 'sm' | 'md' | 'lg'
  label?: string
  inline?: boolean
}>(), {
  size: 'md',
  label: undefined,
  inline: false
})

const sizeConfig = computed(() => ({
  sm: { px: 16, stroke: 2 },
  md: { px: 24, stroke: 2 },
  lg: { px: 40, stroke: 3 }
}[props.size]))
</script>

<template>
  <div
    :class="[inline ? 'inline-flex' : 'flex', 'items-center gap-2']"
    role="status"
    aria-live="polite"
  >
    <svg
      class="animate-spin text-accent"
      :width="sizeConfig.px"
      :height="sizeConfig.px"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle
        cx="12" cy="12" r="10"
        stroke="currentColor"
        :stroke-width="sizeConfig.stroke"
        stroke-opacity="0.2"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        :stroke-width="sizeConfig.stroke"
        stroke-linecap="round"
      />
    </svg>
    <span v-if="label" class="text-sm text-ink-muted dark:text-ink-dark-muted">
      {{ label }}
    </span>
    <span v-else class="sr-only">Loading</span>
  </div>
</template>
