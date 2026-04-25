import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchFeed } from '../../server/utils/rss'

// Stub `fetch` so we drive fetchFeed off in-memory RSS fixtures.
// We only assert on the `contentHtml` field — publishedAt / title behavior is
// covered elsewhere.

function rssFixture(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>Fixture</title>
    <link>https://ex.com</link>
    <description>fixture</description>
    ${body}
  </channel>
</rss>`
}

function itemWithContentEncoded(html: string): string {
  return `<item>
    <title>Article one</title>
    <link>https://ex.com/1</link>
    <pubDate>Wed, 22 Apr 2026 00:00:00 GMT</pubDate>
    <description>short snippet</description>
    <content:encoded><![CDATA[${html}]]></content:encoded>
  </item>`
}

function itemWithoutContent(): string {
  return `<item>
    <title>Article two</title>
    <link>https://ex.com/2</link>
    <pubDate>Wed, 22 Apr 2026 00:00:00 GMT</pubDate>
    <description>just a snippet, no full content</description>
  </item>`
}

function stubFetchWith(xml: string) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      return new Response(xml, {
        status: 200,
        headers: { 'content-type': 'application/rss+xml' }
      })
    })
  )
}

describe('fetchFeed — contentHtml extraction', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sets contentHtml when <content:encoded> is present and substantial', async () => {
    const fullHtml =
      '<p>' +
      'Paragraph body paragraph body paragraph body paragraph body. '.repeat(5) +
      '</p><p>Second paragraph with <strong>emphasis</strong>.</p>'
    stubFetchWith(rssFixture(itemWithContentEncoded(fullHtml)))

    const feed = await fetchFeed('https://ex.com/feed.xml')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]!
    expect(item.contentHtml).not.toBeNull()
    expect(item.contentHtml!).toContain('<strong>emphasis</strong>')
  })

  it('sets contentHtml to null when <content:encoded> is absent', async () => {
    stubFetchWith(rssFixture(itemWithoutContent()))

    const feed = await fetchFeed('https://ex.com/feed.xml')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]!
    expect(item.contentHtml).toBeNull()
  })

  it('sanitizes <script> and on* attributes out of content:encoded', async () => {
    const malicious =
      '<script>alert(1)</script>' +
      '<p onclick="alert(1)">hello there friends</p>' +
      '<p>' +
      'long enough body text to survive the minimum-length filter. '.repeat(5) +
      '</p>' +
      '<img src="x" onerror="alert(1)">'
    stubFetchWith(rssFixture(itemWithContentEncoded(malicious)))

    const feed = await fetchFeed('https://ex.com/feed.xml')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]!
    const contentHtml = item.contentHtml
    expect(contentHtml).not.toBeNull()
    expect(contentHtml!).not.toContain('<script')
    expect(contentHtml!).not.toContain('onclick')
    expect(contentHtml!).not.toContain('onerror')
    expect(contentHtml!).not.toContain('alert(1)')
  })

  it('returns null contentHtml when sanitized output is below MIN_LENGTH', async () => {
    // Body shorter than 100 chars after sanitize → treated as "no content".
    stubFetchWith(rssFixture(itemWithContentEncoded('<p>hi</p>')))

    const feed = await fetchFeed('https://ex.com/feed.xml')
    expect(feed.items).toHaveLength(1)
    const item = feed.items[0]!
    expect(item.contentHtml).toBeNull()
  })
})
