<script setup lang="ts">
import { computed, resolveComponent } from 'vue'
import type { ArticleDTO } from '~/types/dto'
import { TOPIC_META } from '~/types/domain'

interface Props {
  article: ArticleDTO
}
const props = defineProps<Props>()

const relative = useRelativeTime(props.article.publishedAt)
const topicLabel = computed(
  () => TOPIC_META[props.article.source.topicSlug].labelEn
)

// Feature K: hasContent true → internal detail route (/article/:id);
// false → external link (legacy behavior). BE always populates this field
// per architecture § 2.5 ("두 단계 쿼리" 패턴).
const linkTag = computed(() =>
  props.article.hasContent ? resolveComponent('NuxtLink') : 'a'
)

const linkProps = computed<Record<string, string | undefined>>(() =>
  props.article.hasContent
    ? { to: `/article/${props.article.id}` }
    : {
      href: props.article.link,
      target: '_blank',
      rel: 'noopener noreferrer nofollow'
    }
)
</script>

<template>
  <article
    class="group flex h-full flex-col overflow-hidden rounded-lg border border-black/5 bg-surface shadow-sm transition-shadow hover:shadow-md focus-within:shadow-md dark:border-white/10 dark:bg-surface-dark-muted"
  >
    <component
      :is="linkTag"
      v-bind="linkProps"
      class="flex h-full flex-col focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      <div
        v-if="article.imageUrl"
        class="aspect-[16/9] w-full overflow-hidden bg-surface-muted dark:bg-surface-dark"
      >
        <img
          :src="article.imageUrl"
          :alt="article.title"
          loading="lazy"
          decoding="async"
          class="h-full w-full object-cover transition-transform group-hover:scale-[1.02]"
        >
      </div>

      <div class="flex flex-1 flex-col gap-3 p-4">
        <div
          class="flex flex-wrap items-center gap-2 text-xs text-ink-muted dark:text-ink-dark-muted"
        >
          <span
            class="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 font-medium uppercase tracking-wide text-ink dark:bg-surface-dark dark:text-ink-dark"
          >
            {{ topicLabel }}
          </span>
          <span aria-hidden="true">·</span>
          <span class="truncate">{{ article.source.name }}</span>
          <span aria-hidden="true">·</span>
          <time :datetime="article.publishedAt">{{ relative }}</time>
        </div>

        <h3
          class="line-clamp-3 text-base font-semibold leading-snug text-ink group-hover:text-accent dark:text-ink-dark"
        >
          {{ article.title }}
        </h3>

        <p
          v-if="article.summary"
          class="line-clamp-3 text-sm text-ink-muted dark:text-ink-dark-muted"
        >
          {{ article.summary }}
        </p>

        <span
          class="mt-auto inline-flex items-center gap-1 text-xs font-medium text-accent"
        >
          <template v-if="article.hasContent">
            본문 보기
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              class="size-4"
              aria-hidden="true"
            >
              <path d="M5 12h14M13 5l7 7-7 7" />
            </svg>
          </template>
          <template v-else>
            Read at source
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
          </template>
        </span>
      </div>
    </component>
  </article>
</template>
