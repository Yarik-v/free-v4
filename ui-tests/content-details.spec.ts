import { test, expect, openFirstTitleDetails, titleHeading, WATCH_BUTTON_NAME } from './fixtures';

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

    const info = page.locator('.banner__info__content');
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

    await page.getByText('Трейлеры', { exact: true }).click();

    // Not every title has a trailer, so this doesn't assert one is present —
    // only that switching tabs works and stays on the same title.
    expect(page.url()).toBe(url);
  });

  test('back button returns to the dashboard', async ({ page }) => {
    await openFirstTitleDetails(page);

    // A plain, unlabelled div (`.btn--back`, confirmed live) — not a link or
    // an accessible button, so it's targeted by class rather than role/name.
    await page.locator('.banner__info__content .btn--back').click();
    await page.waitForURL('/home');
  });
});
