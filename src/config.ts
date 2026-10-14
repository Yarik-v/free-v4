// Env values are read here but validated by each project's own fixtures (see
// `assertValidApiHost` / `assertValidUiBaseUrl`), not at import: playwright.config.ts
// imports this module for every run, so throwing here would let a bad UI_BASE_URL
// break an API-only run (and a bad API_HOST a browser-only one).

const ALLOWED_HOSTS = ['free-dashboard.kartina.tv', 'free-dashboard-dev.kartina.tv', 'localhost'] as const;

const host = process.env.API_HOST ?? 'free-dashboard.kartina.tv';
// Trailing slash matters: APIRequestContext resolves relative request paths against
// this URL per WHATWG URL rules, so without it "login" would resolve to
// "https://{host}/free/login" instead of "https://{host}/free/v4/login".
export const baseURL = `https://${host}/free/v4/`;
export const fixturePageSlug = process.env.FIXTURE_PAGE_SLUG ?? 'dashboard';

/** Throws a clear error unless `API_HOST` is one of the hosts spec/openapi.yaml allows. */
export function assertValidApiHost(): void {
  if (!(ALLOWED_HOSTS as readonly string[]).includes(host)) {
    throw new Error(`API_HOST must be one of ${ALLOWED_HOSTS.join(', ')}, got "${host}"`);
  }
}

/**
 * Base URL of the web client the Free API backs, for browser UI tests. `playtest`
 * (not `play`) is the deliberate default — same naming pattern as
 * `free-dashboard-dev.kartina.tv` for the API: `playtest` is the test/staging host.
 */
export const uiBaseUrl = process.env.UI_BASE_URL ?? 'https://playtest.kartina.tv';

/** Throws a clear error unless `UI_BASE_URL` is a full URL (a bare host fails much later, less clearly). */
export function assertValidUiBaseUrl(): void {
  if (!/^https?:\/\/[^/]/.test(uiBaseUrl)) {
    throw new Error(`UI_BASE_URL must be a full URL such as https://playtest.kartina.tv, got "${uiBaseUrl}"`);
  }
}
