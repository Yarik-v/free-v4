import { test, expect } from './fixtures';

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
    const watchButtons = page.getByRole('button', { name: /^(Смотреть|Продолжить)/ });
    await expect(watchButtons.first()).toBeVisible();
    expect(await watchButtons.count()).toBeGreaterThan(0);
  });

  test('slider pagination advances to the next slide', async ({ page }) => {
    const counter = page.getByText(/^\d+ из \d+$/);
    await expect(counter).toBeVisible();
    const before = await counter.textContent();

    await page.getByRole('button', { name: 'Next slide' }).click();

    await expect(counter).not.toHaveText(before ?? '');
  });

  test('renders horizontal title blocks below the slider', async ({ page }) => {
    // Each block has its own heading (e.g. "Телехиты: лучшая десятка недели!");
    // a healthy dashboard has several beyond the slider's own card titles.
    const headings = page.getByRole('heading');
    expect(await headings.count()).toBeGreaterThan(5);
  });
});
