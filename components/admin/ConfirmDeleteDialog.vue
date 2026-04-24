<script setup lang="ts">
// Delete confirmation dialog. Shows a stronger warning when the source
// has archived articles (which will be hard-deleted by the cascade).
// See architecture § 7.3.
//
// Implementation note: we use the native <dialog> element for zero
// additional dependencies; the parent controls visibility via `open`.

import { computed, ref, watch } from 'vue'
import type { AdminSourceDTO } from '~/types/dto'

interface Props {
  open: boolean
  source: AdminSourceDTO | null
  /** Parent can show a spinner while the DELETE request is in flight. */
  pending?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  pending: false
})

const emit = defineEmits<{
  confirm: [source: AdminSourceDTO]
  cancel: []
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

const hasArticles = computed(
  () => (props.source?.articleCount ?? 0) > 0
)

watch(
  () => props.open,
  (next) => {
    const el = dialogRef.value
    if (!el) return
    if (next && !el.open) {
      el.showModal()
    } else if (!next && el.open) {
      el.close()
    }
  }
)

function onCancel() {
  if (props.pending) return
  emit('cancel')
}

function onConfirm() {
  if (props.pending || !props.source) return
  emit('confirm', props.source)
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900"
    @cancel.prevent="onCancel"
    @close="onCancel"
  >
    <div v-if="props.source" class="flex w-[min(92vw,28rem)] flex-col gap-4 p-6">
      <header class="flex flex-col gap-1">
        <h2 class="text-base font-semibold text-slate-900 dark:text-slate-50">
          Delete source?
        </h2>
        <p class="text-sm text-slate-600 dark:text-slate-300">
          You are about to delete <strong>{{ props.source.name }}</strong> ({{ props.source.countryCode }} · {{ props.source.topicSlug }}).
        </p>
      </header>

      <p
        v-if="hasArticles"
        class="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200"
      >
        This will also delete <strong>{{ props.source.articleCount }}</strong>
        archived articles. This cannot be undone.
      </p>
      <p
        v-else
        class="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
      >
        No archived articles are linked to this source.
      </p>

      <footer class="flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
          :disabled="props.pending"
          @click="onCancel"
        >
          Cancel
        </button>
        <button
          type="button"
          class="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="props.pending"
          @click="onConfirm"
        >
          {{ props.pending ? 'Deleting…' : 'Delete' }}
        </button>
      </footer>
    </div>
  </dialog>
</template>
