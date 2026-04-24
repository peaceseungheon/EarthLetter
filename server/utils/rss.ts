// server/utils/rss.ts
//
// Thin wrapper over rss-parser with a hard AbortController timeout, plus a
// p-limit-backed `parallel` helper. Architecture § 11.1 mandates the 10s
// fetch timeout and 2MB truncation — we enforce both here.

import pLimit from 'p-limit'
import Parser from 'rss-parser'

const MAX_BYTES = 2 * 1024 * 1024 // 2 MB

export interface ParsedFeedItem {
  title: string
  link: string
  contentSnippet: string | null
  enclosureUrl: string | null
  publishedAt: Date
}

export interface ParsedFeed {
  items: ParsedFeedItem[]
}

const parser = new Parser({
  timeout: 10_000,
  headers: {
    'User-Agent':
      'EarthLetterBot/0.1 (+https://github.com/ — news aggregation; contact via site)',
    Accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5'
  }
})

/**
 * Fetch an RSS/Atom feed with a hard timeout + size cap. Throws on any failure
 * with a short, non-sensitive message.
 */
export async function fetchFeed(
  url: string,
  timeoutMs = 10_000
): Promise<ParsedFeed> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'EarthLetterBot/0.1 (+https://github.com/ — news aggregation; contact via site)',
        Accept:
          'application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5'
      }
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    // Enforce a content-length cap when the server advertises one.
    const cl = res.headers.get('content-length')
    if (cl && Number(cl) > MAX_BYTES) {
      throw new Error('Feed exceeds 2MB cap')
    }

    const text = await res.text()
    if (text.length > MAX_BYTES) {
      throw new Error('Feed exceeds 2MB cap')
    }

    const parsed = await parser.parseString(text)

    const items: ParsedFeedItem[] = []
    for (const item of parsed.items ?? []) {
      const link = (item.link ?? '').trim()
      const title = (item.title ?? '').trim()
      if (!link || !title) continue

      const publishedRaw = item.isoDate ?? item.pubDate ?? null
      const published = publishedRaw ? new Date(publishedRaw) : new Date()
      if (Number.isNaN(published.getTime())) continue

      const snippet = (item.contentSnippet ?? '').trim()

      // enclosure can be MediaRSS, <enclosure>, or raw <media:content>
      type EnclosureLike = { url?: string }
      const enclosure = (item as { enclosure?: EnclosureLike }).enclosure
      const enclosureUrl = enclosure?.url ?? null

      items.push({
        title,
        link,
        contentSnippet: snippet ? snippet.slice(0, 500) : null,
        enclosureUrl,
        publishedAt: published
      })
    }

    return { items }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Run `fn(item)` across `items` with a concurrency cap. Returns settled
 * results so callers can isolate per-item failures without aborting the run.
 */
export async function parallel<T, R>(
  concurrency: number,
  items: readonly T[],
  fn: (item: T) => Promise<R>
): Promise<Array<PromiseSettledResult<R>>> {
  const limit = pLimit(concurrency)
  return Promise.allSettled(items.map((item) => limit(() => fn(item))))
}
