# Kartina.TV Free API — Playwright test suite

Two Playwright projects:

- **`free-api`** — HTTP-only tests (Playwright's `request` fixture, no browser) for the
  public, anonymous [Free API](https://pages.kartina.tv/middleware/docs/free/) —
  `https://free-dashboard.kartina.tv/free/v4`. No authentication is required; `POST /login`
  is included only because the docs describe it as part of the client start-up sequence.
- **`browser-ui`** — end-to-end browser tests against the anonymous web dashboard the API
  backs, `https://play.kartina.tv`. See [ui-tests/](ui-tests/) below.

## Setup

```bash
npm install
cp .env.example .env
npx playwright install chromium   # only needed for the browser-ui project
```

## Running

```bash
npm test                                    # everything (both projects)
npx playwright test --project=free-api      # API tests only, no browser needed
npx playwright test --project=browser-ui    # browser UI tests only
npm run test:ui                             # Playwright's UI mode
npm run report                              # open the last HTML report
npm run typecheck                           # tsc --noEmit
```

Point the API project at a different environment by setting `API_HOST` in `.env`
(`free-dashboard.kartina.tv`, `free-dashboard-dev.kartina.tv`, or `localhost` — the values
allowed by the `host` server variable in `spec/openapi.yaml`). Point the browser project at
a different host by setting `UI_BASE_URL`.

## How it's organized

- `spec/openapi.yaml` — the published OpenAPI document, saved locally. Refresh it with
  `npm run spec:refresh` when the docs change.
- `src/schema/validator.ts` — validates a JSON response against
  `components.schemas.<name>` from `spec/openapi.yaml` (via Ajv), so tests assert against
  the real contract instead of hand-duplicated shape checks.
- `src/api/client.ts` — a thin typed wrapper over Playwright's `APIRequestContext`, one
  method per endpoint. Every method returns the raw `APIResponse` so tests can assert on
  status codes and headers for both success and documented error cases.
- `src/api/types.ts` — response TypeScript types mirroring the schemas.
- `tests/fixtures.ts` — extends Playwright's `test` with an `api` client and worker-scoped
  fixtures (`dashboardPage`, `servicesList`, `settingsBody`, `radioGroupBlock`,
  `sampleContent`, `sampleContentDetails`, `freeRadioChannel`) that fetch real,
  currently-live data once per worker and share it across every test that needs it —
  since the catalogue is dashboard-driven and its ids aren't stable across environments,
  and re-fetching static/shared data per test would waste requests against the shared
  rate limit. Tests that depend on discovered data `test.skip()` themselves when nothing
  matching is currently live; a fixture throws instead of returning `null` when its
  request fails outright, so a real API outage fails the build rather than reporting as
  skipped tests.
- `tests/session`, `tests/catalog`, `tests/interface` mirror the doc's own tag groups
  (Session, Catalog, Interface).
- `ui-tests/` — the `browser-ui` project. Tests the same anonymous experience the API
  backs (dashboard, title details, player, catalog, radio) but through the real web
  client at `https://play.kartina.tv`, not the API directly. Out of scope: anything
  behind login (account, subscriptions, purchases) — `playtest.kartina.tv` is a
  separate, subscriber-only product and isn't tested here. Where a card has no stable
  URL (the dashboard's slider/list items are plain buttons, not links — client-side
  routing), specs assert on accessible role/text rather than hardcoding a title, the
  same discover-don't-hardcode approach `tests/fixtures.ts` uses for live API data.

### Browser UI tests: session

Even though the Free API itself needs no auth, a completely fresh, cookie-less
visit to `UI_BASE_URL` (the actual web client) lands on a login/landing page
instead of the dashboard — reaching `/home` needs *some* session, and there's no
public URL that bootstraps one anonymously (the "Бесплатная версия" link on that
landing page just goes to the marketing site, `www.kartina.tv`; it isn't a guest
login). This looks like a real gap between the documented anonymous API and the
web client's actual behavior, worth raising with whoever owns the frontend rather
than working around it further here.

Until that's resolved, `ui-tests/fixtures.ts` needs a saved session to run past
the landing page. Generate your own locally (never commit it — already
`.gitignore`d):

```bash
npx playwright codegen --save-storage=ui-tests/.auth/storageState.json "$UI_BASE_URL"
```

Log in in the window that opens, then close it — `playwright.config.ts` picks up
`ui-tests/.auth/storageState.json` automatically if it exists. Without it, every
`browser-ui` test `test.skip()`s itself with a clear reason instead of timing out.

## CI

`.github/workflows/typecheck.yml` runs `npm run typecheck` on every push/PR to `main` and
on `workflow_dispatch`. It does **not** run the suite itself: GitHub-hosted runners sit on
datacenter IP ranges the live API rejects outright — a real run confirmed every endpoint
answering `403` from a GitHub Actions runner, not just geo-filtered VOD content (session
and catalog endpoints that carry no geo logic failed identically), so the API's edge
protection is blocking the runner's network, not the requests themselves. Until CI can
reach the API from an allowed network, the live suite (`npm test`) stays a local/manual
run. Options considered, to revisit later:

- a self-hosted runner inside Kartina.TV's own network (or anywhere on an allowed IP);
- allowlisting GitHub Actions' published IP ranges at whatever sits in front of the API;
- pointing CI at `free-dashboard-dev.kartina.tv` instead, if that host isn't behind the
  same protection.

`playwright.config.ts` still switches to the `github`/`junit`/`html` reporters under
`CI=true` (e.g. `CI=true npm test` locally), so re-enabling a live-test CI job later is
just adding the job back — no config changes needed.

The `browser-ui` project is untested against CI for the same likely reason (not yet
confirmed) — `play.kartina.tv` probably sits behind the same kind of edge protection as
the API host. `.github/workflows/typecheck.yml` doesn't install a Chromium binary, so it
couldn't run `browser-ui` even if it tried.

## Notes on scope

- The API's rate limit (900 req/min/IP) is not exercised deliberately — the suite doesn't
  hammer the shared production limit just to see a `429`; the `X-RateLimit-*` headers are
  still asserted on every request that's made.
- Stream URLs are signed per request and expire quickly, so tests only assert on their
  shape/schema, never store or replay one.
