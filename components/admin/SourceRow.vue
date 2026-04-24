<script setup lang="ts">
// One row in the admin source table. Stateless — emits intents and lets
// the parent page orchestrate the store mutation. See architecture § 7.1
// for column order and § 7.2 for toggle semantics.

import { computed } from 'vue'
import type { AdminSourceDTO } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

interface Props {
  source: AdminSourceDTO
}
const props = defineProps<Props>()

const emit = defineEmits<{
  toggle: [id: number, enabled: boolean]
  delete: [source: AdminSourceDTO]
  'edit-name': [source: AdminSourceDTO]
}>()

const topicLabel = computed(
  () => TOPIC_META[props.source.topicSlug]?.labelEn ?? props.source.topicSlug
)

const truncatedUrl = computed(() => {
  const url = props.source.feedUrl
  return url.length > 40 ? `${url.slice(0, 37)}…` : url
})

const lastFailed = computed(() =>
  props.source.lastFailedAt
    ? useRelativeTime(props.source.lastFailedAt)
    : '—'
)

const isAutoDisabled = computed(() => props.source.disabledAt !== null)

const failBadgeClass = computed(() => {
  const n = props.source.failCount
  if (n <= 0) return ''
  if (n >= 3) {
    return 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
  }
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
})

function onToggle(e: Event) {
  const target = e.target as HTMLInputElement
  emit('toggle', props.source.id, target.checked)
}
</script>

<template>
  <tr
    :class="[
      'border-b border-slate-200 text-sm last:border-b-0 dark:border-slate-800',
      isAutoDisabled
        ? 'bg-rose-50/70 dark:bg-rose-950/20'
        : 'bg-white dark:bg-slate-900'
    ]"
  >
    <td class="px-3 py-2 font-medium text-slate-800 dark:text-slate-100">
      <div class="flex flex-col">
        <span class="truncate">{{ props.source.name }}</span>
        <span
          v-if="isAutoDisabled"
          class="text-xs font-normal text-rose-600 dark:text-rose-400"
        >
          Auto-disabled
        </span>
      </div>
    </td>

    <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
      {{ props.source.countryCode }}
    </td>

    <td class="px-3 py-2 text-slate-600 dark:text-slate-300">
      {{ topicLabel }}
    </td>

    <td class="px-3 py-2 text-slate-500 dark:text-slate-400">
      <a
        :href="props.source.feedUrl"
        :title="props.source.feedUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-mono text-xs hover:text-slate-800 hover:underline dark:hover:text-slate-100"
      >
        {{ truncatedUrl }}
      </a>
    </td>

    <td class="px-3 py-2">
      <label class="inline-flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          class="peer sr-only"
          :checked="props.source.enabled"
          :aria-label="`Toggle ${props.source.name}`"
          @change="onToggle"
        >
        <span
          class="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-emerald-500 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400 dark:bg-slate-700"
          aria-hidden="true"
        >
          <span
            class="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4"
          />
        </span>
        <span class="text-xs text-slate-600 dark:text-slate-300">
          {{ props.source.enabled ? 'On' : 'Off' }}
        </span>
      </label>
    </td>

    <td class="px-3 py-2">
      <span
        v-if="props.source.failCount > 0"
        :class="[
          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
          failBadgeClass
        ]"
      >
        {{ props.source.failCount }}
      </span>
      <span v-else class="text-xs text-slate-400 dark:text-slate-600">—</span>
    </td>

    <td class="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
      <time
        v-if="props.source.lastFailedAt"
        :datetime="props.source.lastFailedAt"
      >
        {{ lastFailed }}
      </time>
      <span v-else>—</span>
    </td>

    <td class="px-3 py-2 text-right font-mono text-xs text-slate-600 dark:text-slate-300">
      {{ props.source.articleCount }}
    </td>

    <td class="px-3 py-2">
      <div class="flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="emit('edit-name', props.source)"
        >
          Edit
        </button>
        <button
          type="button"
          class="rounded-md border border-rose-200 bg-rose-50 px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-900/40"
          @click="emit('delete', props.source)"
        >
          Delete
        </button>
      </div>
    </td>
  </tr>
</template>
