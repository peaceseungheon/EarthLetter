// server/utils/hash.ts
//
// sha256 helper used for Article.id = sha256(link). Node built-in crypto,
// returns lowercase hex digest.

import { createHash } from 'node:crypto'

export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}
