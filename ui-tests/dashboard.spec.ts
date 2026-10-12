import { test, expect, WATCH_BUTTON_NAME } from './fixtures';

/**
 * Smoke coverage for the dashboard at /home. Proves the browser project works
 * end to end before later specs build on it (content details, player, catalog,
 * radio). Assertions stick to accessible roles/text — the slider's title cards
 * are plain buttons with no stable href (client-side routing), so this
 * deliberately doesn't assert on any specific title.
 */
test.describe('/home — dashboard', () => {
  test('loads with the top navigation visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Избранное' }).first()).toBeVisible();
    await expect(page.getByPlaceholder('Поиск')).toBeVisible();
  });

  test('renders the hero slider with real title cards', async ({ page }) => {
    // "Продолжить: HH:MM" instead of "Смотреть" on titles this account already
    // has watch progress on — both are valid, this is a real subscriber session.
    const watchButtons = page.getByRole('button', { name: WATCH_BUTTON_NAME });
    await expect(watchButtons.first()).toBeVisible();
    expect(await watchButtons.count()).toBeGreaterThan(0);
  });

  test('slider pagination advances to the next slide', async ({ page }) => {
    // Not anchored (`^...$`) and polled by raw textContent rather than
    // expect(...).toHaveText(): the counter's "N из M" is split across child
    // nodes, so an exact-match locator/matcher doesn't reliably hit it.
    const counter = page.getByText(/\d+ из \d+/).first();
    await expect(counter).toBeVisible();
    const before = await counter.textContent();

    await page.getByRole('button', { name: 'Next slide' }).click();

    await expect.poll(() => counter.textContent()).not.toBe(before);
  });

  test('renders horizontal title blocks below the slider', async ({ page }) => {
    // Block titles (e.g. "Телехиты: лучшая десятка недели!") are plain
    // `div.block-title`, not headings: every heading on the page is one of the
    // hero slider's own ~20 slide titles, so counting headings proves nothing
    // about the blocks. Asserts a real block plus a real title card instead.
    // Only the first few blocks render on load (the rest lazy-load on scroll),
    // so this checks presence rather than a count.
    await expect(page.locator('.block-title').first()).toBeVisible();
    await expect(page.locator('a.video-item__link[href^="/home/itm"]').first()).toBeVisible();
  });
});
