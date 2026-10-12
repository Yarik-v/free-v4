import { test, expect, openCatalog } from './fixtures';

/**
 * Coverage for a service's own catalog page (/vod/{service}). Checked against
 * a few real, differently-branded services rather than iterating the full
 * "Видеотека" dropdown (13 entries live) — enough to confirm the catalog
 * grid itself renders real titles for more than just START (already covered
 * indirectly by player.spec.ts), without turning this into a slow full sweep.
 */
const SERVICES = [
  { name: 'START', id: 'startru' },
  { name: 'Wink', id: 'moretv' },
  { name: 'PREMIER', id: 'premierone' },
] as const;

for (const service of SERVICES) {
  test(`${service.name} catalog shows real titles`, async ({ page }) => {
    await openCatalog(page, service.id);

    // Card links carry the service's own id (/vod/startru/title/movie/...,
    // /vod/moretv/title/...), so this also proves the grid shows *this*
    // service's titles, not just any catalog.
    const cards = page.locator(`a.video-item__link[href^="/vod/${service.id}/title/"]`);
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });
}
