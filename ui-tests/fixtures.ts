import { test as base, expect, type Locator, type Page } from '@playwright/test';

/**
 * Matches both "Смотреть" (watch) and "Продолжить: HH:MM" (continue watching,
 * shown once the account has progress on a title) — the two valid states of
 * the same button. Shared so the dashboard's readiness wait and every spec
 * asserting on this button test the exact same label, not two copies that
 * could silently drift apart if the UI copy ever changes.
 */
export const WATCH_BUTTON_NAME = /^(Смотреть|Продолжить)/;

/**
 * Hovers a top-nav dropdown item (Видеотека/Радио/Телевидение/...) and returns
 * it. Scoped to `header .item.dropdown-icon` rather than a plain text locator:
 * a hidden, unrelated popover elsewhere on the page can contain the exact same
 * label text (confirmed live for "Радио", inside the "Телевидение" dropdown's
 * own channel-category list) — a strict-mode violation without this scope. A
 * plain substring `hasText`, not an anchored regex: a nav item's real
 * textContent has surrounding spaces (confirmed live), which an exact/anchored
 * match misses.
 */
export async function hoverNavDropdown(page: Page, label: string): Promise<void> {
  await page.locator('header .item.dropdown-icon', { hasText: label }).hover();
}

/**
 * The title-details page's own heading (movie or series, at /home/itm,
 * /favorites/itm, or a station's /radio/{id} page — same banner component
 * throughout). `.title` alone is far too generic to use directly — it's
 * reused by nav category tabs and by every dropdown popover row, including
 * hidden ones already in the DOM (confirmed live: 32 matches on one details
 * page without this scope).
 */
export function titleHeading(page: Page): Locator {
  return page.locator('.banner__info__content h2.title');
}

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
      await page.getByRole('button', { name: WATCH_BUTTON_NAME }).first().waitFor();
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
  await hoverNavDropdown(page, 'Видеотека');
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

/**
 * Opens the first title's details page (/home/itm?itm=...&path=...) via an
 * in-app click on a real card link. Confirmed live: row/grid cards below the
 * hero slider are real `<a href="/home/itm?...">` links — unlike the hero
 * slider's own slides, which route via plain buttons with no href (see
 * dashboard.spec.ts) — the same "real anchor, not a plain button" shape as
 * the catalog's continue-watching cards. The click needs to be a real,
 * trusted event: a script-dispatched click on the same element is silently
 * ignored by the SPA's router (confirmed live). Call after `dashboardHome`.
 */
export async function openFirstTitleDetails(page: Page): Promise<void> {
  const link = page.locator('a[href^="/home/itm"]').first();
  await link.waitFor();
  await link.click();
  await page.waitForURL(/\/home\/itm/);
}

/**
 * Opens the first station's page (/radio/{id}) via the "Радио" nav dropdown —
 * same real-link, real-click shape as `openCatalog`/`openFirstTitleDetails`.
 */
export async function openFirstRadioStation(page: Page): Promise<void> {
  await hoverNavDropdown(page, 'Радио');
  const link = page.locator('a[href^="/radio/"]').first();
  await link.waitFor();
  await link.click();
  await page.waitForURL(/\/radio\//);
}

export { expect };
