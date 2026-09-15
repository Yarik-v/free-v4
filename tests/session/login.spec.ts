import { test, expect } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';
import type { LoginResponse, ValidationError } from '../../src/api/types';

test.describe('POST /login', () => {
  test('signs a device in as a guest and matches the login schema', async ({ api }) => {
    const res = await api.login({ device: 'playwright-suite', serial: `pw-${Date.now()}` });
    expect(res.status()).toBe(200);
    expectRateLimitHeaders(res);
    expectCacheControlHeader(res);
    expectCorsHeader(res);

    const body: LoginResponse = await res.json();
    expectValidSchema('login', body);

    expect(body.services).toBe('/free/v4/services');
    expect(body.settings).toBe('/free/v4/settings');
    expect(body.packet).toMatchObject({ type: 'guest', share_links: null });
  });

  test('accepts and ignores push_token', async ({ api }) => {
    const res = await api.login({
      device: 'playwright-suite',
      serial: `pw-${Date.now()}`,
      push_token: 'a3dda5212a608ed800b14e12d549b59177a9024da271b3330f11c34112f188ea',
    });
    expect(res.status()).toBe(200);
  });

  test('two logins of the same device within one second return the same security token', async ({ api }) => {
    const body = { device: 'playwright-suite', serial: `pw-${Date.now()}` };
    const [first, second] = await Promise.all([api.login(body), api.login(body)]);
    expect(first.status()).toBe(200);
    expect(second.status()).toBe(200);

    const [firstJson, secondJson]: LoginResponse[] = await Promise.all([first.json(), second.json()]);
    expect(secondJson.security).toBe(firstJson.security);
    expect(secondJson.login).toBe(firstJson.login);
  });

  test('rejects a request missing device and serial with 422', async ({ api }) => {
    const res = await api.loginRaw({});
    expect(res.status()).toBe(422);

    const body: ValidationError = await res.json();
    expectValidSchema('validationError', body);
    expect(Object.keys(body.errors).sort()).toEqual(['device', 'serial']);
  });

  test('rejects a request missing only device with 422', async ({ api }) => {
    const res = await api.loginRaw({ serial: `pw-${Date.now()}` });
    expect(res.status()).toBe(422);

    const body: ValidationError = await res.json();
    expectValidSchema('validationError', body);
    expect(Object.keys(body.errors)).toEqual(['device']);
  });

  test('rejects a request missing only serial with 422', async ({ api }) => {
    const res = await api.loginRaw({ device: 'playwright-suite' });
    expect(res.status()).toBe(422);

    const body: ValidationError = await res.json();
    expectValidSchema('validationError', body);
    expect(Object.keys(body.errors)).toEqual(['serial']);
  });

  test('accepts a device field of exactly 255 characters (the documented boundary)', async ({ api }) => {
    const res = await api.login({ device: 'x'.repeat(255), serial: `pw-${Date.now()}` });
    expect(res.status()).toBe(200);
  });

  test('rejects a device field longer than 255 characters with 422', async ({ api }) => {
    const res = await api.login({ device: 'x'.repeat(256), serial: `pw-${Date.now()}` });
    expect(res.status()).toBe(422);

    const body: ValidationError = await res.json();
    expect(body.errors).toHaveProperty('device');
  });
});
