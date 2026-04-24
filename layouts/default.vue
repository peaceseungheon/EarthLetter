<script setup lang="ts">
// App shell. Ad slots are placed inside pages, not the layout, because the
// spec (§ 8) restricts ads to article-list and country pages.
</script>

<template>
  <div
    class="flex min-h-dvh flex-col bg-surface text-ink dark:bg-surface-dark dark:text-ink-dark"
  >
    <SiteHeader />
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
