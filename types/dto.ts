// types/dto.ts
//
// SINGLE SOURCE OF TRUTH — 수정 시 frontend-dev/backend-dev 모두에게 알릴 것.
// Source: _workspace/00_architecture.md § 4 (contract-frozen).
// Any drift between this file and the § 4 table is an architecture violation.
//
// Both the Nuxt client (useFetch generic, Pinia state) and the Nitro server
// (route handler return types, DTO mappers under `server/utils/dto.ts`) must
// import from this module via the `~/types/dto` alias. Do not re-declare
// these shapes anywhere else.

export type TopicSlug = 'military' | 'economy' | 'politics'

export type IsoCountryCode = string // ISO-3166 alpha-2; runtime validated

// ---------- Article ----------

export interface ArticleSourceDTO {
  id: number
  name: string
  countryCode: IsoCountryCode
  topicSlug: TopicSlug
}

export interface ArticleDTO {
  id: string // sha256(link)
  title: string
  summary: string | null
  link: string // absolute outbound URL
  imageUrl: string | null
  publishedAt: string // ISO-8601 UTC
  source: ArticleSourceDTO
}

// ---------- Country ----------

export interface CountryDTO {
  code: IsoCountryCode
  nameEn: string
  nameKo: string | null
  hasSources: boolean // false → map renders dimmed + non-clickable
  sourceCount: number // optional UX hint, always present
}

// ---------- Response envelopes ----------

export interface CountriesResponseDTO {
  items: CountryDTO[]
}

export interface ArticlesQueryDTO {
  country: IsoCountryCode
  topic: TopicSlug
  page?: number // 1-indexed; default 1
  pageSize?: number // default 20, max 50
}

export interface ArticlesResponseDTO {
  items: ArticleDTO[]
  total: number
  page: number
  pageSize: number
  totalPages: number // ceil(total / pageSize)
}

export interface HomeResponseDTO {
  featured: ArticleDTO[] // max 12, newest first across all sources
}

// ---------- Write endpoints (server-only callers) ----------

export interface IngestFailure {
  sourceId: number
  feedUrl: string
  error: string // short message; no stack
}

export interface IngestResponseDTO {
  fetched: number // feeds successfully fetched
  inserted: number // new Article rows
  updated: number // upserts that replaced existing row
  failedSources: IngestFailure[]
  autoDisabled: number // sources that crossed the auto-disable threshold this run
  durationMs: number
}

export interface PruneResponseDTO {
  deleted: number
  cutoff: string // ISO-8601 — articles with publishedAt < cutoff removed
}

// ---------- Error envelope (all 4xx/5xx) ----------

export interface ApiErrorDTO {
  statusCode: number
  statusMessage: string // short code, e.g. "UNAUTHORIZED"
  message: string // human-readable
}

// ---------- Convenience aliases (not part of § 4 table but cross-referenced) ----------

/**
 * Alias kept for backwards compatibility with orchestrator handoff notes
 * that spelled the error type `ApiError`. Prefer `ApiErrorDTO` in new code.
 */
export type ApiError = ApiErrorDTO

/**
 * Generic success envelope. The API currently returns bare DTOs (e.g. the
 * `/api/countries` handler returns `CountriesResponseDTO` directly, not
 * `{ data: CountriesResponseDTO }`), but this alias is provided for routes
 * that adopt a wrapped convention later. Usage must be explicitly agreed
 * between frontend-dev and backend-dev; do not introduce unilaterally.
 */
export interface ApiEnvelope<T> {
  data: T
}

// ---------- Admin: Source management (Feature E) ----------

export interface AdminSourceDTO {
  id: number
  countryCode: IsoCountryCode
  topicSlug: TopicSlug
  name: string
  feedUrl: string
  enabled: boolean
  failCount: number
  lastFailedAt: string | null
  disabledAt: string | null
  articleCount: number
  createdAt: string
}

export interface AdminSourcesQueryDTO {
  country?: IsoCountryCode
  topic?: TopicSlug
  enabled?: 'true' | 'false' | 'all'
  disabled?: 'auto' | 'manual' | 'any'
}

export interface AdminSourcesResponseDTO {
  items: AdminSourceDTO[]
  total: number
}

export interface AdminSourceCreateDTO {
  countryCode: IsoCountryCode
  topicSlug: TopicSlug
  name: string
  feedUrl: string
}

export interface AdminSourcePatchDTO {
  enabled?: boolean
  name?: string
}

export interface AdminSourceDeleteResponseDTO {
  id: number
  deletedArticles: number
}
