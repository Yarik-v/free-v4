import { test as base, expect, type APIRequestContext, type APIResponse } from '@playwright/test';
import { FreeApiClient } from '../src/api/client';
import { baseURL, fixturePageSlug } from '../src/config';
import type {
  Block,
  ContentCard,
  ContentDetails,
  Page as FreeApiPage,
  RadioCard,
  RadioGroupBlock,
  Service,
  Settings,
} from '../src/api/types';

interface DiscoveredContent {
  service: string;
  id: string;
  card: ContentCard;
}

/** A fetched-once response paired with its parsed body, shared across every test in a worker. */
interface Cached<T> {
  res: APIResponse;
  body: T;
}

interface Fixtures {
  api: FreeApiClient;
}

interface WorkerFixtures {
  workerRequest: APIRequestContext;
  workerApi: FreeApiClient;
  /** GET /pages/{FIXTURE_PAGE_SLUG}, fetched once per worker. */
  dashboardPage: FreeApiPage;
  /** GET /services, fetched once per worker. */
  servicesList: Service[];
  /** GET /settings, fetched once per worker and shared by every settings test. */
  settingsBody: Cached<Settings>;
  /** GET /pages/radio/channel-group, fetched once per worker and shared by every radio test. */
  radioGroupBlock: Cached<RadioGroupBlock>;
  /** Every block listed on the dashboard, fetched once per worker and shared by every test that needs one. */
  dashboardBlocks: Cached<Block>[];
  /**
   * A real `{service, id}` pair discovered by walking the dashboard's title blocks,
   * for tests that need a live content details page. `null` when the dashboard
   * currently has no title block with at least one visible card (tests depending on
   * it should skip rather than fail in that case). Throws if every title block on
   * the page failed to load, since that signals an outage rather than "nothing free
   * today".
   */
  sampleContent: DiscoveredContent | null;
  /** GET /content/{service}/{id} for `sampleContent`, fetched once and shared by every test that needs it. */
  sampleContentDetails: Cached<ContentDetails> | null;
  /** A station with a play_url from `radioGroupBlock`, or null if none is free right now. */
  freeRadioChannel: RadioCard | null;
}

export const test = base.extend<Fixtures, WorkerFixtures>({
  api: async ({ request }, use) => {
    await use(new FreeApiClient(request));
  },

  workerRequest: [
    async ({ playwright }, use) => {
      const context = await playwright.request.newContext({
        baseURL,
        extraHTTPHeaders: { Accept: 'application/json' },
      });
      await use(context);
      await context.dispose();
    },
    { scope: 'worker' },
  ],

  workerApi: [
    async ({ workerRequest }, use) => {
      await use(new FreeApiClient(workerRequest));
    },
    { scope: 'worker' },
  ],

  dashboardPage: [
    async ({ workerApi }, use) => {
      const res = await workerApi.getPage(fixturePageSlug);
      if (!res.ok()) {
        throw new Error(`Fixture setup failed: GET /pages/${fixturePageSlug} returned ${res.status()}`);
      }
      await use(await res.json());
    },
    { scope: 'worker' },
  ],

  servicesList: [
    async ({ workerApi }, use) => {
      const res = await workerApi.getServices();
      if (!res.ok()) {
        throw new Error(`Fixture setup failed: GET /services returned ${res.status()}`);
      }
      await use(await res.json());
    },
    { scope: 'worker' },
  ],

  settingsBody: [
    async ({ workerApi }, use) => {
      const res = await workerApi.getSettings();
      if (!res.ok()) {
        throw new Error(`Fixture setup failed: GET /settings returned ${res.status()}`);
      }
      await use({ res, body: await res.json() });
    },
    { scope: 'worker' },
  ],

  radioGroupBlock: [
    async ({ workerApi }, use) => {
      const res = await workerApi.getRadioChannelGroupBlock();
      if (!res.ok()) {
        throw new Error(`Fixture setup failed: GET /pages/radio/channel-group returned ${res.status()}`);
      }
      await use({ res, body: await res.json() });
    },
    { scope: 'worker' },
  ],

  dashboardBlocks: [
    async ({ workerApi, dashboardPage }, use) => {
      const results: Cached<Block>[] = [];
      const failures: string[] = [];

      for (const summary of dashboardPage.items) {
        const res = await workerApi.getPageBlock(dashboardPage.slug, summary.id);
        if (!res.ok()) {
          failures.push(`${summary.id}: ${res.status()}`);
          continue;
        }
        results.push({ res, body: await res.json() });
      }

      if (results.length === 0 && dashboardPage.items.length > 0) {
        throw new Error(`Fixture setup failed: every dashboard block request errored (${failures.join(', ')})`);
      }

      await use(results);
    },
    { scope: 'worker' },
  ],

  sampleContent: [
    async ({ dashboardBlocks }, use) => {
      // No need to filter by block type first: a title-bearing item is simply one
      // with a details_url, regardless of which block type carries it.
      let found: DiscoveredContent | null = null;
      for (const { body: block } of dashboardBlocks) {
        const card = block.items.find(
          (item): item is ContentCard => 'details_url' in item && Boolean(item.details_url),
        );
        if (card) {
          found = { service: card.service, id: card.id, card };
          break;
        }
      }
      await use(found);
    },
    { scope: 'worker' },
  ],

  sampleContentDetails: [
    async ({ workerApi, sampleContent }, use) => {
      if (!sampleContent) {
        await use(null);
        return;
      }
      const res = await workerApi.getContentDetails(sampleContent.service, sampleContent.id);
      await use({ res, body: await res.json() });
    },
    { scope: 'worker' },
  ],

  freeRadioChannel: [
    async ({ radioGroupBlock }, use) => {
      await use(radioGroupBlock.body.items.find((item) => item.playable && item.play_url) ?? null);
    },
    { scope: 'worker' },
  ],
});

export { expect };
