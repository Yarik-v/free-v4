const ALLOWED_HOSTS = ['free-dashboard.kartina.tv', 'free-dashboard-dev.kartina.tv', 'localhost'] as const;
type Host = (typeof ALLOWED_HOSTS)[number];

function resolveHost(): Host {
  const raw = process.env.API_HOST ?? 'free-dashboard.kartina.tv';
  if (!ALLOWED_HOSTS.includes(raw as Host)) {
    throw new Error(`API_HOST must be one of ${ALLOWED_HOSTS.join(', ')}, got "${raw}"`);
  }
  return raw as Host;
}

export const host = resolveHost();
// Trailing slash matters: APIRequestContext resolves relative request paths against
// this URL per WHATWG URL rules, so without it "login" would resolve to
// "https://{host}/free/login" instead of "https://{host}/free/v4/login".
export const baseURL = `https://${host}/free/v4/`;
export const fixturePageSlug = process.env.FIXTURE_PAGE_SLUG ?? 'dashboard';
