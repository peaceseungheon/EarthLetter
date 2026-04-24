// types/domain.ts
//
// Domain-layer types used across the client. Unlike `types/dto.ts` (wire
// contract, frozen), this file captures front-end-only concerns: branded
// country codes for compile-time safety, topic metadata, and UI enums.
//
// Do not put anything here that is serialized over the network — extend
// `types/dto.ts` instead (requires architect sign-off).

import type { TopicSlug } from './dto'

export type { TopicSlug }

/**
 * ISO-3166 alpha-2 branded string. Prevents accidental string-swap at
 * compile time without affecting the runtime `string` representation used
 * by DTOs. Construct via `toIsoCountryCode(value)`.
 */
export type IsoCountryCode = string & { readonly __iso: unique symbol }

const ISO_ALPHA2_RE = /^[A-Z]{2}$/

export function toIsoCountryCode(value: string): IsoCountryCode {
  const upper = value.toUpperCase()
  if (!ISO_ALPHA2_RE.test(upper)) {
    throw new Error(`Invalid ISO-3166 alpha-2 code: ${value}`)
  }
  return upper as IsoCountryCode
}

export function isIsoCountryCode(value: string): value is IsoCountryCode {
  return ISO_ALPHA2_RE.test(value.toUpperCase())
}

export const TOPIC_SLUGS: readonly TopicSlug[] = [
  'military',
  'economy',
  'politics'
] as const

export interface TopicMeta {
  slug: TopicSlug
  labelEn: string
  description: string
}

export const TOPIC_META: Record<TopicSlug, TopicMeta> = {
  military: {
    slug: 'military',
    labelEn: 'Military',
    description: 'Defense, security, and armed-forces coverage.'
  },
  economy: {
    slug: 'economy',
    labelEn: 'Economy',
    description: 'Trade, markets, and macroeconomic indicators.'
  },
  politics: {
    slug: 'politics',
    labelEn: 'Politics',
    description: 'Government, elections, and diplomatic affairs.'
  }
}

export function isTopicSlug(value: string): value is TopicSlug {
  return (TOPIC_SLUGS as readonly string[]).includes(value)
}
