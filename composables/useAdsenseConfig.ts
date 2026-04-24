// composables/useAdsenseConfig.ts
// Thin accessor over runtimeConfig.public.adsenseClient. See architecture § 9.
// Centralizing avoids scattered `useRuntimeConfig().public.adsenseClient` reads
// (and protects against typos since the key is referenced in many places).

export interface AdsenseConfig {
  /** e.g. "ca-pub-XXXXXXXXXXXXXXXX" when enabled, else empty string. */
  client: string
  /** True iff client is a non-empty string. */
  enabled: boolean
}

export function useAdsenseConfig(): AdsenseConfig {
  const config = useRuntimeConfig()
  const client = String(config.public.adsenseClient ?? '').trim()
  return {
    client,
    enabled: client.length > 0
  }
}
