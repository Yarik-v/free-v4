# Test cases — Kartina.TV Free API

Manual test-case catalog for the [Free API](https://pages.kartina.tv/middleware/docs/free/)
(`https://free-dashboard.kartina.tv/free/v4`), mirroring the doc's own tag groups (Session,
Catalog, Interface). The **Automated** column points at the Playwright spec that already
covers a case; `—` means it's a real gap (either not worth automating, or blocked by
something outside this repo — geo/IP, dashboard content edits, or hitting the rate limit
on purpose).

Legend: **P0** = blocks release if broken, **P1** = should work, **P2** = nice to have covered.

**64 cases total, 56 automated, 8 gaps** (`—` in Automated) — the rest need geo/IP control
(2), dashboard-editor access (4), or a deliberate rate-limit exclusion (2); see "Remaining
gaps" below for the breakdown and what each one would take.

## 1. Session

### 1.1 Login — `POST /login`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| LOGIN-01 | Guest login with valid device+serial | P0 | none | POST `/login` with `{device, serial}` | 200; body matches `login` schema; `packet.type == "guest"`, `packet.share_links == null`; `services`/`settings` are `/free/v4/services` / `/free/v4/settings` | `tests/session/login.spec.ts` |
| LOGIN-02 | `push_token` accepted and ignored | P2 | none | POST `/login` with `device`, `serial`, `push_token` | 200; response identical in shape to LOGIN-01 regardless of the token value | `tests/session/login.spec.ts` |
| LOGIN-03 | Same device+serial within 1s → same token | P1 | none | POST `/login` twice, same body, back-to-back | Both 200; if `expire_at` matches (same issue-second), `security` and `login` are identical | `tests/session/login.spec.ts` |
| LOGIN-04 | Missing `device` and `serial` | P0 | none | POST `/login` with `{}` | 422; `validationError` schema; `errors` has exactly `device` and `serial` | `tests/session/login.spec.ts` |
| LOGIN-05 | Missing `device` only | P1 | none | POST `/login` with `{serial}` | 422; `errors` has exactly `device` | `tests/session/login.spec.ts` |
| LOGIN-06 | Missing `serial` only | P1 | none | POST `/login` with `{device}` | 422; `errors` has exactly `serial` | `tests/session/login.spec.ts` |
| LOGIN-07 | `device` at the 255-char boundary | P1 | none | POST `/login` with a 255-char `device` | 200 | `tests/session/login.spec.ts` |
| LOGIN-08 | `device` over the 255-char boundary | P1 | none | POST `/login` with a 256-char `device` | 422; `errors` has `device` | `tests/session/login.spec.ts` |
| LOGIN-09 | `serial` at/over the 255-char boundary | P2 | none | POST `/login` with a 255-char and a 256-char `serial` | Same pattern as LOGIN-07/08 for `serial` | `tests/session/login.spec.ts` |
| LOGIN-10 | Unknown extra field in the body | P2 | none | POST `/login` with `{device, serial, foo: "bar"}` | Spec marks the request schema `additionalProperties: false`, but the live server ignores it — 200 | `tests/session/login.spec.ts` |
| LOGIN-11 | Different devices get different tokens | P2 | none | POST `/login` twice with two distinct `device`/`serial` pairs | `security` values differ | `tests/session/login.spec.ts` |
| LOGIN-12 | Wrong HTTP method | P2 | none | GET `/login` | 405 | `tests/session/login.spec.ts` |
| LOGIN-13 | Rate limit (429) | P2 | able to burst >900 req/min from one IP | Exceed the per-minute budget | 429; `Retry-After` and `X-RateLimit-Reset` present | — (deliberately excluded — see README "Notes on scope") |

### 1.2 Settings — `GET /settings`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| SET-01 | Returns the fixed settings | P0 | none | GET `/settings` | 200; matches `settings` schema | `tests/session/settings.spec.ts` |
| SET-02 | Every stream setting has exactly one allowed option | P1 | none | Inspect `standard`, `server`, `timeshift` | Each `allowed` has length 1, and its `value` equals the setting's own `value` | `tests/session/settings.spec.ts` |
| SET-03 | Catch-up is disabled | P1 | none | Inspect `catchup` | `enabled == 0` | `tests/session/settings.spec.ts` |
| SET-04 | Catch-up window matches documented values | P2 | none | Inspect `catchup.delay` / `catchup.length` | `delay == 60`, `length == 1209480` (per spec example) | `tests/session/settings.spec.ts` |
| SET-05 | No auth required | P1 | none | GET `/settings` with no cookies/headers beyond `Accept` | 200 | Implicit in every test (no auth is ever sent) |

## 2. Catalog

### 2.1 Services — `GET /services`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| SVC-01 | Returns the catalogue, every entry valid | P0 | none | GET `/services` | 200; array; every item matches `service` schema; `id` is one of the documented enum values | `tests/catalog/services.spec.ts` |
| SVC-02 | No subscriptions/credentials on the free tier | P1 | none | Inspect every service | `access == {state: "unsubscribed", subscription_id: null}`; `pages_url`/`credentials_url` are `null` | `tests/catalog/services.spec.ts` |
| SVC-03 | Service ids are unique | P1 | none | Inspect the list | No duplicate `id` | `tests/catalog/services.spec.ts` |
| SVC-04 | A disabled provider shows `status: unavailable` | P2 | a provider disabled in the dashboard | GET `/services` | That service's `status == "unavailable"` | — (needs dashboard access to toggle a provider) |

### 2.2 Content — `GET /content/{service}/{id}` and `GET /content/{service}/free/{id}/play`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| CNT-01 | Full details of a live free title | P0 | at least one free title on the dashboard | GET `/content/{service}/{id}` | 200; matches `contentDetails`; `id`/`service`/`kind` match the source card | `tests/catalog/content.spec.ts` |
| CNT-02 | Anonymous-client fields are fixed | P1 | same as CNT-01 | Inspect the body | `favorite == false`; `trailers == []`; `images.logo == null`; `progress` is a zeroed placeholder | `tests/catalog/content.spec.ts` |
| CNT-03 | Series episodes grouped into seasons | P1 | discovered title is a series | Inspect `seasons` | `episode_count` matches `episodes.length`; episode `number` is sequential from 1 per season | `tests/catalog/content.spec.ts` |
| CNT-04 | Unknown id in a known service | P0 | none | GET `/content/mediateka/does-not-exist` | 404; `error` schema | `tests/catalog/content.spec.ts` |
| CNT-05 | Service outside the documented enum | P1 | none | GET `/content/not-a-real-service/{id}` | 404, same as CNT-04 | `tests/catalog/content.spec.ts` |
| CNT-06 | Title not released in caller's country | P1 | a client IP outside the title's release countries | GET `/content/{service}/{id}` | 403; `error` schema | — (needs a non-default-country client, can't control from here) |
| CNT-07 | Disabled title | P2 | a title disabled in the dashboard | GET `/content/{service}/{id}` | 404 (same as an unknown id — API doesn't distinguish) | — (needs dashboard access) |
| CNT-08 | Play a free title/episode | P0 | discovered title/episode is free | GET `/content/{service}/free/{id}/play` | 200; `playbackStream` schema | `tests/catalog/content.spec.ts` |
| CNT-09 | Play a non-free title | P1 | discovered title is not free | Same call | 403; `error` schema | `tests/catalog/content.spec.ts` |
| CNT-10 | Play an unknown id | P0 | none | GET `/content/mediateka/free/does-not-exist/play` | 404 | `tests/catalog/content.spec.ts` |
| CNT-11 | `premierone` movie has no free stream | P2 | a premierone movie marked free at the title level | Play it | Per docs, premierone serves episodes only from a fixed CDN path; a movie has no free stream at all — confirm the actual response | `tests/catalog/content.spec.ts` (opportunistic — skips if no premierone movie is live) |
| CNT-12 | Stream URL is signed per request | P2 | a free title | Call play twice | The two `url` values differ (fresh ticket each time) | `tests/catalog/content.spec.ts` |
| CNT-13 | Response is cached ~5 min, refreshed on dashboard edit | P2 | dashboard access | Edit the title, re-fetch within/after the cache window | Response reflects the edit only after the cache window, or immediately (docs say refreshed on edit) | — (needs dashboard access + timing control) |

### 2.3 Radio — `GET /pages/radio`, `GET /pages/radio/channel-group`, `GET /channels/{channel}/play`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| RADIO-01 | Radio page layout | P0 | none | GET `/pages/radio` | 200; `page` schema; exactly one `channel_group` item pointing at `/pages/radio/channel-group` | `tests/interface/pages.spec.ts` |
| RADIO-02 | Channel-group block | P0 | none | GET `/pages/radio/channel-group` | 200; `radioGroupBlock` schema; `count == items.length` | `tests/catalog/radio.spec.ts` |
| RADIO-03 | `play_url` present iff `playable` | P1 | none | Inspect every station | `playable: true` ⇒ has `play_url`; otherwise no `play_url` field | `tests/catalog/radio.spec.ts` |
| RADIO-04 | No favorites without an account | P2 | none | Inspect every station | `favorite == false` | `tests/catalog/radio.spec.ts` |
| RADIO-05 | Page and block agree on id/count | P2 | none | Compare `/pages/radio` item vs `/pages/radio/channel-group` | Same `id`, same `count` | `tests/interface/blocks.spec.ts` |
| RADIO-06 | Play a free station | P0 | at least one free station | GET `/channels/{id}/play` | 200; `channelStream` schema; `url` starts with `https://` | `tests/catalog/radio.spec.ts` |
| RADIO-07 | Play an unknown channel | P0 | none | GET `/channels/does-not-exist/play` | 404 | `tests/catalog/radio.spec.ts` |
| RADIO-08 | Play a listed but non-free station | P1 | at least one non-free station | Same call on its id | 404 (API doesn't distinguish "not free" from "unknown" here) | `tests/catalog/radio.spec.ts` |
| RADIO-09 | Stream URL is signed per request | P2 | a free station | Call play twice | The two `url` values differ | `tests/catalog/radio.spec.ts` |

## 3. Interface

### 3.1 Pages — `GET /pages/{slug}`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| PAGE-01 | Dashboard page layout | P0 | none | GET `/pages/dashboard` | 200; `page` schema; every item's `block_url` is `/free/v4/pages/dashboard/blocks/{id}` | `tests/interface/pages.spec.ts` |
| PAGE-02 | `details` page exists in every install | P1 | none | GET `/pages/details` | 200; `slug == "details"` | `tests/interface/pages.spec.ts` |
| PAGE-03 | Unknown slug | P0 | none | GET `/pages/does-not-exist` | 404; `error` schema | `tests/interface/pages.spec.ts` |
| PAGE-04 | `radio` slug is reserved | P2 | dashboard access | Try to create a dashboard page that slugifies to `radio` | Dashboard refuses to create it | — (needs dashboard access) |
| PAGE-05 | Layout carries no per-client item count | P2 | none | Inspect a dashboard `blockSummary` item | No `count` field (unlike the radio page's item, which has one) | `tests/interface/pages.spec.ts` |

### 3.2 Blocks — `GET /pages/{slug}/blocks/{id}`

| ID | Title | Prio | Preconditions | Steps | Expected result | Automated |
|----|-------|------|----------------|-------|------------------|-----------|
| BLK-01 | Every dashboard block matches its declared shape | P0 | none | GET each block listed by `/pages/dashboard` | 200; `block` schema; title-type blocks' items have `details_url`/`playable`; `images` items have `image`/`link`; `promo` has empty `items` | `tests/interface/blocks.spec.ts` |
| BLK-02 | A block resolves the same way under any slug | P1 | at least one dashboard block | GET the same block id under `dashboard` and under `details` | Same status; if 200, identical body | `tests/interface/blocks.spec.ts` |
| BLK-03 | Well-formed but unknown block id | P0 | none | GET a block with a random valid-UUID id | 404; `error` schema | `tests/interface/blocks.spec.ts` |
| BLK-04 | Malformed (non-UUID) block id | P1 | none | GET a block with a non-UUID id | **500** — known live-API bug, not the documented 404 (regression pin, not a spec expectation) | `tests/interface/blocks.spec.ts` |
| BLK-05 | Unknown page slug, valid block id | P1 | at least one dashboard block | GET that block under a random nonexistent slug | 404 | `tests/interface/blocks.spec.ts` |
| BLK-06 | `numeric` block posters carry `badge_num=topN` | P2 | a live `numeric`/`counter` block | Inspect a poster URL's query string | Contains `badge_num=` | `tests/interface/blocks.spec.ts` (opportunistic — skips if no numeric block is live) |
| BLK-07 | `slider` posters are never decorated | P2 | a live `slider` block | Inspect a poster URL | No `badge`/`logo` query params, only resize | `tests/interface/blocks.spec.ts` |
| BLK-08 | `promo` block's `block_data` only has set fields | P2 | a live `promo` block | Inspect `block_data` | Only the fields the dashboard actually set are present | `tests/interface/blocks.spec.ts` (opportunistic — skips if no promo block is live) |
| BLK-09 | Titles not released in caller's country are dropped and not counted | P2 | a title restricted from the caller's country | Fetch a block containing it | Title absent from `items`; `count` excludes it | — (geo-dependent) |

## 4. Cross-cutting

| ID | Title | Prio | Steps | Expected result | Automated |
|----|-------|------|-------|------------------|-----------|
| GEN-01 | Rate-limit headers on every response | P1 | Any request | `X-RateLimit-Limit` and `X-RateLimit-Remaining` present, numeric, limit > 0 | Spot-checked on the primary test of every endpoint |
| GEN-02 | Cache-Control / no ETag | P2 | Any cached-response endpoint (pages, blocks, services, content, radio) | `Cache-Control: no-cache, private`; no `ETag` | Spot-checked on the primary test of every endpoint |
| GEN-03 | CORS header present | P2 | Any request with an `Origin` header | `Access-Control-Allow-Origin` present | Spot-checked on the primary test of every endpoint |
| GEN-04 | Error body shape | P1 | Any documented error case | `{message: string}` (or `{message, errors}` for 422) in the server's locale | Covered per-endpoint wherever a 4xx/5xx is tested |
| GEN-05 | No authentication anywhere | P1 | Any endpoint, no cookies/tokens sent | Succeeds or fails per its own documented logic, never a 401 | Implicit — no test ever sends credentials |
| GEN-06 | 429 on exceeding the rate limit | P2 | Burst >900 req/min from one IP | 429; `error` schema; `Retry-After` + `X-RateLimit-Reset` present | — (deliberately excluded, see README) |

## Remaining gaps

Not gaps in effort — each needs something this black-box test position doesn't have:

- **Geo/IP control** (CNT-06, BLK-09): need a client whose IP resolves to a country the
  title isn't released in. Would need a proxy/VPN into a specific country; not attempted.
- **Dashboard/CMS access** (SVC-04, CNT-07, CNT-13, PAGE-04): need to toggle a provider,
  disable a title, edit a title and observe the cache, or attempt a colliding page slug —
  all editor-side actions with no equivalent read-only API call.
- **Deliberately excluded** (LOGIN-13, GEN-06): triggering a real 429 means bursting past
  900 req/min on production, which the rest of the suite (and anyone else behind the same
  IP) shares. Not done without an explicit go-ahead — see README "Notes on scope".
