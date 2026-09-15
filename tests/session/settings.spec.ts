import { test, expect } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';

test.describe('GET /settings', () => {
  test('returns the fixed player settings and matches the settings schema', async ({ settingsBody }) => {
    expect(settingsBody.res.status()).toBe(200);
    expectRateLimitHeaders(settingsBody.res);
    expectCacheControlHeader(settingsBody.res);
    expectCorsHeader(settingsBody.res);
    expectValidSchema('settings', settingsBody.body);
  });

  test('every stream setting exposes exactly one selectable option, matching its current value', async ({
    settingsBody,
  }) => {
    const { standard, server, timeshift } = settingsBody.body;
    for (const setting of [standard, server, timeshift]) {
      expect(setting.allowed).toHaveLength(1);
      expect(setting.allowed[0]?.value).toBe(setting.value);
    }
  });

  test('catch-up is disabled, per the free API contract', async ({ settingsBody }) => {
    expect(settingsBody.body.catchup.enabled).toBe(0);
  });
});
