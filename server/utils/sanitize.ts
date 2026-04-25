// server/utils/sanitize.ts
//
// Server-side HTML sanitizer for RSS `content:encoded` payloads.
// Architecture § 6 — allow-list based, pure-parser (no DOM).
// The sanitized output is persisted to Article.contentHtml and later rendered
// via <ArticleContent v-html> — this file is the ONLY security boundary for
// that pathway, so keep the allow-list tight and every change reviewed.

import sanitizeHtml from 'sanitize-html'

const MAX_BYTES = 500_000 // ~500KB; larger payloads → null (store nothing)
const MIN_LENGTH = 100 // under this, the body is effectively empty → null

const ALLOWED_TAGS = [
  'p',
  'br',
  'hr',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'strong',
  'em',
  'b',
  'i',
  'u',
  's',
  'sub',
  'sup',
  'ul',
  'ol',
  'li',
  'a',
  'blockquote',
  'cite',
  'q',
  'code',
  'pre',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'span',
  'div'
]

/**
 * Sanitize an RSS article HTML body. Returns `null` when:
 *  - the input exceeds the 500KB cap (likely malformed / truncated upstream)
 *  - the sanitized result collapses to empty / below MIN_LENGTH characters
 *
 * Callers must treat a `null` return as "store nothing" — never persist the
 * raw input. The output is pre-hardened so `ArticleContent` can render it
 * with `v-html` without further escaping.
 */
export function sanitizeArticleHtml(html: string): string | null {
  if (typeof html !== 'string') return null
  if (html.length > MAX_BYTES) return null

  const clean = sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // `target` / `rel` are allow-listed so the transformTag below survives
      // sanitize-html's post-transform attribute filter.
      a: ['href', 'title', 'target', 'rel'],
      // Likewise `loading` / `decoding` / `referrerpolicy` for <img> hardening.
      img: [
        'src',
        'alt',
        'title',
        'width',
        'height',
        'loading',
        'decoding',
        'referrerpolicy'
      ],
      '*': ['class']
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    transformTags: {
      a: (tagName, attribs) => ({
        tagName: 'a',
        attribs: {
          ...attribs,
          target: '_blank',
          rel: 'noopener noreferrer nofollow'
        }
      }),
      img: (tagName, attribs) => ({
        tagName: 'img',
        attribs: {
          ...attribs,
          loading: 'lazy',
          decoding: 'async',
          referrerpolicy: 'no-referrer'
        }
      })
    },
    exclusiveFilter: (frame) =>
      frame.tag === 'p' && !frame.text.trim() && !frame.mediaChildren.length
  })

  const trimmed = clean.trim()
  if (!trimmed) return null
  if (trimmed.length < MIN_LENGTH) return null
  return trimmed
}
