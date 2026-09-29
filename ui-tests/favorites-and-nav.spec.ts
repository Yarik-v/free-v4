import { test, expect } from './fixtures';

/**
 * Coverage for /favorites and the remaining top-nav surface not already
 * exercised by openCatalog/openFirstRadioStation (Видеотека, Радио).
 *
 * The plan assumed /favorites opens empty for an anonymous visitor — moot
 * here (see README "Browser UI tests: session"): this is a real subscriber
 * session, and the account already has real favorites, so this asserts on
 * what's actually there instead.
 */
test.describe('favorites', () => {
  test('shows real favorited titles and opens one', async ({ page }) => {
    await page.getByRole('link', { name: 'Избранное' }).first().click();
    await page.waitForURL('/favorites');

    // Grouped by service ("Видеотеки" section); tiles are plain divs, not
    // real anchors — same "no href" shape as the dashboard's own hero slider
    // (confirmed live) — so this needs a real click rather than an href.
    const tiles = page.locator('.video-grid__item');
    await expect(tiles.first()).toBeVisible();
    expect(await tiles.count()).toBeGreaterThan(0);

    await tiles.first().click();
    await page.waitForURL(/\/favorites\/itm/);

    // Same scoped shape as content-details.spec.ts's own heading check —
    // `.title` alone is reused all over this app (see radio.spec.ts).
    await expect(page.locator('.banner__info__content h2.title')).not.toBeEmpty();
  });
});

test.describe('navigation', () => {
  test('Телевидение dropdown lists real channel categories', async ({ page }) => {
    // Out of scope beyond this: the categories here are mostly paid channel
    // groups (see the plan) — this only confirms the dropdown itself is real
    // and populated, the same light check already done for Видеотека/Радио.
    await page.locator('header .item.dropdown-icon', { hasText: 'Телевидение' }).hover();

    const categories = page.locator('a[href^="/tv/group/"]');
    await expect(categories.first()).toBeVisible();
    expect(await categories.count()).toBeGreaterThan(0);
  });

  test('search finds real results', async ({ page }) => {
    const search = page.getByPlaceholder('Поиск');
    await search.click();
    await search.fill('Холод');
    await search.press('Enter');
    await page.waitForURL(/\/search\?q=/);

    await expect(page.locator('.page-title')).toContainText('Холод');

    const results = page.locator('a.video-item__link');
    await expect(results.first()).toBeVisible();
    expect(await results.count()).toBeGreaterThan(0);
  });
});
