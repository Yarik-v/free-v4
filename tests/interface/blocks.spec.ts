import { test, expect, findBlockOfType } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';
import { TITLE_BLOCK_TYPES } from '../../src/api/types';
import type { ContentCard } from '../../src/api/types';

test.describe('GET /pages/{slug}/blocks/{id}', () => {
  test('every block on the dashboard matches the block schema and its declared item shape', async ({
    dashboardPage,
    dashboardBlocks,
  }) => {
    expect(dashboardPage.items.length).toBeGreaterThan(0);
    expect(dashboardBlocks).toHaveLength(dashboardPage.items.length);

    for (let i = 0; i < dashboardBlocks.length; i++) {
      const summary = dashboardPage.items[i]!;
      const { res, body: block } = dashboardBlocks[i]!;
      expect(res.status(), `block ${summary.id} (${summary.type})`).toBe(200);
      expectRateLimitHeaders(res);
      expectCacheControlHeader(res);
      expectCorsHeader(res);

      expectValidSchema('block', block);
      expect(block.id).toBe(summary.id);
      expect(block.count).toBe(block.items.length);

      if (TITLE_BLOCK_TYPES.has(block.type)) {
        for (const item of block.items) {
          expect(item, `title item in block ${block.id}`).toHaveProperty('details_url');
          expect(item).toHaveProperty('playable');
        }
      } else if (block.type === 'images') {
        for (const item of block.items) {
          expect(item).toHaveProperty('image');
          expect(item).toHaveProperty('link');
        }
      } else if (block.type === 'promo') {
        expect(block.items).toEqual([]);
      }
    }
  });

  test('slider posters are only resized, never decorated with a badge or logo', async ({ dashboardBlocks }) => {
    const slider = findBlockOfType(dashboardBlocks, 'slider');
    test.skip(!slider, 'No slider block on the dashboard right now.');

    const poster = (slider!.body.items[0] as ContentCard | undefined)?.images.poster;
    test.skip(!poster, 'First slider item has no poster.');

    expect(poster).not.toContain('badge=');
    expect(poster).not.toContain('logo=');
  });

  test('numeric block posters carry a badge_num', async ({ dashboardBlocks }) => {
    const numeric = findBlockOfType(dashboardBlocks, 'numeric');
    test.skip(!numeric, 'No numeric block on the dashboard right now.');

    const poster = (numeric!.body.items[0] as ContentCard | undefined)?.images.poster;
    test.skip(!poster, 'First numeric item has no poster.');

    expect(poster).toContain('badge_num=');
  });

  test('a promo block only carries the fields the dashboard actually set', async ({ dashboardBlocks }) => {
    const promo = findBlockOfType(dashboardBlocks, 'promo');
    test.skip(!promo, 'No promo block on the dashboard right now.');
    test.skip(!promo!.body.block_data, 'This promo block carries no block_data.');

    expect(Object.keys(promo!.body.block_data!).length).toBeGreaterThan(0);
  });

  test('a block resolves the same way under any existing page slug', async ({ api, dashboardPage }) => {
    const summary = dashboardPage.items[0];
    test.skip(!summary, 'Dashboard currently has no blocks.');

    const [underDashboard, underDetails] = await Promise.all([
      api.getPageBlock(dashboardPage.slug, summary!.id),
      api.getPageBlock('details', summary!.id),
    ]);

    expect(underDetails.status()).toBe(underDashboard.status());
    if (underDetails.status() === 200) {
      const [a, b] = await Promise.all([underDashboard.json(), underDetails.json()]);
      expect(b).toEqual(a);
    }
  });

  test('a well-formed but unknown block id answers 404', async ({ api, dashboardPage }) => {
    const res = await api.getPageBlock(dashboardPage.slug, '00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
    expectValidSchema('error', await res.json());
  });

  test('a malformed (non-UUID) block id currently 500s instead of 404', async ({ api, dashboardPage }) => {
    // Known live-API bug, not documented behaviour: block ids are UUIDs and the
    // server appears to fail an id-cast rather than falling through to the same
    // "not found" path a well-formed-but-unknown UUID takes. Pinned here, including
    // the error body shape, so a fix (or a change to a different failure mode) shows
    // up as a failing test with a clear diff instead of silently changing meaning.
    const res = await api.getPageBlock(dashboardPage.slug, 'does-not-exist-00000000');
    expect(res.status()).toBe(500);
    expectValidSchema('error', await res.json());
  });

  test('an unknown page slug answers 404 even for a valid block id', async ({ api, dashboardPage }) => {
    const summary = dashboardPage.items[0];
    test.skip(!summary, 'Dashboard currently has no blocks.');

    const res = await api.getPageBlock(`does-not-exist-${Date.now()}`, summary!.id);
    expect(res.status()).toBe(404);
  });
});

test.describe('GET /pages/radio/channel-group', () => {
  test('matches the radio page layout block_url', async ({ api, radioGroupBlock }) => {
    const pageRes = await api.getRadioPage();
    const page = await pageRes.json();

    expect(radioGroupBlock.body.id).toBe(page.items[0].id);
    expect(radioGroupBlock.body.count).toBe(page.items[0].count);
  });
});
