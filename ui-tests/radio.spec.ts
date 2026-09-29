import { test, expect, hoverNavDropdown, openFirstRadioStation, titleHeading } from './fixtures';

/**
 * Coverage for radio. There's no separate "station list" page as the plan
 * assumed (no /tv/group/{id} route here) — confirmed live, the "Радио" nav
 * item is itself a dropdown of real station links, and clicking one goes
 * straight to that station's own page (/radio/{id}), which also repeats the
 * same station list as a horizontal block below the player.
 */
test.describe('radio', () => {
  test('nav dropdown lists real stations', async ({ page }) => {
    await hoverNavDropdown(page, 'Радио');

    const stations = page.locator('a[href^="/radio/"]');
    await expect(stations.first()).toBeVisible();
    expect(await stations.count()).toBeGreaterThan(0);
  });

  test('a station page plays and can be paused', async ({ page }) => {
    await openFirstRadioStation(page);

    await expect(titleHeading(page)).not.toBeEmpty();

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
