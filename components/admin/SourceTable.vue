<script setup lang="ts">
// Admin source table. Stateless wrapper — parent passes the already-
// filtered list (store `filtered` getter) plus loading flag, this
// component just handles presentation + loading/empty states.
//
// Table is horizontally scrollable on narrow screens so we never clip
// the action column.

import type { AdminSourceDTO } from '~/types/dto'

interface Props {
  items: AdminSourceDTO[]
  loading?: boolean
}
const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<{
  toggle: [id: number, enabled: boolean]
  delete: [source: AdminSourceDTO]
  'edit-name': [source: AdminSourceDTO]
  'reset-filters': []
}>()

interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
}

const columns: readonly Column[] = [
  { key: 'name', label: 'Name' },
  { key: 'country', label: 'Country' },
  { key: 'topic', label: 'Topic' },
  { key: 'feedUrl', label: 'Feed URL' },
  { key: 'status', label: 'Status' },
  { key: 'fail', label: 'Fail' },
  { key: 'lastFailed', label: 'Last Failed' },
  { key: 'articles', label: 'Articles', align: 'right' },
  { key: 'actions', label: 'Actions', align: 'right' }
]
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
  >
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead class="bg-slate-50 dark:bg-slate-950">
          <tr>
            <th
              v-for="col in columns"
              :key="col.key"
              scope="col"
              :class="[
                'px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400',
                col.align === 'right' ? 'text-right' : 'text-left'
              ]"
            >
              {{ col.label }}
            </th>
          </tr>
        </thead>

        <tbody class="divide-y divide-slate-100 dark:divide-slate-800/70">
          <!-- Loading: skeleton rows -->
          <template v-if="props.loading && props.items.length === 0">
            <tr
              v-for="n in 6"
              :key="`skeleton-${n}`"
              class="animate-pulse bg-white dark:bg-slate-900"
              aria-hidden="true"
            >
              <td v-for="col in columns" :key="col.key" class="px-3 py-3">
                <div
                  class="h-3 rounded bg-slate-200 dark:bg-slate-800"
                  :class="col.key === 'feedUrl' ? 'w-40' : 'w-16'"
                />
              </td>
            </tr>
          </template>

          <!-- Empty -->
          <tr v-else-if="props.items.length === 0">
            <td :colspan="columns.length" class="px-3 py-6">
              <AdminEmptyState @reset="emit('reset-filters')" />
            </td>
          </tr>

          <!-- Rows -->
          <SourceRow
            v-for="source in props.items"
            v-else
            :key="source.id"
            :source="source"
            @toggle="(id: number, enabled: boolean) => emit('toggle', id, enabled)"
            @delete="(s: AdminSourceDTO) => emit('delete', s)"
            @edit-name="(s: AdminSourceDTO) => emit('edit-name', s)"
          />
        </tbody>
      </table>
    </div>
  </div>
</template>
