<script setup lang="ts">
interface Props {
  ratio: number
}
const props = defineProps<Props>()
const label = computed(() => `+${Math.round(props.ratio)}%`)
</script>

<template>
  <span
    class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
    :aria-label="`Spike: ${label}`"
  >
    {{ label }}
  </span>
</template>
