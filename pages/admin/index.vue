<script setup lang="ts">
// /admin — source management dashboard.
//
// Flow (architecture § 7):
//   1. Probe /api/admin/sources. 200 → logged in; 401 → show token gate.
//   2. When logged in: filter bar + "Add source" + source table.
//   3. Create / rename / delete / toggle are handled via the Pinia store
//      (`stores/adminSources`); this page owns dialog visibility only.
//
// NOTE: SSR always renders the gate first because the cookie is HttpOnly
// and we cannot synchronously probe the server from within `setup()`
// without blocking hydration. The probe runs on mount.

import { computed, onMounted, ref } from 'vue'
import type {
  AdminSourceCreateDTO,
  AdminSourceDTO,
  TopicSlug
} from '~/types/dto'
import { TOPIC_META, TOPIC_SLUGS } from '~/types/domain'
import { useAdminSourcesStore } from '~/stores/adminSources'
import { useCountriesStore } from '~/stores/countries'

definePageMeta({ layout: 'admin' })

useSiteSeo({
  title: 'EarthLetter Admin',
  description: 'Internal source management — not indexed.',
  noIndex: true
})

// ---------- Auth state ----------

// `null` = still probing, `true` = authenticated, `false` = gate needed.
const authed = ref<boolean | null>(null)
const authProbing = ref(false)

async function probeAuth(): Promise<void> {
  authProbing.value = true
  try {
    const { isAuthenticated } = useAdminAuth()
    const ok = await isAuthenticated()
    authed.value = ok
    if (ok) {
      await init()
    }
  } finally {
    authProbing.value = false
  }
}

// ---------- Stores ----------

const sourcesStore = useAdminSourcesStore()
const countriesStore = useCountriesStore()

async function init(): Promise<void> {
  // Countries feed the form dialog + filter dropdown. Re-use the public
  // cache so we don't double-fetch.
  await countriesStore.fetchIfStale()
  await sourcesStore.fetch()
}

const items = computed(() => sourcesStore.filtered)
const loading = computed(() => sourcesStore.loading)
const errorMsg = computed(() => sourcesStore.error)
const countries = computed(() => countriesStore.items)

// ---------- Filters ----------

// Local bindings mirror the store filters. Committing to the store via a
// setter keeps the `filtered` getter consistent and triggers refetch.
const countryFilter = ref<string>('')
const topicFilter = ref<'' | TopicSlug>('')
const enabledFilter = ref<'all' | 'true' | 'false'>('all')
const disabledFilter = ref<'any' | 'auto' | 'manual'>('any')

async function applyFilters(): Promise<void> {
  sourcesStore.setFilters({
    country: countryFilter.value || undefined,
    topic: (topicFilter.value || undefined) as TopicSlug | undefined,
    enabled: enabledFilter.value,
    disabled: disabledFilter.value === 'any' ? undefined : disabledFilter.value
  })
  await sourcesStore.fetch()
}

function resetFilters(): void {
  countryFilter.value = ''
  topicFilter.value = ''
  enabledFilter.value = 'all'
  disabledFilter.value = 'any'
  void applyFilters()
}

// ---------- Create dialog ----------

const createOpen = ref(false)
const createPending = ref(false)
const createError = ref<string | null>(null)

function openCreate() {
  createError.value = null
  createOpen.value = true
}

function closeCreate() {
  if (createPending.value) return
  createOpen.value = false
  createError.value = null
}

async function onCreateSubmit(input: AdminSourceCreateDTO) {
  createPending.value = true
  createError.value = null
  try {
    await sourcesStore.create(input)
    createOpen.value = false
  } catch (e: unknown) {
    const status = (e as { statusCode?: number; status?: number })
      .statusCode ?? (e as { status?: number }).status
    if (status === 409) {
      createError.value = 'Feed URL already registered'
    } else {
      const msg = (e as { data?: { message?: string } }).data?.message
      createError.value = msg
        ?? (e instanceof Error ? e.message : 'Failed to create source')
    }
  } finally {
    createPending.value = false
  }
}

// ---------- Delete dialog ----------

const deleteTarget = ref<AdminSourceDTO | null>(null)
const deletePending = ref(false)
const toastMessage = ref<string | null>(null)

function openDelete(source: AdminSourceDTO) {
  deleteTarget.value = source
}

function closeDelete() {
  if (deletePending.value) return
  deleteTarget.value = null
}

async function onDeleteConfirm(source: AdminSourceDTO) {
  deletePending.value = true
  try {
    const res = await sourcesStore.remove(source.id)
    deleteTarget.value = null
    toastMessage.value
      = res.deletedArticles > 0
        ? `Deleted ${source.name} and ${res.deletedArticles} archived articles.`
        : `Deleted ${source.name}.`
    setTimeout(() => {
      toastMessage.value = null
    }, 4000)
  } catch {
    // Store already captured `error`; leave dialog open so user can retry.
  } finally {
    deletePending.value = false
  }
}

// ---------- Toggle ----------

async function onToggle(id: number, enabled: boolean) {
  try {
    await sourcesStore.toggle(id, enabled)
  } catch {
    // Rollback + error already handled in the store.
  }
}

// ---------- Rename (reuses prompt; inline form out of scope for MVP) ----------

async function onEditName(source: AdminSourceDTO) {
  if (!import.meta.client) return
  const next = window.prompt('New source name', source.name)
  if (next === null) return
  const trimmed = next.trim()
  if (!trimmed || trimmed === source.name) return
  try {
    await sourcesStore.updateName(source.id, trimmed)
  } catch {
    // Store surfaces error.
  }
}

// ---------- Lifecycle ----------

onMounted(() => {
  void probeAuth()
})
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
    <!-- Probing: neutral spinner so we don't flash the gate -->
    <div
      v-if="authed === null"
      class="flex items-center justify-center py-16"
      aria-busy="true"
    >
      <svg
        class="size-8 animate-spin text-slate-400"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" opacity="0.25" />
        <path d="M21 12a9 9 0 0 1-9 9" />
      </svg>
      <span class="ml-3 text-sm text-slate-500 dark:text-slate-400">
        Checking session…
      </span>
    </div>

    <!-- Gate -->
    <AdminTokenGate
      v-else-if="authed === false"
      @authenticated="() => { authed = true; void init() }"
    />

    <!-- Dashboard -->
    <template v-else>
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          Sources
        </h1>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Manage RSS sources. Toggle a source off to stop ingesting, or
          delete it to also remove archived articles.
        </p>
      </header>

      <section
        class="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
        aria-label="Filters"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-200">
              Country
            </span>
            <select
              v-model="countryFilter"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              @change="applyFilters"
            >
              <option value="">All countries</option>
              <option
                v-for="c in countries"
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
              v-model="topicFilter"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              @change="applyFilters"
            >
              <option value="">All topics</option>
              <option
                v-for="slug in TOPIC_SLUGS"
                :key="slug"
                :value="slug"
              >
                {{ TOPIC_META[slug].labelEn }}
              </option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-200">
              Enabled
            </span>
            <select
              v-model="enabledFilter"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              @change="applyFilters"
            >
              <option value="all">All</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </label>

          <label class="flex flex-col gap-1 text-sm">
            <span class="font-medium text-slate-700 dark:text-slate-200">
              Disabled type
            </span>
            <select
              v-model="disabledFilter"
              class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50"
              @change="applyFilters"
            >
              <option value="any">Any</option>
              <option value="auto">Auto-disabled</option>
              <option value="manual">Manually disabled</option>
            </select>
          </label>
        </div>

        <div class="flex items-center justify-between">
          <button
            type="button"
            class="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
            @click="resetFilters"
          >
            Reset filters
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
            @click="openCreate"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-4"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add source
          </button>
        </div>
      </section>

      <p
        v-if="errorMsg"
        class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        role="alert"
      >
        {{ errorMsg }}
      </p>

      <p
        v-if="toastMessage"
        class="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
        role="status"
      >
        {{ toastMessage }}
      </p>

      <SourceTable
        :items="items"
        :loading="loading"
        @toggle="onToggle"
        @delete="openDelete"
        @edit-name="onEditName"
        @reset-filters="resetFilters"
      />

      <SourceFormDialog
        :open="createOpen"
        :countries="countries"
        :pending="createPending"
        :server-error="createError"
        @close="closeCreate"
        @submit="onCreateSubmit"
      />

      <ConfirmDeleteDialog
        :open="deleteTarget !== null"
        :source="deleteTarget"
        :pending="deletePending"
        @confirm="onDeleteConfirm"
        @cancel="closeDelete"
      />
    </template>
  </div>
</template>
