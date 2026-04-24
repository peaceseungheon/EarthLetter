<script setup lang="ts">
// See architecture § 9. Renders either a placeholder (reserves layout) or an
// AdSense <ins> tag based on runtimeConfig.public.adsenseClient.

import { onMounted } from 'vue'

interface Props {
  slotId: string
  format?: 'auto' | 'rectangle' | 'vertical' | 'horizontal'
  responsive?: boolean
  layoutKey?: string
  minHeightPx?: number
  label?: string
}
const props = withDefaults(defineProps<Props>(), {
  format: 'auto',
  responsive: true,
  layoutKey: undefined,
  minHeightPx: 90,
  label: 'Advertisement'
})

const { client, enabled } = useAdsenseConfig()

onMounted(() => {
  if (!enabled) return
  try {
    // AdSense script attaches `adsbygoogle` to window.
    type AdsByGoogleWindow = Window & {
      adsbygoogle?: Array<Record<string, unknown>>
    }
    const w = window as AdsByGoogleWindow
    w.adsbygoogle = w.adsbygoogle || []
    w.adsbygoogle.push({})
  } catch {
    // Ignore — ad script may not be loaded yet; ins tag is idempotent.
  }
})
</script>

<template>
  <ins
    v-if="enabled"
    class="adsbygoogle block"
    :style="{ display: 'block', minHeight: props.minHeightPx + 'px' }"
    :data-ad-client="client"
    :data-ad-slot="props.slotId"
    :data-ad-format="props.format"
    :data-ad-layout-key="props.layoutKey || undefined"
    :data-full-width-responsive="props.responsive ? 'true' : 'false'"
    :aria-label="props.label"
  />
  <div
    v-else
    class="ad-placeholder flex items-center justify-center rounded-md border border-dashed border-black/10 bg-surface-muted text-xs text-ink-muted dark:border-white/10 dark:bg-surface-dark-muted dark:text-ink-dark-muted"
    :style="{ minHeight: props.minHeightPx + 'px' }"
    aria-hidden="true"
  >
    <span>Ad space</span>
  </div>
</template>
