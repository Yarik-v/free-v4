import { test, expect } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';
import type { Page } from '../../src/api/types';

test.describe('GET /pages/{slug}', () => {
  test('dashboard page matches the page schema and every block links to a valid block_url', async ({
    dashboardPage,
  }) => {
    expectValidSchema('page', dashboardPage);
    expect(dashboardPage.slug).toBe('dashboard');

    for (const summary of dashboardPage.items) {
      expect(summary.block_url).toBe(`/free/v4/pages/${dashboardPage.slug}/blocks/${summary.id}`);
    }
  });

  test('returns the documented rate-limit, cache-control and CORS headers', async ({ api }) => {
    const res = await api.getPage('dashboard');
    expect(res.status()).toBe(200);
    expectRateLimitHeaders(res);
    expectCacheControlHeader(res);
    expectCorsHeader(res);
  });

  test('the details page exists in every installation', async ({ api }) => {
    const res = await api.getPage('details');
    expect(res.status()).toBe(200);

    const body: Page = await res.json();
    expectValidSchema('page', body);
    expect(body.slug).toBe('details');
  });

  test('an unknown slug answers 404', async ({ api }) => {
    const res = await api.getPage(`does-not-exist-${Date.now()}`);
    expect(res.status()).toBe(404);
    expectRateLimitHeaders(res);
    expectValidSchema('error', await res.json());
  });

  test('layout items carry no per-client count, unlike the radio page', async ({ dashboardPage }) => {
    for (const summary of dashboardPage.items) {
      expect(summary).not.toHaveProperty('count');
    }
  });
});

test.describe('GET /pages/radio', () => {
  test('returns the single reserved channel_group block', async ({ api }) => {
    const res = await api.getRadioPage();
    expect(res.status()).toBe(200);
    expectRateLimitHeaders(res);

    const body: Page = await res.json();
    expectValidSchema('page', body);

    expect(body.slug).toBe('radio');
    expect(body.items).toHaveLength(1);
    expect(body.items[0]).toMatchObject({ type: 'channel_group', block_url: '/free/v4/pages/radio/channel-group' });
  });
});
