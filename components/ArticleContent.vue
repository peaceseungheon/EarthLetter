<script setup lang="ts">
// SECURITY: v-html 사용은 반드시 이 컴포넌트 한 곳으로 격리한다 (아키텍처 § 5.3).
// `html`은 server/utils/sanitize.ts의 allow-list 기반 sanitize를 통과한 값만
// 전달되어야 한다. 다른 위치에서 v-html을 도입하려면 아키텍처 리뷰가 필요하다.
defineProps<{ html: string }>()
</script>

<template>
  <!-- SECURITY: html은 server/utils/sanitize.ts allow-list로 정제된 값. v-html은 이 컴포넌트 한 곳에 격리 (§ 5.3). -->
  <div
    class="article-content prose prose-neutral max-w-none dark:prose-invert"
    v-html="html"
  />
</template>
