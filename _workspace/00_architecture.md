# EarthLetter — Architecture Blueprint v1.1 (Phase 3)

**Author:** architect agent
**Date:** 2026-04-24
**Status:** Ready for parallel implementation (backend-dev + frontend-dev). Contract-frozen DTOs in § 3.
**Prior art:** `_workspace_prev/00_architecture.md` (MVP), `_workspace_prev/01_frontend_done.md`, `_workspace_prev/02_backend_done.md`.

This document specifies three additive features: **E. Admin Dashboard**, **F. Source Auto-Disable**, **G. Country Coverage Expansion**. MVP behavior and DTOs (§ 4 of v1.0) remain unchanged except where § 3 of this doc explicitly extends them.

---

## 1. Directory Structure (delta only)

New files and files that require modification. Unchanged files from the MVP tree are omitted.

```
EarthLetter/
├── prisma/
│   ├── schema.prisma                       # MODIFY: Source adds failCount, disabledAt, lastFailedAt, createdAt
│   ├── migrations/
│   │   └── 20260424_source_autodisable/    # NEW: Prisma migration
│   │       └── migration.sql
│   └── seed.ts                             # MODIFY: 10 → 30 countries (Feature G)
│
├── server/
│   ├── api/
│   │   └── admin/                          # NEW subtree (bearer-gated, noindex)
│   │       ├── session.post.ts             # POST /api/admin/session  (issue cookie)
│   │       ├── session/
│   │       │   └── logout.post.ts          # POST /api/admin/session/logout
│   │       ├── sources.get.ts              # GET  /api/admin/sources
│   │       ├── sources.post.ts             # POST /api/admin/sources
│   │       └── sources/
│   │           ├── [id].patch.ts           # PATCH /api/admin/sources/:id
│   │           └── [id].delete.ts          # DELETE /api/admin/sources/:id
│   ├── utils/
│   │   ├── auth.ts                         # MODIFY: add requireAdminSession()
│   │   ├── repositories/
│   │   │   └── sources.ts                  # MODIFY: add admin CRUD + failure bookkeeping
│   │   └── services/
│   │       ├── ingest.ts                   # MODIFY: failure/success bookkeeping, autoDisabled count
│   │       └── sourceAdmin.ts              # NEW: create/update/delete orchestration + validation
│
├── pages/
│   └── admin/
│       └── index.vue                       # NEW: /admin — source table with filters + toggle + create + delete
│
├── layouts/
│   └── admin.vue                           # NEW: admin shell with token-gate + noindex meta
│
├── components/
│   └── admin/                              # NEW subtree
│       ├── AdminTokenGate.vue              # NEW: single-field token prompt (stored in session cookie)
│       ├── SourceTable.vue                 # NEW: list + filters + sort
│       ├── SourceRow.vue                   # NEW: single row with toggle / delete actions
│       ├── SourceFormDialog.vue            # NEW: create/edit form (headless UI dialog)
│       ├── ConfirmDeleteDialog.vue         # NEW: delete confirmation (warns if articleCount > 0)
│       └── AdminEmptyState.vue             # NEW: first-use placeholder
│
├── composables/
│   ├── useAdminAuth.ts                     # NEW: client-side cookie set/get + logout
│   └── useAdminSources.ts                  # NEW: wraps /api/admin/sources fetch + mutations
│
├── stores/
│   └── adminSources.ts                     # NEW: Pinia store (list, filters, CRUD optimistic updates)
│
├── types/
│   ├── dto.ts                              # MODIFY: add admin DTOs + IngestResponseDTO.autoDisabled
│   └── domain.ts                           # (no change)
│
├── tests/
│   ├── api/
│   │   ├── admin-sources.spec.ts           # NEW: CRUD + 401 + delete-with-articles warning
│   │   └── ingest.spec.ts                  # MODIFY: failCount increment + auto-disable path
│   ├── unit/
│   │   └── source-admin.spec.ts            # NEW: validation (ISO-2, topic, URL), delete-count
│   └── e2e/
│       └── admin-flow.spec.ts              # NEW: token gate → list → toggle → create → delete
│
└── .env.example                            # MODIFY: document cookie name + INGEST_SECRET dual use
```

---

## 2. DB Schema Changes (Feature F)

### 2.1 Prisma model delta

```prisma
model Source {
  id          Int       @id @default(autoincrement())
  countryCode String
  topicSlug   String
  name        String
  feedUrl     String    @unique
  enabled     Boolean   @default(true)

  // --- NEW (Feature F) ---
  failCount     Int       @default(0)   // consecutive fetch-failure counter
  lastFailedAt  DateTime?               // most recent failure timestamp
  disabledAt    DateTime?               // non-null iff auto-disabled (audit trail)
  // --- NEW (Feature E) ---
  createdAt     DateTime  @default(now())

  country  Country   @relation(fields: [countryCode], references: [code])
  topic    Topic     @relation(fields: [topicSlug], references: [slug])
  articles Article[]

  @@index([countryCode, topicSlug])
  @@index([enabled, disabledAt])        // NEW: used by admin list filter
}

model Article {
  // ...existing fields...
  source Source @relation(fields: [sourceId], references: [id], onDelete: Cascade)  // MODIFY: add Cascade
}
```

### 2.2 Migration semantics

- Migration name: `20260424_source_autodisable`
- **Additive only.** All new columns are nullable or have defaults → zero downtime.
- Command: `pnpm prisma migrate dev --name source_autodisable` (local), `prisma migrate deploy` in CI/CD.
- Cascade FK change SQL: `ALTER TABLE "Article" DROP CONSTRAINT "Article_sourceId_fkey", ADD CONSTRAINT "Article_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE CASCADE ON UPDATE CASCADE;`

### 2.3 Failure semantics matrix

| Event | `enabled` | `failCount` | `disabledAt` | `lastFailedAt` |
|-------|-----------|-------------|--------------|----------------|
| Fetch success | unchanged | reset to `0` | unchanged | unchanged |
| Fetch failure, count < 5 after increment | unchanged (true) | +1 | unchanged (null) | set to `now()` |
| Fetch failure, count == 5 after increment | set to `false` | 5 | set to `now()` | set to `now()` |
| Admin re-enables | set to `true` | reset to `0` | reset to `null` | unchanged |
| Admin disables manually | set to `false` | unchanged | unchanged (null — distinguishes manual from auto) | unchanged |

**Invariant:** `disabledAt IS NOT NULL` → `enabled = false`. The reverse is NOT true (manual disable leaves `disabledAt = null`).

### 2.4 Threshold constant

```ts
const AUTO_DISABLE_THRESHOLD = 5  // server/utils/services/ingest.ts
```

---

## 3. API Contract (DTO delta)

All additions go to `types/dto.ts`. Existing shapes unchanged.

### 3.1 Admin source DTOs (NEW)

```ts
export interface AdminSourceDTO {
  id: number
  countryCode: IsoCountryCode
  topicSlug: TopicSlug
  name: string
  feedUrl: string
  enabled: boolean
  failCount: number
  lastFailedAt: string | null     // ISO-8601 or null
  disabledAt: string | null       // ISO-8601 or null (null = manual or never disabled)
  articleCount: number            // count of linked Article rows (for delete warning)
  createdAt: string               // ISO-8601
}

export interface AdminSourcesQueryDTO {
  country?: IsoCountryCode
  topic?: TopicSlug
  enabled?: 'true' | 'false' | 'all'          // default 'all'
  disabled?: 'auto' | 'manual' | 'any'         // auto = disabledAt != null; manual = enabled=false && disabledAt=null
}

export interface AdminSourcesResponseDTO {
  items: AdminSourceDTO[]
  total: number
}

export interface AdminSourceCreateDTO {
  countryCode: IsoCountryCode    // must exist in Country table
  topicSlug: TopicSlug
  name: string                   // 1..120 chars
  feedUrl: string                // valid http(s) URL, unique
}

export interface AdminSourcePatchDTO {
  enabled?: boolean              // if true → also resets failCount=0, disabledAt=null
  name?: string                  // 1..120 chars
  // feedUrl/countryCode/topicSlug intentionally NOT patchable (delete+recreate)
}

export interface AdminSourceDeleteResponseDTO {
  id: number
  deletedArticles: number
}
```

### 3.2 IngestResponseDTO extension (Feature F)

```ts
export interface IngestResponseDTO {
  fetched: number
  inserted: number
  updated: number
  failedSources: IngestFailure[]
  autoDisabled: number           // NEW: sources that crossed the threshold this run
  durationMs: number
}
```

### 3.3 Endpoint contracts

| Method | Path | Auth | Body | Response | Errors |
|--------|------|------|------|----------|--------|
| `POST` | `/api/admin/session` | — | `{ token: string }` | `{ ok: true }` + Set-Cookie | 401 |
| `POST` | `/api/admin/session/logout` | — | — | `{ ok: true }` + clear cookie | — |
| `GET` | `/api/admin/sources` | cookie | — | `AdminSourcesResponseDTO` | 401, 400 |
| `POST` | `/api/admin/sources` | cookie | `AdminSourceCreateDTO` | `AdminSourceDTO` (201) | 401, 400, 404, 409 |
| `PATCH` | `/api/admin/sources/:id` | cookie | `AdminSourcePatchDTO` | `AdminSourceDTO` | 401, 400, 404 |
| `DELETE` | `/api/admin/sources/:id` | cookie | — | `AdminSourceDeleteResponseDTO` | 401, 404 |

**Validation rules:**
- `countryCode`: `/^[A-Z]{2}$/` + must exist in `Country`. Else 404.
- `topicSlug`: must ∈ `{military, economy, politics}`. Else 400.
- `name`: trimmed length 1..120. Else 400.
- `feedUrl`: valid `http`/`https` URL, unique (409 `CONFLICT` if dup), max 2000 chars.
- `enabled` PATCH with `true`: transactional reset of `failCount=0`, `disabledAt=null`.

---

## 4. Feature F — Ingestion Pipeline Integration

### 4.1 `sources.ts` repository additions

```ts
export async function recordSourceSuccess(id: number): Promise<void>
// SET failCount=0 WHERE id=:id AND failCount > 0 (no-op if already 0)

export async function recordSourceFailure(
  id: number, threshold: number
): Promise<{ autoDisabled: boolean }>
// Atomic increment; if result >= threshold: set enabled=false, disabledAt=now()

export async function listAdminSources(filters: AdminSourcesQueryDTO): Promise<AdminSourcesResponseDTO>
export async function findAdminSource(id: number): Promise<AdminSourceDTO | null>
export async function createSource(input: AdminSourceCreateDTO): Promise<AdminSourceDTO>
export async function updateSource(id: number, patch: AdminSourcePatchDTO): Promise<AdminSourceDTO>
export async function deleteSource(id: number): Promise<{ deletedArticles: number }>
// Transactional: count articles, delete source (cascade handles articles), return count
```

### 4.2 `ingest.ts` changes (pseudocode)

```ts
const AUTO_DISABLE_THRESHOLD = 5

// Inside per-source try/catch:
try {
  const feed = await fetchFeed(source.feedUrl)
  // ...existing upsert loop...
  await recordSourceSuccess(source.id)          // NEW
} catch (err) {
  try {
    const { autoDisabled: wasDisabled } =
      await recordSourceFailure(source.id, AUTO_DISABLE_THRESHOLD)  // NEW
    if (wasDisabled) autoDisabled += 1
  } catch { /* DB down — log, continue */ }
  failedSources.push({ ... })
}

return { fetched, inserted, updated, failedSources, autoDisabled, durationMs }
```

**Only feed-level fetch failures bump `failCount`. Per-item upsert failures are silent (content issue, not source health).**

---

## 5. Admin Authentication

### 5.1 Decision: Session cookie over shared secret

**Rejected:** Bearer header (doesn't attach to browser navigation), full OAuth (overkill).

**Chosen:** Session cookie where value = `INGEST_SECRET`.

**Cookie spec:**
- Name: `el_admin`
- Value: `INGEST_SECRET` verbatim
- Attributes: `HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`
- Set by `POST /api/admin/session`; cleared by `POST /api/admin/session/logout`

**Server helper (new export in `server/utils/auth.ts`):**

```ts
export function requireAdminSession(event: H3Event): void {
  const cookie = getCookie(event, 'el_admin') ?? ''
  const expected = useRuntimeConfig(event).ingestSecret as string
  if (!expected || !safeEqual(cookie, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'UNAUTHORIZED', data: { ... } })
  }
}
```

**Two paths, one secret:**
- GH Actions → bearer header → `requireIngestSecret` (unchanged)
- Browser admin → cookie → `requireAdminSession` (new)

**Hardening:**
- `SameSite=Strict` blocks cross-site POSTs (CSRF protection)
- `HttpOnly` blocks JS access to cookie
- `/api/admin/session` rate limit: 5 failed attempts per IP per 10 min → 429 (in-memory LRU)
- `/admin/**` route rule: `robots: false`, `X-Robots-Tag: noindex, nofollow`

---

## 6. Agent Work Scopes

### 6.1 backend-dev — CREATE

- `server/api/admin/session.post.ts`
- `server/api/admin/session/logout.post.ts`
- `server/api/admin/sources.get.ts`
- `server/api/admin/sources.post.ts`
- `server/api/admin/sources/[id].patch.ts`
- `server/api/admin/sources/[id].delete.ts`
- `server/utils/services/sourceAdmin.ts`
- `tests/api/admin-sources.spec.ts`
- `tests/unit/source-admin.spec.ts`

### 6.2 backend-dev — MODIFY

| File | Change |
|------|--------|
| `prisma/schema.prisma` | F fields + `createdAt` + `onDelete: Cascade` on Article |
| `prisma/seed.ts` | G: 10 → 30 countries |
| `server/utils/auth.ts` | Add `requireAdminSession` |
| `server/utils/repositories/sources.ts` | Add 7 new exports |
| `server/utils/services/ingest.ts` | Call bookkeeping; add `autoDisabled` to return |
| `types/dto.ts` | Admin DTOs + `IngestResponseDTO.autoDisabled` |
| `nuxt.config.ts` | `/admin/**` + `/api/admin/**` routeRules |
| `.env.example` | Document `el_admin` cookie + dual use of `INGEST_SECRET` |
| `tests/api/ingest.spec.ts` | Auto-disable assertions |

### 6.3 frontend-dev — CREATE

- `pages/admin/index.vue`
- `layouts/admin.vue`
- `components/admin/AdminTokenGate.vue`
- `components/admin/SourceTable.vue`
- `components/admin/SourceRow.vue`
- `components/admin/SourceFormDialog.vue`
- `components/admin/ConfirmDeleteDialog.vue`
- `components/admin/AdminEmptyState.vue`
- `composables/useAdminAuth.ts`
- `composables/useAdminSources.ts`
- `stores/adminSources.ts`
- `tests/e2e/admin-flow.spec.ts`

### 6.4 frontend-dev — MODIFY

| File | Change |
|------|--------|
| `pages/about.vue` | G editorial caveat: state-affiliated sources note |

**Boundary rule:** frontend-dev: no `server/**`, `prisma/**`. backend-dev: no `pages/**`, `components/**`. `types/dto.ts` — backend-dev writes first, commits before frontend-dev starts.

---

## 7. Admin UI Flow

### 7.1 `/admin` page sections

1. **Header** (`layouts/admin.vue`): "EarthLetter Admin" + logout + link to `/`
2. **Filter bar**: country dropdown + topic dropdown + enabled filter (`All | Enabled | Manually disabled | Auto-disabled`)
3. **"Add source" button** → opens `SourceFormDialog`
4. **SourceTable** columns: Name, Country, Topic, feedUrl (truncated), Enabled (toggle), Fail count (badge; red ≥ 3), Last failed (relative time), Articles (count), Actions (edit name, delete)
5. **EmptyState** when filter yields zero results

### 7.2 Toggle semantics

- OFF → ON: PATCH `{ enabled: true }` → server resets `failCount=0`, `disabledAt=null`. Optimistic UI: flip immediately, rollback on error.
- ON → OFF: PATCH `{ enabled: false }` → `disabledAt` stays null (manual, not auto).

### 7.3 Delete flow

1. Click "Delete" → `ConfirmDeleteDialog` opens
2. If `articleCount === 0`: "Delete source {name}?"
3. If `articleCount > 0`: "Delete source {name}? This will also delete {articleCount} archived articles. This cannot be undone."
4. Confirm → DELETE → toast with `deletedArticles` count → store removes row

### 7.4 AdminTokenGate UX

1. User visits `/admin` with no cookie → `AdminTokenGate` renders (input + submit)
2. Submit POSTs to `/api/admin/session` → on 200, client navigates to reload
3. "Log out" button: POST to `/api/admin/session/logout` + reload

---

## 8. Feature G — Country Coverage Expansion

### 8.1 Target: 10 → 30 countries, ≥90 sources

Retain all existing 10 countries and 60 sources.

| Region | Added countries |
|--------|----------------|
| Asia-Pacific (+5) | AU, NZ, SG, PH, ID |
| Europe (+5) | IT, ES, NL, PL, UA |
| Americas (+4) | CA, BR, MX, AR |
| Middle East (+3) | AE, SA, TR |
| Africa (+3) | ZA, NG, EG |

All feeds English-language. Each new country: minimum 3 sources (one per topic).
All unverified URLs ship with `// REVIEW:` comment.

### 8.2 Editorial caveat (pages/about.vue)

Add one sentence:
> "Some sources are state-affiliated. EarthLetter does not endorse content; we aggregate headlines across perspectives."

### 8.3 Seed strategy

`seed.ts` uses upsert semantics → re-running is idempotent. Existing rows preserved.

Post-seed: manually trigger `/api/ingest` to backfill articles for new sources.

---

## 9. Rendering Strategy (delta)

```ts
routeRules: {
  '/admin/**': {
    ssr: true,
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow'
    },
    robots: false
  },
  '/api/admin/**': {
    cors: false,
    headers: {
      'Cache-Control': 'no-store, private',
      'X-Robots-Tag': 'noindex, nofollow'
    },
    robots: false
  }
}
```

---

## 10. Risks

| # | Risk | Mitigation |
|---|------|-----------|
| F-1 | Race condition on `failCount` increment (parallel ingest runs) | Prisma `{ increment: 1 }` is atomic at row level; double-disable is idempotent |
| F-2 | DB-down during ingest makes `recordSourceFailure` throw, aborting the run | Wrap in inner try/catch; log and continue |
| F-3 | Threshold=5 too tight for rate-limited feeds | Monitor first 2 weeks; admin can re-enable trivially |
| E-1 | `INGEST_SECRET` leak compromises both ingest and admin | Document rotation procedure in `.env.example` |
| E-2 | Cookie stores secret directly | `HttpOnly` + `Secure` + `SameSite=Strict`; accept for MVP |
| E-4 | Rate-limit LRU resets on cold start | Accept for MVP; escalate to Redis if brute-force becomes concern |
| E-5 | Hard delete loses articles permanently | Confirm dialog; articles re-populate from RSS |
| G-1 | RSS rot in 60 new feeds | Feature E (admin UI) + Feature F (auto-disable) provide self-healing |

### 10.1 Open questions for human review

- **Auto-disable threshold (5):** "5 consecutive failures ≈ 5h of outage" — acceptable?
- **Cookie lifetime (24h):** Tighter (1h) or looser (7d)?
- **Hard delete vs. soft delete:** Hard delete recommended for MVP.
- **Admin UI language:** English-only recommended.

---

## 11. Implementation Sequencing

1. **Day 0 (serial, backend-dev):**
   - `prisma/schema.prisma` migration
   - `types/dto.ts` admin DTOs + `autoDisabled`
   - Commit → frontend-dev unblocks

2. **Day 1+ (parallel):**
   - backend-dev: repositories, services, routes, ingest bookkeeping, tests, seed (G)
   - frontend-dev: admin layout, pages, components, composables, stores, e2e

3. **Convergence:** dev server + migration + seed → E2E: login → add source → force 5 failures → auto-disable → re-enable → delete

---

**End of blueprint v1.1.** Any ambiguity — return to architect.
