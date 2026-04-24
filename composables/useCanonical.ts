// composables/useCanonical.ts
// Single source of truth for canonical URL construction. See architecture § 10.2.

export function useCanonical(pathOverride?: string): string {
  const route = useRoute()
  const config = useRuntimeConfig()
  const base = String(config.public.siteUrl ?? '').replace(/\/$/, '')
  const path = pathOverride ?? route.path
  const pageParam = route.query?.page
  // Paginated lists: canonical self-references page 2+, strips ?page=1.
  if (!pathOverride && pageParam && pageParam !== '1') {
    return `${base}${path}?page=${pageParam}`
  }
  return `${base}${path}`
}
