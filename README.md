# Kartina.TV Free API — Playwright test suite

API tests (Playwright's `request` fixture, no browser) for the public, anonymous
[Free API](https://pages.kartina.tv/middleware/docs/free/) — `https://free-dashboard.kartina.tv/free/v4`.
No authentication is required; `POST /login` is included only because the docs describe it
as part of the client start-up sequence.

## Setup

```bash
npm install
cp .env.example .env
```

## Running

```bash
npm test              # run the whole suite (headless, no browser needed)
npm run test:ui       # Playwright's UI mode
npm run report        # open the last HTML report
npm run typecheck     # tsc --noEmit
```

Point the suite at a different environment by setting `API_HOST` in `.env`
(`free-dashboard.kartina.tv`, `free-dashboard-dev.kartina.tv`, or `localhost` — the values
allowed by the `host` server variable in `spec/openapi.yaml`).

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

## CI

`.github/workflows/api-tests.yml` runs the suite on every push/PR to `main`, on a
`workflow_dispatch`, and on a `0 */6 * * *` schedule — the scheduled run is what catches
the live API drifting from its documented contract between manual pushes. It's a single
job: checkout, `npm ci`, `npm run typecheck`, `npm test` (no `playwright install` step —
this suite only uses `request`, never a browser). The `playwright-report/` HTML report and
`test-results/junit.xml` are uploaded as artifacts on every run, pass or fail.

## Notes on scope

- The API's rate limit (900 req/min/IP) is not exercised deliberately — the suite doesn't
  hammer the shared production limit just to see a `429`; the `X-RateLimit-*` headers are
  still asserted on every request that's made.
- Stream URLs are signed per request and expire quickly, so tests only assert on their
  shape/schema, never store or replay one.
