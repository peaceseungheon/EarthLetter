<script setup lang="ts">
// Single-field token prompt. The submitted value is POSTed as plain JSON
// to /api/admin/session; on 200 the server sets an HttpOnly cookie and we
// reload the app so hydration picks up the authenticated state.
//
// NOTE: This component is intentionally CSR-only — the SSR pass has no
// cookie context that JS can read, so the gate always renders first and
// is replaced by the dashboard on the client. See architecture § 7.4.

import { reloadNuxtApp } from '#app'

const emit = defineEmits<{ authenticated: [] }>()

const token = ref('')
const submitting = ref(false)
const errorMessage = ref<string | null>(null)

async function onSubmit() {
  if (submitting.value) return
  const trimmed = token.value.trim()
  if (!trimmed) {
    errorMessage.value = 'Please enter your admin token.'
    return
  }
  submitting.value = true
  errorMessage.value = null

  const { login } = useAdminAuth()
  const ok = await login(trimmed)

  submitting.value = false

  if (!ok) {
    errorMessage.value = 'Invalid token'
    return
  }

  emit('authenticated')
  // Reload so the SSR pass (now with the cookie attached) can render the
  // dashboard without relying on client-only state.
  reloadNuxtApp({ force: true })
}
</script>

<template>
  <section
    class="mx-auto mt-16 flex w-full max-w-sm flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    aria-labelledby="admin-gate-title"
  >
    <header class="flex flex-col gap-1">
      <h1
        id="admin-gate-title"
        class="text-lg font-semibold text-slate-900 dark:text-slate-50"
      >
        Admin access
      </h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Enter the admin token to manage sources.
      </p>
    </header>

    <form class="flex flex-col gap-3" @submit.prevent="onSubmit">
      <label class="flex flex-col gap-1 text-sm">
        <span class="font-medium text-slate-700 dark:text-slate-200">
          Token
        </span>
        <input
          v-model="token"
          type="password"
          autocomplete="current-password"
          :disabled="submitting"
          class="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-50 dark:placeholder:text-slate-500"
          placeholder="••••••••"
          required
        >
      </label>

      <p
        v-if="errorMessage"
        class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
        role="alert"
      >
        {{ errorMessage }}
      </p>

      <button
        type="submit"
        :disabled="submitting"
        class="inline-flex items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-200"
      >
        {{ submitting ? 'Signing in…' : 'Login' }}
      </button>
    </form>
  </section>
</template>
