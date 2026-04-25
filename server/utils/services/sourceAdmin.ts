// server/utils/services/sourceAdmin.ts
//
// Validation + orchestration layer between the /api/admin/sources route
// handlers and the repository. Keeps business rules (country must exist,
// topic must be one of three, URL must be http(s), name length) out of both
// handlers and Prisma.
//
// See architecture § 3 (validation rules) and § 6.1 (agent scope).

import { createError } from 'h3'
import { isTopicSlug } from '~/types/domain'
import type {
  AdminSourceCreateDTO,
  AdminSourceDTO,
  AdminSourcePatchDTO,
  TopicSlug
} from '~/types/dto'
import { countryExists } from '../repositories/countries'
import {
  createSource,
  deleteSource,
  findAdminSource,
  updateSource
} from '../repositories/sources'

// ---------------------------------------------------------------------------
// Validation primitives
// ---------------------------------------------------------------------------

const ISO_ALPHA2 = /^[A-Z]{2}$/
const NAME_MAX = 120
const URL_MAX = 2000

function badRequest(message: string): never {
  throw createError({
    statusCode: 400,
    statusMessage: 'BAD_REQUEST',
    data: { statusCode: 400, statusMessage: 'BAD_REQUEST', message }
  })
}

function notFound(message: string): never {
  throw createError({
    statusCode: 404,
    statusMessage: 'NOT_FOUND',
    data: { statusCode: 404, statusMessage: 'NOT_FOUND', message }
  })
}

function validateName(raw: unknown): string {
  if (typeof raw !== 'string') {
    badRequest('Field "name" must be a string.')
  }
  const trimmed = (raw as string).trim()
  if (trimmed.length < 1 || trimmed.length > NAME_MAX) {
    badRequest(`Field "name" must be 1..${NAME_MAX} characters.`)
  }
  return trimmed
}

function validateFeedUrl(raw: unknown): string {
  if (typeof raw !== 'string') {
    badRequest('Field "feedUrl" must be a string.')
  }
  const value = (raw as string).trim()
  if (value.length === 0 || value.length > URL_MAX) {
    badRequest(`Field "feedUrl" must be 1..${URL_MAX} characters.`)
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    badRequest('Field "feedUrl" must be a valid URL.')
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    badRequest('Field "feedUrl" must use http or https.')
  }
  return value
}

function validateCountryCode(raw: unknown): string {
  if (typeof raw !== 'string') {
    badRequest('Field "countryCode" must be a string.')
  }
  const code = (raw as string).toUpperCase()
  if (!ISO_ALPHA2.test(code)) {
    badRequest('Field "countryCode" must be ISO-3166 alpha-2.')
  }
  return code
}

function validateTopicSlug(raw: unknown): TopicSlug {
  if (typeof raw !== 'string' || !isTopicSlug(raw)) {
    badRequest('Field "topicSlug" must be one of military|economy|politics.')
  }
  return raw as TopicSlug
}

// ---------------------------------------------------------------------------
// Public validators (exported for unit tests + route handlers)
// ---------------------------------------------------------------------------

export interface ValidatedCreateInput extends AdminSourceCreateDTO {
  countryCode: string
  topicSlug: TopicSlug
  name: string
  feedUrl: string
}

export function validateAdminSourceCreate(body: unknown): ValidatedCreateInput {
  if (!body || typeof body !== 'object') {
    badRequest('Request body must be a JSON object.')
  }
  const b = body as Record<string, unknown>

  return {
    countryCode: validateCountryCode(b.countryCode),
    topicSlug: validateTopicSlug(b.topicSlug),
    name: validateName(b.name),
    feedUrl: validateFeedUrl(b.feedUrl)
  }
}

export type ValidatedPatchInput = AdminSourcePatchDTO

export function validateAdminSourcePatch(body: unknown): ValidatedPatchInput {
  if (!body || typeof body !== 'object') {
    badRequest('Request body must be a JSON object.')
  }
  const b = body as Record<string, unknown>
  const patch: ValidatedPatchInput = {}

  if (b.name !== undefined) {
    patch.name = validateName(b.name)
  }
  if (b.enabled !== undefined) {
    if (typeof b.enabled !== 'boolean') {
      badRequest('Field "enabled" must be a boolean.')
    }
    patch.enabled = b.enabled
  }

  // Intentionally reject unsupported patch keys (architecture § 3.1:
  // feedUrl/countryCode/topicSlug are delete+recreate, not patch).
  for (const key of Object.keys(b)) {
    if (key !== 'name' && key !== 'enabled') {
      badRequest(`Field "${key}" is not patchable. Delete and recreate instead.`)
    }
  }

  if (patch.name === undefined && patch.enabled === undefined) {
    badRequest('Patch body must set at least one of "name" or "enabled".')
  }

  return patch
}

export function parseSourceId(raw: unknown): number {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 1) {
    badRequest('Path param "id" must be a positive integer.')
  }
  return n
}

// ---------------------------------------------------------------------------
// Orchestration (validated input → repository)
// ---------------------------------------------------------------------------

export async function createSourceOrchestrated(
  body: unknown
): Promise<AdminSourceDTO> {
  const input = validateAdminSourceCreate(body)

  // Country must pre-exist — we refuse to silently create orphan Country rows.
  const exists = await countryExists(input.countryCode)
  if (!exists) {
    notFound(`Country "${input.countryCode}" is not registered.`)
  }

  return createSource(input)
}

export async function updateSourceOrchestrated(
  id: number,
  body: unknown
): Promise<AdminSourceDTO> {
  const patch = validateAdminSourcePatch(body)
  return updateSource(id, patch)
}

export async function deleteSourceOrchestrated(
  id: number
): Promise<{ id: number; deletedArticles: number }> {
  // Pre-flight existence check gives a cleaner 404 than relying on P2025
  // inside the transaction (the transaction path also 404s, but this avoids
  // spinning up the tx for the common "already gone" case).
  const existing = await findAdminSource(id)
  if (!existing) {
    notFound(`Source ${id} not found.`)
  }

  const { deletedArticles } = await deleteSource(id)
  return { id, deletedArticles }
}
