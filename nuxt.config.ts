// nuxt.config.ts
// See architecture § 6 for routeRules rationale and § 11 for runtimeConfig matrix.
// Ownership: frontend-dev holds the pen; backend-dev extends only `nitro` and
// `runtimeConfig.*` blocks via focused patch PRs.

export default defineNuxtConfig({
  compatibilityDate: '2024-11-01',

  ssr: true,

  devtools: { enabled: true },

  modules: [
    '@nuxtjs/tailwindcss',
    '@pinia/nuxt',
    '@nuxtjs/color-mode',
    '@nuxtjs/sitemap',
    '@nuxtjs/robots',
    '@nuxt/eslint',
    '@nuxt/ui'
  ],

  typescript: {
    strict: true,
    typeCheck: false // run via `pnpm typecheck` to keep dev start fast
  },

  css: ['~/assets/css/tailwind.css'],

  colorMode: {
    // @nuxtjs/color-mode — adds .dark / .light class to <html>.
    // Tailwind `darkMode: 'class'` pairs with `classSuffix: ''`.
    preference: 'system',
    fallback: 'light',
    classSuffix: '',
    storageKey: 'earthletter-color-mode'
  },

  runtimeConfig: {
    // Server-only secrets — never exposed to client.
    ingestSecret: process.env.INGEST_SECRET || '',
    databaseUrl: process.env.DATABASE_URL || '',
    directUrl: process.env.DIRECT_URL || '',
    // Public — hydrated into the window.__NUXT__ payload.
    public: {
      siteUrl: process.env.SITE_URL || 'http://localhost:3000',
      adsenseClient: process.env.NUXT_PUBLIC_ADSENSE_CLIENT || ''
    }
  },

  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'EarthLetter — World news by country',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        {
          name: 'description',
          content:
            'Click a country on the world map to read curated English-language news on military, economy, and politics.'
        },
        { name: 'theme-color', content: '#0b1020' }
      ],
      link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
    }
  },

  // Architecture § 6 — rendering strategy per route.
  routeRules: {
    '/': {
      swr: 300,
      headers: {
        'Cache-Control':
          'public, max-age=0, s-maxage=300, stale-while-revalidate=600'
      }
    },
    '/country/**': {
      swr: 600,
      headers: {
        'Cache-Control':
          'public, max-age=0, s-maxage=600, stale-while-revalidate=1800'
      }
    },
    '/about': { prerender: true },
    '/privacy': { prerender: true },
    '/terms': { prerender: true },
    '/api/**': { cors: false },
    '/api/ingest': { cors: false, robots: false },
    '/api/prune': { cors: false, robots: false },
    '/sitemap.xml': { swr: 3600 }
  },

  sitemap: {
    // backend-dev wires dynamic URL source at server/api/__sitemap__/urls.get.ts
    sources: ['/api/__sitemap__/urls']
  },

  robots: {
    // Architecture § 10.5.
    disallow: ['/api/']
  },

  nitro: {
    // Kept minimal; backend-dev may extend.
  }
})
