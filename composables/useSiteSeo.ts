// composables/useSiteSeo.ts
//
// Thin wrapper that standardizes the page-level SEO meta set (title,
// description, canonical, OG/Twitter). Every content page should call this;
// specific overrides still use `useSeoMeta` directly for exotic tags.

import { useCanonical } from './useCanonical'

export interface SiteSeoInput {
  title: string
  description: string
  /** Override canonical (otherwise derived from current route). */
  canonical?: string
  /** Absolute or root-relative OG image path; defaults to /og-default.png. */
  ogImage?: string
  /** "article" for article-like pages, else "website". */
  ogType?: 'website' | 'article'
  /** If true, emit noindex — used on 404 etc. Defaults to false. */
  noIndex?: boolean
}

export function useSiteSeo(input: SiteSeoInput): void {
  const config = useRuntimeConfig()
  const siteUrl = String(config.public.siteUrl ?? '').replace(/\/$/, '')
  const canonical = input.canonical ?? useCanonical()
  const ogImage = input.ogImage
    ? input.ogImage.startsWith('http')
      ? input.ogImage
      : `${siteUrl}${input.ogImage.startsWith('/') ? '' : '/'}${input.ogImage}`
    : `${siteUrl}/og-default.png`

  useSeoMeta({
    title: input.title,
    description: input.description,
    ogTitle: input.title,
    ogDescription: input.description,
    ogType: input.ogType ?? 'website',
    ogUrl: canonical,
    ogImage,
    ogSiteName: 'EarthLetter',
    twitterCard: 'summary_large_image',
    twitterTitle: input.title,
    twitterDescription: input.description,
    twitterImage: ogImage,
    robots: input.noIndex ? 'noindex, nofollow' : 'index, follow'
  })

  useHead({
    link: [{ rel: 'canonical', href: canonical }]
  })
}
