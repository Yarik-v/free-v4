import { test, expect } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';
import { SERVICE_IDS } from '../../src/api/types';

test.describe('GET /services', () => {
  test('returns the service catalogue and every entry matches the service schema', async ({ api }) => {
    const res = await api.getServices();
    expect(res.status()).toBe(200);
    expectRateLimitHeaders(res);
    expectCacheControlHeader(res);
    expectCorsHeader(res);

    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);

    for (const service of body) {
      expectValidSchema('service', service);
      expect(SERVICE_IDS).toContain(service.id);
    }
  });

  test('has no subscriptions or external credentials, per the free API contract', async ({ servicesList }) => {
    for (const service of servicesList) {
      expect(service.access).toEqual({ state: 'unsubscribed', subscription_id: null });
      expect(service.pages_url).toBeNull();
      expect(service.credentials_url).toBeNull();
    }
  });

  test('service ids are unique', async ({ servicesList }) => {
    const ids = servicesList.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
