import { test as base, expect, type Locator, type Page } from '@playwright/test';
import type { ServiceId } from '../src/api/types';
import { assertValidUiBaseUrl } from '../src/config';

/**
 * Matches both "Смотреть" (watch) and "Продолжить: HH:MM" (continue watching,
 * shown once the account has progress on a title) — the two valid states of
 * the same button. Shared so the dashboard's readiness wait and every spec
 * asserting on this button test the exact same label, not two copies that
 * could silently drift apart if the UI copy ever changes.
 */
export const WATCH_BUTTON_NAME = /^(Смотреть|Продолжить)/;

/**
 * Hovers a top-nav dropdown item (Видеотека/Радио/Телевидение/...) to open it.
 * Scoped to `header .item.dropdown-icon` rather than a plain text locator: a
 * hidden, unrelated popover elsewhere on the page can contain the exact same
 * label text (confirmed live for "Радио", inside the "Телевидение" dropdown's
 * own channel-category list) — a strict-mode violation without this scope.
 * Matched exactly but whitespace-tolerant: a nav item's real textContent has
 * surrounding spaces (confirmed live, `" Радио "`), which a bare `^label$`
 * misses, while a plain substring match would also hit any future item whose
 * label merely contains this one.
 */
export async function hoverNavDropdown(page: Page, label: string): Promise<void> {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await page.locator('header .item.dropdown-icon', { hasText: new RegExp(`^\\s*${escaped}\\s*$`) }).hover();
}

/**
 * The title-details banner (movie or series at /home/itm, /favorites/itm, or a
 * station's /radio/{id} page — same banner component throughout): heading,
 * tags, description, ratings, buttons, back button.
 */
export function titleBanner(page: Page): Locator {
  return page.locator('.banner__info__content');
}

/**
 * The banner's own heading. `.title` alone is far too generic to use directly —
 * it's reused by nav category tabs and by every dropdown popover row, including
 * hidden ones already in the DOM (confirmed live: 32 matches on one details
 * page without the banner scope).
 */
export function titleHeading(page: Page): Locator {
  return titleBanner(page).locator('.title');
}

/** Every radio station link — the "Радио" nav dropdown's entries and the station page's own list. */
export function radioStationLinks(page: Page): Locator {
  return page.locator('a[href^="/radio/"]');
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
      assertValidUiBaseUrl();
      // A consentmanager.net cookie banner slides up over the bottom ~260px of
      // the page right after load and intercepts every click there (tabs, the
      // radio play button). Whenever it's visible before an action, this
      // dismisses it with "Отклонить все" (reject all), however late it appears.
      // `.cmpboxbtnno` is the CMP's own class for that button, independent of the
      // banner's language.
      await page.addLocatorHandler(page.locator('#cmpbox'), async (banner) => {
        await banner.locator('.cmpboxbtnno').click();
      });
      await page.goto('/home');
      // Waits for whichever shows up first rather than checking the login field
      // once: with no cookies the site redirects to /login before `load`, but an
      // expired saved session can reach /home first and only bounce to the
      // login page once its first API call is rejected.
      const loginField = page.getByPlaceholder('Номер абонемента');
      const watchButton = page.getByRole('button', { name: WATCH_BUTTON_NAME }).first();
      await loginField.or(watchButton).first().waitFor();
      test.skip(
        await loginField.isVisible(),
        'No valid session — see README "Browser UI tests: session" to (re)generate ui-tests/.auth/storageState.json.',
      );
      await use();
    },
    { auto: true },
  ],
});

/**
 * Opens a service's catalog page (e.g. `startru` → /vod/startru) via an in-app
 * click, not `page.goto()`: a direct full-page navigation to `/vod/{service}`
 * bounces back to `/home` — confirmed live, the SPA doesn't hydrate that route
 * from a cold load, only from client-side routing. Picks the menu entry by its
 * href, not its visible name: two entries are both named "Медиатека"
 * (`mediateka` and `mediatekafree`). Call after `dashboardHome` (an auto
 * fixture, so any test using `test` from this module already has it).
 */
export async function openCatalog(page: Page, serviceId: ServiceId): Promise<void> {
  await hoverNavDropdown(page, 'Видеотека');
  await page.locator(`header a[href="/vod/${serviceId}"]`).click();
  await page.waitForURL(`**/vod/${serviceId}`);
}

/**
 * The first card in the current catalog page's "Продолжить просмотр" row, if
 * the account has one: real `<a class="card-item" href="/watch/{service}/...">`
 * links going straight to the player rather than to a details page (not all
 * of them carry a `t=` resume position, so that can't be used to find them).
 * `null` when the row isn't on the page, i.e. nothing is in progress for this
 * service right now.
 *
 * Waits for the row's title before deciding: like the dashboard, the catalog
 * page's shell renders before its rows' data does, so an immediate check can
 * miss a row that's still loading. Once the row is there, its card must render,
 * so a broken row fails instead of turning into a skip.
 */
export async function firstContinueWatchingLink(page: Page): Promise<Locator | null> {
  const rowTitle = page.locator('.block-title', { hasText: /^\s*Продолжить просмотр\s*$/ });
  const hasRow = await rowTitle.waitFor({ timeout: 10_000 }).then(
    () => true,
    () => false,
  );
  if (!hasRow) return null;
  // The row's container is the title's grandparent (title → header bar → row,
  // the same block structure as the dashboard's rows), so only its own cards count.
  const link = rowTitle.locator('xpath=../..').locator('a.card-item[href^="/watch/"]').first();
  await link.waitFor();
  return link;
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
  const link = radioStationLinks(page).first();
  await link.waitFor();
  await link.click();
  await page.waitForURL(/\/radio\//);
}

export { expect };
