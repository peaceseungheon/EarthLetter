<script setup lang="ts">
// Feature K — Article detail page (SSR). See _workspace/00_architecture.md § 5.2.
//
// Route: /article/:id  where :id is sha256(link) as 64-char hex.
// Fetches GET /api/articles/:id; endpoint 404s when row is missing *or*
// contentHtml is null, so by the time we render we always have sanitized HTML.

import { computed } from 'vue'
import { createError, useRoute } from '#imports'
import type { ArticleDetailDTO } from '~/types/dto'
import { TOPIC_META, isIsoCountryCode } from '~/types/domain'
import { useCountriesStore } from '~/stores/countries'

const route = useRoute()
const id = computed(() => String(route.params.id ?? ''))

const { data: article, error } = await useFetch<ArticleDetailDTO>(
  () => `/api/articles/${id.value}`,
  { key: `article-${id.value}`, server: true }
)

if (error.value || !article.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Article not found',
    fatal: true
  })
}

const detail = computed(() => article.value as ArticleDetailDTO)

// Populate countries store (best-effort) so the breadcrumb can show the
// country name. The store has built-in staleness handling.
const countriesStore = useCountriesStore()
await useAsyncData(`article-country-meta-${id.value}`, async () => {
  await countriesStore.fetchIfStale()
  return true
})

const countryCode = computed(() =>
  detail.value.source.countryCode.toUpperCase()
)
const country = computed(() => countriesStore.byCode(countryCode.value))
const countryName = computed(
  () => country.value?.nameEn ?? countryCode.value
)

// ISO-3166 alpha-2 → flag emoji via regional-indicator code points.
// Mirrors components/CountryHeader.vue so the header has a familiar shape.
const flag = computed(() => {
  const code = countryCode.value
  if (!isIsoCountryCode(code)) return ''
  const a = 0x1f1e6
  const [first, second] = code
  if (!first || !second) return ''
  return (
    String.fromCodePoint(a + (first.charCodeAt(0) - 65)) +
    String.fromCodePoint(a + (second.charCodeAt(0) - 65))
  )
})

const topicLabel = computed(
  () => TOPIC_META[detail.value.source.topicSlug].labelEn
)
const topicSlug = computed(() => detail.value.source.topicSlug)

const publishedRelative = computed(() =>
  useRelativeTime(detail.value.publishedAt)
)

const config = useRuntimeConfig()
const siteOrigin = String(config.public.siteUrl ?? '').replace(/\/$/, '')
const canonicalUrl = computed(() => `${siteOrigin}/article/${id.value}`)

useSeoMeta({
  title: `${detail.value.title} — ${detail.value.source.name} | EarthLetter`,
  description: detail.value.summary ?? undefined,
  ogTitle: detail.value.title,
  ogDescription: detail.value.summary ?? undefined,
  ogImage: detail.value.imageUrl ?? undefined,
  ogType: 'article',
  ogUrl: canonicalUrl.value,
  articlePublishedTime: detail.value.publishedAt,
  twitterCard: detail.value.imageUrl ? 'summary_large_image' : 'summary',
  twitterTitle: detail.value.title,
  twitterDescription: detail.value.summary ?? undefined,
  twitterImage: detail.value.imageUrl ?? undefined
})
useHead({
  link: [{ rel: 'canonical', href: canonicalUrl.value }]
})
</script>

<template>
  <article class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
    <nav
      class="flex flex-wrap items-center gap-1 text-xs text-ink-muted dark:text-ink-dark-muted"
      aria-label="Breadcrumb"
    >
      <NuxtLink to="/" class="hover:text-accent hover:underline">
        Home
      </NuxtLink>
      <span aria-hidden="true">›</span>
      <NuxtLink
        :to="`/country/${countryCode}`"
        class="hover:text-accent hover:underline"
      >
        {{ countryName }}
      </NuxtLink>
      <span aria-hidden="true">›</span>
      <NuxtLink
        :to="`/country/${countryCode}/${topicSlug}`"
        class="hover:text-accent hover:underline"
      >
        {{ topicLabel }}
      </NuxtLink>
      <span aria-hidden="true">›</span>
      <span class="line-clamp-1 text-ink dark:text-ink-dark">
        {{ detail.title }}
      </span>
    </nav>

    <header class="flex flex-col gap-3">
      <div
        class="flex flex-wrap items-center gap-2 text-sm text-ink-muted dark:text-ink-dark-muted"
      >
        <span
          class="text-xl leading-none"
          role="img"
          :aria-label="`${countryName} flag`"
        >
          {{ flag }}
        </span>
        <span
          class="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium uppercase tracking-wide text-ink dark:bg-surface-dark-muted dark:text-ink-dark"
        >
          {{ topicLabel }}
        </span>
        <span class="font-medium text-ink dark:text-ink-dark">
          {{ detail.source.name }}
        </span>
        <span aria-hidden="true">·</span>
        <time :datetime="detail.publishedAt">{{ publishedRelative }}</time>
      </div>

      <h1
        class="text-3xl font-semibold leading-tight tracking-tight text-ink dark:text-ink-dark sm:text-4xl"
      >
        {{ detail.title }}
      </h1>

      <p
        v-if="detail.summary"
        class="text-lg leading-relaxed text-ink-muted dark:text-ink-dark-muted"
      >
        {{ detail.summary }}
      </p>
    </header>

    <figure
      v-if="detail.imageUrl"
      class="overflow-hidden rounded-lg border border-black/5 bg-surface-muted dark:border-white/10 dark:bg-surface-dark"
    >
      <img
        :src="detail.imageUrl"
        :alt="detail.title"
        loading="eager"
        decoding="async"
        referrerpolicy="no-referrer"
        class="aspect-[16/9] w-full object-cover"
      >
    </figure>

    <ArticleContent :html="detail.contentHtml" />

    <hr class="border-black/5 dark:border-white/10">

    <div class="flex flex-col gap-4">
      <a
        :href="detail.link"
        target="_blank"
        rel="noopener noreferrer nofollow"
        class="inline-flex w-fit items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface dark:focus-visible:ring-offset-surface-dark"
      >
        원문 보기
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          class="size-4"
          aria-hidden="true"
        >
          <path d="M7 17 17 7M10 7h7v7" />
        </svg>
      </a>

      <p class="text-xs leading-relaxed text-ink-muted dark:text-ink-dark-muted">
        이 콘텐츠는 {{ detail.source.name }}의 RSS 피드에서 제공된 것입니다.
        원문 저작권은 해당 매체에 있습니다.
      </p>
    </div>
  </article>
</template>
