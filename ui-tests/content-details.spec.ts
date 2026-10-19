import { test, expect, openFirstTitleDetails, titleBanner, titleHeading, WATCH_BUTTON_NAME } from './fixtures';

/**
 * Coverage for the title details page (/home/itm) opened from a dashboard
 * card. Assertions target the `.banner__info__content` block confirmed live
 * (title/tags/description/ratings/buttons — same class names for both a
 * movie and a series, checked on real titles of each kind) rather than exact
 * copy, since which title is "first" depends on the live dashboard — the
 * same discover-don't-hardcode approach as dashboard.spec.ts.
 */
test.describe('content details', () => {
  test('shows title, genres/year, description and ratings', async ({ page }) => {
    await openFirstTitleDetails(page);

    const info = titleBanner(page);
    await expect(titleHeading(page)).not.toBeEmpty();
    await expect(info.locator('.tags')).not.toBeEmpty();
    await expect(info.locator('.description')).not.toBeEmpty();

    // Not asserting specific numbers (Kinopoisk/IMDb scores, age rating
    // change per title) — just that the block itself renders.
    await expect(info.locator('.ratings')).toBeVisible();

    await expect(page.getByRole('button', { name: WATCH_BUTTON_NAME })).toBeVisible();
  });

  test('description tab shows the cast', async ({ page }) => {
    await openFirstTitleDetails(page);

    // "Описание" is the default active tab for a movie, but a series
    // defaults to "Серии" instead (confirmed live on "Холод") — clicked
    // explicitly rather than assumed already active, so this works for both.
    await page.getByText('Описание', { exact: true }).click();
    await expect(page.getByText('Актеры:', { exact: true })).toBeVisible();
  });

  test('trailers tab renders without navigating away', async ({ page }) => {
    await openFirstTitleDetails(page);
    const url = page.url();

    // The tab stays hidden until the title's trailers have loaded, several
    // seconds after the tab bar itself (confirmed live: still hidden at +3 s,
    // shown by +6 s), and for a title with no trailers it never shows. So wait
    // for it, and skip rather than fail only if it never appears.
    const trailersTab = page.locator('.tabs .item', { hasText: /^\s*Трейлеры\s*$/ });
    const hasTrailers = await trailersTab.waitFor({ timeout: 10_000 }).then(
      () => true,
      () => false,
    );
    test.skip(!hasTrailers, 'This title has no trailers, so its Трейлеры tab never showed up.');

    await trailersTab.click();

    // The tab itself must switch: an unchanged URL alone would also pass if the
    // click did nothing. The URL is checked once the tab has reacted, so a route
    // change the click triggers has had its chance to land.
    await expect(page.locator('.tabs .item.active', { hasText: 'Трейлеры' })).toBeVisible();
    expect(page.url()).toBe(url);
  });

  test('back button returns to the dashboard', async ({ page }) => {
    await openFirstTitleDetails(page);

    // A plain, unlabelled div (`.btn--back`, confirmed live) — not a link or
    // an accessible button, so it's targeted by class rather than role/name.
    await titleBanner(page).locator('.btn--back').click();
    await page.waitForURL('/home');
  });
});
