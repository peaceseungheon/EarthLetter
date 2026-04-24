<script setup lang="ts">
// Admin-only app shell. Intentionally visually distinct from the public
// layout (slate/neutral) so the operator always knows they are in a
// privileged surface. See architecture § 7.1.
//
// The route-level `X-Robots-Tag` header is already set by `routeRules`
// (see nuxt.config.ts). We also emit a `<meta name="robots">` tag here as
// a belt-and-braces guard for any edge that misses the header.

import { navigateTo } from '#app'

useHead({
  meta: [{ name: 'robots', content: 'noindex,nofollow' }]
})

const { logout } = useAdminAuth()
const signingOut = ref(false)

async function onLogout() {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await logout()
  } finally {
    signingOut.value = false
    await navigateTo('/admin')
  }
}
</script>

<template>
  <div class="flex min-h-dvh flex-col bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <header
      class="sticky top-0 z-30 border-b border-slate-200 bg-slate-900 text-slate-100 shadow-sm dark:border-slate-800"
    >
      <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div class="flex items-center gap-3">
          <NuxtLink
            to="/admin"
            class="inline-flex items-center gap-2 font-semibold tracking-tight"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-5 text-amber-400"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
            >
              <path d="M12 2 4 6v6c0 5 3.5 9.5 8 10 4.5-.5 8-5 8-10V6l-8-4Z" />
            </svg>
            EarthLetter Admin
          </NuxtLink>
          <span class="hidden rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-amber-300 sm:inline">
            Restricted
          </span>
        </div>

        <nav class="flex items-center gap-3 text-sm">
          <NuxtLink
            to="/"
            class="rounded-md px-2 py-1 text-slate-300 hover:bg-slate-800 hover:text-slate-50"
          >
            View site
          </NuxtLink>
          <button
            type="button"
            class="inline-flex items-center rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="signingOut"
            @click="onLogout"
          >
            {{ signingOut ? 'Signing out…' : 'Log out' }}
          </button>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-slate-200 bg-slate-50 py-4 text-center text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-500">
      EarthLetter Admin — internal tooling. Not indexed.
    </footer>
  </div>
</template>
