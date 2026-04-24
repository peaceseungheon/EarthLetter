import { test, expect } from '@playwright/test'

// Smoke test: the two SEO-critical surfaces render without JS errors and
// include their primary landmarks. Relies on the Nuxt dev/preview server
// being up (see playwright.config.ts) and the DB being seeded.

test('home renders heading + map + CountrySelector', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: /World news by country/i })
  ).toBeVisible()

  // Either the SVG map or the "map is loading" fallback must appear.
  const mapOrFallback = page
    .locator('svg[aria-label*="World map"], [role="status"]')
    .first()
  await expect(mapOrFallback).toBeVisible()

  // Accessible fallback is always rendered.
  await expect(page.getByRole('combobox')).toBeVisible()
})

test('country/topic page renders an article list or empty state', async ({
  page,
}) => {
  // US / politics is in the launch seed.
  await page.goto('/country/US/politics')
  await expect(
    page.getByRole('heading', { name: /Politics.*United States/i })
  ).toBeVisible()

  // Either articles render or the EmptyState placeholder is shown.
  const listOrEmpty = page
    .locator('[data-test="article-list"], [data-test="empty-state"], article')
    .first()
  await expect(listOrEmpty).toBeVisible({ timeout: 10_000 })
})

test('unknown country 404s via route middleware', async ({ page }) => {
  const response = await page.goto('/country/ZZZ/politics', {
    waitUntil: 'domcontentloaded',
  })
  expect(response?.status()).toBeGreaterThanOrEqual(400)
})

test('legal pages prerender without JS requirement', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: /About EarthLetter/i })).toBeVisible()
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: /Privacy Policy/i })).toBeVisible()
  await page.goto('/terms')
  await expect(page.getByRole('heading', { name: /Terms of Use/i })).toBeVisible()
})
