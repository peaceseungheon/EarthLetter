<script setup lang="ts">
// Create-source form dialog. Scoped to creation only — per architecture
// § 3 the countryCode / topicSlug / feedUrl fields are intentionally not
// patchable; an existing source can only be renamed, otherwise the
// operator deletes + recreates.
//
// The dialog validates the feed URL on the fly via `new URL()` and
// surfaces 409 responses as an inline "already registered" error so the
// operator does not have to inspect network tools.

import { computed, ref, watch } from 'vue'
import type {
  AdminSourceCreateDTO,
  CountryDTO,
  TopicSlug
} from '~/types/dto'
import { TOPIC_META, TOPIC_SLUGS } from '~/types/domain'

interface Props {
  open: boolean
  countries: CountryDTO[]
  /** Parent can show a spinner while the POST is in flight. */
  pending?: boolean
  /** Parent-supplied error (e.g. 409 from the server) — inline display. */
  serverError?: string | null
}
const props = withDefaults(defineProps<Props>(), {
  pending: false,
  serverError: null
})

const emit = defineEmits<{
  close: []
  submit: [input: AdminSourceCreateDTO]
}>()

const dialogRef = ref<HTMLDialogElement | null>(null)

const name = ref('')
const countryCode = ref('')
const topicSlug = ref<TopicSlug>('military')
const feedUrl = ref('')
const urlTouched = ref(false)

const sortedCountries = computed(() =>
  [...props.countries].sort((a, b) => a.nameEn.localeCompare(b.nameEn))
)

const urlValid = computed(() => {
  if (!feedUrl.value) return false
  try {
    const parsed = new URL(feedUrl.value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
})

const urlError = computed(() => {
  if (!urlTouched.value) return null
  if (!feedUrl.value) return 'Feed URL is required.'
  if (!urlValid.value) return 'Enter a valid http(s) URL.'
  return null
})

const nameError = computed(() => {
  const trimmed = name.value.trim()
  if (!trimmed) return null
  if (trimmed.length > 120) return 'Name must be 120 characters or fewer.'
  return null
})

const canSubmit = computed(
  () =>
    !props.pending
    && name.value.trim().length > 0
    && name.value.trim().length <= 120
    && countryCode.value.length === 2
    && TOPIC_SLUGS.includes(topicSlug.value)
    && urlValid.value
)

function resetForm() {
  name.value = ''
  countryCode.value = ''
  topicSlug.value = 'military'
  feedUrl.value = ''
  urlTouched.value = false
}

watch(
  () => props.open,
  (next) => {
    const el = dialogRef.value
    if (!el) return
    if (next) {
      if (!el.open) el.showModal()
    } else {
      if (el.open) el.close()
      resetForm()
    }
  }
)

function onCancel() {
  if (props.pending) return
  emit('close')
}

function onSubmit() {
  urlTouched.value = true
  if (!canSubmit.value) return
  emit('submit', {
    name: name.value.trim(),
    countryCode: countryCode.value.toUpperCase(),
    topicSlug: topicSlug.value,
    feedUrl: feedUrl.value.trim()
  })
}
</script>

<template>
  <dialog
    ref="dialogRef"
    class="rounded-lg border border-slate-200 bg-white p-0 shadow-xl backdrop:bg-slate-950/50 dark:border-slate-700 dark:bg-slate-900"
    @cancel.prevent="onCancel"
    @close="onCancel"
  >
    <form
      class="flex w-[min(92vw,32rem)] flex-col gap-4 p-6"
      @submit.prevent="onSubmit"
    >
      <header class="flex flex-col gap-1">
        <h2 class="text-base font-semibold text-slate-900 dark:text-slate-50">
          Add source
        </h2>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Create a new RSS source. Country, topic, and feed URL cannot be
          edited later — delete and recreate if they change.
        </p>
      </header>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700 dark:text-slate-200">
          Name
        </span>
        <input
          v-model="name"
          type="text"
          required
          maxlength="120"
          placeholder="e.g. Reuters World"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
        >
        <span
          v-if="nameError"
          class="text-xs text-rose-600 dark:text-rose-400"
        >
          {{ nameError }}
        </span>
      </label>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Country
          </span>
          <select
            v-model="countryCode"
            required
            class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option value="" disabled>Select a country…</option>
            <option
              v-for="c in sortedCountries"
              :key="c.code"
              :value="c.code"
            >
              {{ c.nameEn }} ({{ c.code }})
            </option>
          </select>
        </label>

        <label class="flex flex-col gap-1 text-sm">
          <span class="font-medium text-slate-700 dark:text-slate-200">
            Topic
          </span>
          <select
            v-model="topicSlug"
            required
            class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
          >
            <option
              v-for="slug in TOPIC_SLUGS"
              :key="slug"
              :value="slug"
            >
              {{ TOPIC_META[slug].labelEn }}
            </option>
          </select>
        </label>
      </div>

      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700 dark:text-slate-200">
          Feed URL
        </span>
        <input
          v-model="feedUrl"
          type="url"
          required
          placeholder="https://example.com/feed.xml"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
          @blur="urlTouched = true"
        >
        <span
          v-if="urlError"
          class="text-xs text-rose-600 dark:text-rose-400"
        >
          {{ urlError }}
        </span>
      </label>

      <p
        v-if="props.serverError"
        class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        role="alert"
      >
        {{ props.serverError }}
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
          type="submit"
          :disabled="!canSubmit"
          class="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
        >
          {{ props.pending ? 'Creating…' : 'Create source' }}
        </button>
      </footer>
    </form>
  </dialog>
</template>
