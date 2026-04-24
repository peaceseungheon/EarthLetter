// server/api/__sitemap__/urls.get.ts
// Feeds @nuxtjs/sitemap with every country + (country, topic) URL.

import { prisma } from '../../utils/prisma'

const TOPICS = ['military', 'economy', 'politics'] as const

export default defineEventHandler(async () => {
  const countries = await prisma.country.findMany({
    select: { code: true },
    orderBy: { code: 'asc' },
  })

  const urls: Array<{ loc: string; changefreq?: string; priority?: number }> = []

  for (const c of countries) {
    urls.push({
      loc: `/country/${c.code}`,
      changefreq: 'weekly',
      priority: 0.7,
    })
    for (const topic of TOPICS) {
      urls.push({
        loc: `/country/${c.code}/${topic}`,
        changefreq: 'daily',
        priority: 0.8,
      })
    }
  }

  return urls
})
