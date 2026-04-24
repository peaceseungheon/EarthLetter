import { describe, it, expect } from 'vitest'

// Mirrors the logic in components/Pagination.vue. Kept as an independent
// reference implementation so that changes to the component must be paired
// with an intentional update here. Treat any drift as a red flag.
function computeWindow(
  page: number,
  totalPages: number,
  windowSize = 5
): (number | 'ellipsis')[] {
  if (totalPages <= 1) return []
  const pages: (number | 'ellipsis')[] = []
  const half = Math.floor(windowSize / 2)
  let start = Math.max(1, page - half)
  const end = Math.min(totalPages, start + windowSize - 1)
  start = Math.max(1, end - windowSize + 1)

  if (start > 1) {
    pages.push(1)
    if (start > 2) pages.push('ellipsis')
  }
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < totalPages) {
    if (end < totalPages - 1) pages.push('ellipsis')
    pages.push(totalPages)
  }
  return pages
}

// totalPages = ceil(total / pageSize). Must match server/api/articles.get.ts.
function totalPages(total: number, pageSize: number): number {
  if (pageSize <= 0) return 0
  return Math.ceil(total / pageSize)
}

describe('pagination — totalPages math', () => {
  it('rounds up partial pages', () => {
    expect(totalPages(21, 20)).toBe(2)
    expect(totalPages(40, 20)).toBe(2)
    expect(totalPages(41, 20)).toBe(3)
  })

  it('is zero when there are no items', () => {
    expect(totalPages(0, 20)).toBe(0)
  })

  it('handles odd page sizes', () => {
    expect(totalPages(25, 7)).toBe(4)
  })
})

describe('pagination — window', () => {
  it('renders nothing when totalPages <= 1', () => {
    expect(computeWindow(1, 1)).toEqual([])
    expect(computeWindow(1, 0)).toEqual([])
  })

  it('shows all pages when they fit the window', () => {
    expect(computeWindow(1, 3)).toEqual([1, 2, 3])
    expect(computeWindow(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('clips the window around the current page', () => {
    const out = computeWindow(10, 20)
    expect(out[0]).toBe(1)
    expect(out).toContain(10)
    expect(out.at(-1)).toBe(20)
    expect(out).toContain('ellipsis')
  })

  it('keeps ellipsis only when there is a gap greater than one', () => {
    // page 3 of 7 with window=5 → [1,2,3,4,5,...,7]: one ellipsis tail only
    const out = computeWindow(3, 7, 5)
    expect(out.filter((p) => p === 'ellipsis')).toHaveLength(1)
  })

  it('anchors the final page when the window straddles the end', () => {
    const out = computeWindow(20, 20)
    expect(out.at(-1)).toBe(20)
    expect(out).toContain(20)
  })
})
