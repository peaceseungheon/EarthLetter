// composables/useAdminAuth.ts
//
// Admin authentication helpers. The actual session is a HttpOnly cookie
// (`el_admin`) set by the server at POST /api/admin/session, so JavaScript
// cannot read it directly. Instead, `isAuthenticated` probes a cheap admin
// endpoint and interprets the HTTP status: 200 = authenticated, 401 = not.
//
// See architecture § 5 (admin authentication) and § 7.4 (token-gate UX).

export interface UseAdminAuthResult {
  login: (token: string) => Promise<boolean>
  logout: () => Promise<void>
  isAuthenticated: () => Promise<boolean>
}

interface AdminSessionResponse {
  ok: boolean
}

export function useAdminAuth(): UseAdminAuthResult {
  async function login(token: string): Promise<boolean> {
    try {
      await $fetch<AdminSessionResponse>('/api/admin/session', {
        method: 'POST',
        body: { token },
        // Include the Set-Cookie response so the browser persists `el_admin`.
        credentials: 'include'
      })
      return true
    } catch (err: unknown) {
      // Any non-2xx (notably 401 / 429) means login failed.
      const status = (err as { statusCode?: number; status?: number })
        .statusCode ?? (err as { status?: number }).status
      if (status === 401 || status === 429) return false
      // Network errors etc. fall through to false — caller shows generic msg.
      return false
    }
  }

  async function logout(): Promise<void> {
    try {
      await $fetch<AdminSessionResponse>('/api/admin/session/logout', {
        method: 'POST',
        credentials: 'include'
      })
    } catch {
      // Logout failures are non-fatal — user experience: best-effort clear.
    }
  }

  async function isAuthenticated(): Promise<boolean> {
    try {
      await $fetch('/api/admin/sources', {
        method: 'GET',
        query: { enabled: 'all' },
        credentials: 'include'
      })
      return true
    } catch (err: unknown) {
      const status = (err as { statusCode?: number; status?: number })
        .statusCode ?? (err as { status?: number }).status
      if (status === 401) return false
      // Treat unknown errors (network, 5xx) as "unauthenticated" so the UI
      // falls back to the token gate rather than showing a broken table.
      return false
    }
  }

  return { login, logout, isAuthenticated }
}
