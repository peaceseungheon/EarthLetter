// plugins/adsense.client.ts
//
// Client-only, one-time AdSense script injection. See architecture § 9.3.
// Safe to call repeatedly — guarded by a data attribute on the <script> tag.

export default defineNuxtPlugin(() => {
  if (import.meta.server) return
  const { client, enabled } = useAdsenseConfig()
  if (!enabled) return

  const ATTR = 'data-adsense-loaded'
  if (document.querySelector(`script[${ATTR}]`)) return

  const script = document.createElement('script')
  script.async = true
  script.crossOrigin = 'anonymous'
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(
    client
  )}`
  script.setAttribute(ATTR, 'true')
  document.head.appendChild(script)
})
