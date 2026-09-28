import { test as base, expect } from '@playwright/test';

/**
 * Shared base for browser UI tests. A fresh, cookie-less visit to `/home` lands
 * on a login/landing page instead of the dashboard — there's no anonymous entry;
 * these tests run against a real (subscriber) session (see README "Browser UI
 * tests: session"). This `goto('/home')` + skip check is an auto fixture so
 * every spec gets one clear skip when there's no session yet, instead of each
 * test timing out on its own first assertion.
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
      await use();
    },
    { auto: true },
  ],
});

export { expect };
