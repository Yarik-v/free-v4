import { test, expect, openCatalog } from './fixtures';

/**
 * Coverage for a service's own catalog page (/vod/{service}). Checked against
 * a few real, differently-branded services rather than iterating the full
 * "Видеотека" dropdown (13 entries live) — enough to confirm the catalog
 * grid itself renders real titles for more than just START (already covered
 * indirectly by player.spec.ts), without turning this into a slow full sweep.
 */
const SERVICES = ['START', 'Wink', 'PREMIER'];

for (const serviceName of SERVICES) {
  test(`${serviceName} catalog shows real titles`, async ({ page }) => {
    await openCatalog(page, serviceName);

    // Card links carry each service's own id (e.g. /vod/startru/title/movie/...,
    // /vod/moretv/title/...) — matched by the shared /title/ segment rather
    // than a specific service id, so this doesn't duplicate SERVICE_IDS from
    // src/api/types.ts just to re-derive what openCatalog already navigated to.
    const cards = page.locator('a.video-item__link[href*="/title/"]');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });
}
