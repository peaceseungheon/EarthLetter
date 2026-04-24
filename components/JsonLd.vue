<script setup lang="ts">
// Renders a JSON-LD <script> tag using Nuxt's useHead. See architecture § 10.3.

interface Props {
  data: Record<string, unknown>
  id?: string
}
const props = defineProps<Props>()

useHead({
  script: [
    {
      type: 'application/ld+json',
      key: props.id ?? 'jsonld',
      innerHTML: JSON.stringify(props.data)
    }
  ]
})
</script>

<template>
  <span class="sr-only" aria-hidden="true" />
</template>
