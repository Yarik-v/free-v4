import { test, expect, openFirstRadioStation } from './fixtures';

/**
 * Coverage for radio. There's no separate "station list" page as the plan
 * assumed (no /tv/group/{id} route here) — confirmed live, the "Радио" nav
 * item is itself a dropdown of real station links, and clicking one goes
 * straight to that station's own page (/radio/{id}), which also repeats the
 * same station list as a horizontal block below the player.
 */
test.describe('radio', () => {
  test('nav dropdown lists real stations', async ({ page }) => {
    // Scoped to the nav item itself, not a plain text locator: a hidden,
    // unrelated popover elsewhere on the page also contains the exact text
    // "Радио" (confirmed live — a strict-mode violation without this scope).
    // A plain substring `hasText`, not an anchored regex: the nav item's
    // real textContent is `" Радио "` with surrounding spaces (confirmed
    // live), which an exact/anchored match misses.
    await page.locator('header .item.dropdown-icon', { hasText: 'Радио' }).hover();

    const stations = page.locator('a[href^="/radio/"]');
    await expect(stations.first()).toBeVisible();
    expect(await stations.count()).toBeGreaterThan(0);
  });

  test('a station page plays and can be paused', async ({ page }) => {
    await openFirstRadioStation(page);

    // `.title` alone is far too generic here — it's reused by nav category
    // tabs and by every dropdown popover row, including hidden ones already
    // in the DOM (confirmed live: 32 matches on this exact page without
    // scoping). `.banner__info__content h2.title` is the same scoped shape
    // already used in content-details.spec.ts for the equivalent heading.
    await expect(page.locator('.banner__info__content h2.title')).not.toBeEmpty();

    // The play/pause button keeps the same class either way — state only
    // shows in its icon (a filled stop-square while playing, a play-triangle
    // once paused; confirmed live the station autoplays on open, so it
    // starts on the stop-square). Diffing the <path> shape before/after a
    // click avoids hardcoding either icon's exact geometry.
    const playButton = page.locator('.play-button');
    const iconBefore = await playButton.locator('svg path').getAttribute('d');

    await playButton.click();

    await expect.poll(() => playButton.locator('svg path').getAttribute('d')).not.toBe(iconBefore);
  });
});
