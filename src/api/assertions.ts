import type { APIResponse } from '@playwright/test';
import { expect } from '@playwright/test';
import { checkSchema } from '../schema/validator';

/** Asserts `data` matches `components.schemas.<schemaName>` from spec/openapi.yaml. */
export function expectValidSchema(schemaName: string, data: unknown): void {
  const { valid, errors } = checkSchema(schemaName, data);
  expect(valid, errors).toBe(true);
}

/** Every documented response (success and error alike) carries these two headers. */
export function expectRateLimitHeaders(res: APIResponse): void {
  const headers = res.headers();
  expect(headers['x-ratelimit-limit'], 'X-RateLimit-Limit header').toBeDefined();
  expect(headers['x-ratelimit-remaining'], 'X-RateLimit-Remaining header').toBeDefined();
  expect(Number(headers['x-ratelimit-limit'])).toBeGreaterThan(0);
  expect(Number(headers['x-ratelimit-remaining'])).toBeGreaterThanOrEqual(0);
}

export function expectJsonContentType(res: APIResponse): void {
  expect(res.headers()['content-type'] ?? '').toContain('application/json');
}

/**
 * Every cached response (pages, blocks, services, cards, stream targets, per the docs'
 * "Caching" section) is served with a fixed no-store directive and no ETag.
 */
export function expectCacheControlHeader(res: APIResponse): void {
  expect(res.headers()['cache-control']).toBe('no-cache, private');
  expect(res.headers()['etag']).toBeUndefined();
}

/**
 * CORS is documented as open by default ("unless narrowed by configuration"), so this
 * only asserts the header is present, not its exact value — a deployment may narrow it.
 */
export function expectCorsHeader(res: APIResponse): void {
  expect(res.headers()['access-control-allow-origin'], 'Access-Control-Allow-Origin header').toBeTruthy();
}
