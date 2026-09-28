import { test as base, expect, type Locator, type Page } from '@playwright/test';

/**
 * Shared base for browser UI tests. A fresh, cookie-less visit to `/home` lands
 * on a login/landing page instead of the dashboard — there's no anonymous entry;
 * these tests run against a real (subscriber) session (see README "Browser UI
 * tests: session"). This `goto('/home')` + skip check is an auto fixture so
 * every spec gets one clear skip when there's no session yet, instead of each
 * test timing out on its own first assertion.
 *
 * It also waits for real hero-slider content before returning: the SPA shell
 * (nav bar included) loads before its data does, so a test that runs right
 * after `goto()` — even after the nav bar appears — can still catch the
 * dashboard mid-skeleton (confirmed via a trace: nav visible, but 0 headings
 * and no slider counter yet, both still shimmer placeholders).
 */
export const test = base.extend<{ dashboardHome: void }>({
  dashboardHome: [
    async ({ page }, use) => {
      await page.goto('/home');
      const needsLogin = await page
        .getByPlaceholder('Номер абонемента')
        .isVisible()
        .catch(() => false);
      test.skip(
        needsLogin,
        'No session yet — see README "Browser UI tests: session" to generate ui-tests/.auth/storageState.json.',
      );
      await page
        .getByRole('button', { name: /^(Смотреть|Продолжить)/ })
        .first()
        .waitFor();
      await use();
    },
    { auto: true },
  ],
});

/**
 * Opens a service's catalog page (e.g. "START" → /vod/startru) via an in-app
 * click, not `page.goto()`: a direct full-page navigation to `/vod/{service}`
 * bounces back to `/home` — confirmed live, the SPA doesn't hydrate that route
 * from a cold load, only from client-side routing. Call after `dashboardHome`
 * (an auto fixture, so any test using `test` from this module already has it).
 */
export async function openCatalog(page: Page, serviceName: string): Promise<void> {
  await page.getByText('Видеотека', { exact: true }).hover();
  await page.getByRole('link', { name: serviceName, exact: true }).click();
  await page.waitForURL(/\/vod\//);
}

/**
 * The first "Продолжить просмотр" card on the current catalog page, if the
 * account has any — these are real `<a href="/watch/{service}/...">` links,
 * unlike the dashboard's own title cards (plain buttons, no href). `null` when
 * there's nothing in progress for this service right now.
 *
 * Waits (briefly) rather than checking `.count()` immediately: like the
 * dashboard, the catalog page's URL/shell updates before this section's own
 * data fetch resolves, so a bare `.count()` right after `openCatalog()` can
 * read 0 even when the account does have continue-watching items.
 */
export async function firstContinueWatchingLink(page: Page): Promise<Locator | null> {
  const link = page.locator('a[href^="/watch/"]').first();
  try {
    await link.waitFor({ timeout: 5_000 });
    return link;
  } catch {
    return null;
  }
}

export { expect };
