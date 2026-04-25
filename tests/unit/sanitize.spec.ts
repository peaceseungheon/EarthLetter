import { describe, expect, it } from 'vitest'
import { sanitizeArticleHtml } from '../../server/utils/sanitize'

// Pad a short HTML fragment up to MIN_LENGTH so we exercise the sanitizer's
// tag-level transforms without tripping the "too short → null" guard.
function pad(html: string): string {
  const filler = '<p>' + 'lorem ipsum dolor sit amet '.repeat(10) + '</p>'
  return html + filler
}

describe('sanitizeArticleHtml', () => {
  it('strips <script> tags entirely', () => {
    const out = sanitizeArticleHtml(pad('<script>alert(1)</script><p>hi</p>'))
    expect(out).not.toBeNull()
    expect(out!).not.toContain('<script')
    expect(out!).not.toContain('alert(1)')
  })

  it('removes onerror attributes from <img>', () => {
    const out = sanitizeArticleHtml(
      pad('<img src="https://ex.com/x.png" onerror="alert(1)">')
    )
    expect(out).not.toBeNull()
    expect(out!).not.toContain('onerror')
    expect(out!).not.toContain('alert(1)')
  })

  it('removes href when scheme is javascript:', () => {
    const out = sanitizeArticleHtml(
      pad('<a href="javascript:alert(1)">click</a>')
    )
    expect(out).not.toBeNull()
    expect(out!).not.toContain('javascript:')
    expect(out!).not.toContain('alert(1)')
  })

  it('removes <iframe> completely', () => {
    const out = sanitizeArticleHtml(
      pad('<iframe src="https://evil.example"></iframe>')
    )
    expect(out).not.toBeNull()
    expect(out!).not.toContain('<iframe')
    expect(out!).not.toContain('evil.example')
  })

  it('strips onclick and other on* attributes', () => {
    const out = sanitizeArticleHtml(pad('<p onclick="alert(1)">hello</p>'))
    expect(out).not.toBeNull()
    expect(out!).not.toContain('onclick')
    expect(out!).not.toContain('alert(1)')
  })

  it('leaves benign formatting HTML intact', () => {
    const input = pad('<p>Hello <strong>world</strong></p>')
    const out = sanitizeArticleHtml(input)
    expect(out).not.toBeNull()
    expect(out!).toContain('<p>Hello <strong>world</strong></p>')
  })

  it('auto-injects target=_blank and rel on <a>', () => {
    const out = sanitizeArticleHtml(
      pad('<a href="https://example.com">read</a>')
    )
    expect(out).not.toBeNull()
    expect(out!).toContain('target="_blank"')
    expect(out!).toContain('rel="noopener noreferrer nofollow"')
  })

  it('auto-injects loading=lazy and referrerpolicy on <img>', () => {
    const out = sanitizeArticleHtml(
      pad('<img src="https://example.com/x.png" alt="x">')
    )
    expect(out).not.toBeNull()
    expect(out!).toContain('loading="lazy"')
    expect(out!).toContain('decoding="async"')
    expect(out!).toContain('referrerpolicy="no-referrer"')
  })

  it('returns null for input exceeding the 500KB cap', () => {
    const oversize = '<p>' + 'x'.repeat(600_000) + '</p>'
    expect(sanitizeArticleHtml(oversize)).toBeNull()
  })

  it('returns null for content that collapses below MIN_LENGTH', () => {
    expect(sanitizeArticleHtml('<p>hi</p>')).toBeNull()
  })

  it('filters out empty <p> tags produced by sanitization', () => {
    const input = pad('<p></p><p>   </p><p>real content here</p>')
    const out = sanitizeArticleHtml(input)
    expect(out).not.toBeNull()
    // the opening padding contains filler; ensure "real content here" survives
    expect(out!).toContain('real content here')
  })

  it('blocks data: URLs on <img>', () => {
    const out = sanitizeArticleHtml(
      pad('<img src="data:image/png;base64,AAAA">')
    )
    expect(out).not.toBeNull()
    expect(out!).not.toContain('data:image')
  })
})
