import { test, expect } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';

const NO_SAMPLE_CONTENT = 'No title with a live details_url found on the dashboard right now.';

test.describe('GET /content/{service}/{id}', () => {
  test('returns full details for a title discovered from the dashboard', async ({ sampleContent, sampleContentDetails }) => {
    test.skip(!sampleContent, NO_SAMPLE_CONTENT);
    const { service, id, card } = sampleContent!;
    const { res, body } = sampleContentDetails!;

    expect(res.status()).toBe(200);
    expectRateLimitHeaders(res);
    expectCacheControlHeader(res);
    expectCorsHeader(res);
    expectValidSchema('contentDetails', body);

    expect(body.id).toBe(id);
    expect(body.service).toBe(service);
    expect(body.kind).toBe(card.kind);
  });

  test('has no favorites, trailers or viewing history, per the free API contract', async ({
    sampleContent,
    sampleContentDetails,
  }) => {
    test.skip(!sampleContent, NO_SAMPLE_CONTENT);
    test.skip(sampleContentDetails!.res.status() !== 200, 'Discovered title is not currently available.');
    const { body } = sampleContentDetails!;

    expect(body.favorite).toBe(false);
    expect(body.trailers).toEqual([]);
    expect(body.images.logo).toBeNull();
    expect(body.progress).toMatchObject({ position: 0, completed: false, updated_at: null });
  });

  test('series episodes are grouped into seasons with sequential numbers', async ({
    sampleContent,
    sampleContentDetails,
  }) => {
    test.skip(!sampleContent, NO_SAMPLE_CONTENT);
    test.skip(sampleContent!.card.kind !== 'series', 'Discovered sample title is a movie, not a series.');
    test.skip(sampleContentDetails!.res.status() !== 200, 'Discovered title is not currently available.');
    const { body } = sampleContentDetails!;

    expect(body.seasons.length).toBeGreaterThan(0);
    for (const season of body.seasons) {
      expect(season.episode_count).toBe(season.episodes.length);
      season.episodes.forEach((episode, index) => expect(episode.number).toBe(index + 1));
    }
  });

  test('unknown title id in a known service answers 404', async ({ api }) => {
    const res = await api.getContentDetails('mediateka', 'does-not-exist-00000000');
    expect(res.status()).toBe(404);
    expectRateLimitHeaders(res);
    expectValidSchema('error', await res.json());
  });

  test('a service outside the documented enum answers 404, same as an unknown title', async ({ api }) => {
    const res = await api.getContentDetails('not-a-real-service', '5e9d6980f43c0361fb0fea72');
    expect(res.status()).toBe(404);
    expectValidSchema('error', await res.json());
  });
});

test.describe('GET /content/{service}/free/{id}/play', () => {
  test('the details play_url resolves to a playable stream or a 403, matching `playable`', async ({
    api,
    sampleContent,
    sampleContentDetails,
  }) => {
    test.skip(!sampleContent, NO_SAMPLE_CONTENT);
    test.skip(sampleContentDetails!.res.status() !== 200, 'Discovered title is not currently available.');
    const { service, id } = sampleContent!;
    const { body: details } = sampleContentDetails!;

    const playRes = await api.playFreeContent(service, id);
    expectRateLimitHeaders(playRes);

    if (details.play_url) {
      expect([200, 403]).toContain(playRes.status());
      if (playRes.status() === 200) {
        expectValidSchema('playbackStream', await playRes.json());
      } else {
        expectValidSchema('error', await playRes.json());
      }
    } else {
      expect(playRes.status()).toBe(404);
    }
  });

  test('unknown title id answers 404', async ({ api }) => {
    const res = await api.playFreeContent('mediateka', 'does-not-exist-00000000');
    expect(res.status()).toBe(404);
  });
});
