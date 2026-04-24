// middleware/country-guard.global.ts
//
// Reject unknown ISO-3166 alpha-2 codes on /country/** routes with a 404
// before the page component mounts. The backend also validates, but
// catching it at the route layer avoids a wasted render pass.

import { isTopicSlug } from '~/types/domain'

const ALPHA2_RE = /^[A-Z]{2}$/

export default defineNuxtRouteMiddleware((to) => {
  if (!to.path.startsWith('/country/')) return

  const rawCode = String(to.params.code ?? '')
  const code = rawCode.toUpperCase()
  if (!ALPHA2_RE.test(code)) {
    return abortNavigation(
      createError({
        statusCode: 404,
        statusMessage: 'Country not found',
        fatal: true
      })
    )
  }

  // Topic param only present on /country/[code]/[topic].
  if (to.params.topic !== undefined) {
    const topic = String(to.params.topic)
    if (!isTopicSlug(topic)) {
      return abortNavigation(
        createError({
          statusCode: 404,
          statusMessage: 'Topic not found',
          fatal: true
        })
      )
    }
  }

  // 소문자 코드 → 301 canonical redirect
  if (rawCode !== code) {
    const newPath = to.path.replace(`/country/${rawCode}`, `/country/${code}`)
    return navigateTo(newPath, { redirectCode: 301 })
  }
})
