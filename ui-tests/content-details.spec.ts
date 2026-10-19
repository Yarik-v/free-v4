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

    // A title with no trailers keeps the tab in the DOM but hidden (confirmed
    // live, e.g. genre collections like "Боевики"), and which title comes first
    // on the dashboard changes, so skip rather than fail when it isn't shown.
    // Waits for the always-present "Описание" tab first so the tab bar has rendered.
    await page.locator('.tabs .item', { hasText: /^\s*Описание\s*$/ }).waitFor();
    const trailersTab = page.locator('.tabs .item', { hasText: /^\s*Трейлеры\s*$/ });
    test.skip(!(await trailersTab.isVisible()), 'This title has no trailers, so its Трейлеры tab is hidden.');

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
