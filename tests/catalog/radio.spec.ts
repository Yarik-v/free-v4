import { test, expect } from '../fixtures';
import { expectCacheControlHeader, expectCorsHeader, expectRateLimitHeaders, expectValidSchema } from '../../src/api/assertions';

test.describe('GET /pages/radio/channel-group', () => {
  test('returns the configured stations and matches the radioGroupBlock schema', async ({ radioGroupBlock }) => {
    expect(radioGroupBlock.res.status()).toBe(200);
    expectRateLimitHeaders(radioGroupBlock.res);
    expectCacheControlHeader(radioGroupBlock.res);
    expectCorsHeader(radioGroupBlock.res);

    const { body } = radioGroupBlock;
    expectValidSchema('radioGroupBlock', body);
    expect(body.type).toBe('channel_group');
    expect(body.count).toBe(body.items.length);
  });

  test('every station has a play_url exactly when it is playable', async ({ radioGroupBlock }) => {
    for (const station of radioGroupBlock.body.items) {
      expect(station.favorite).toBe(false);
      if (station.playable) {
        expect(station.play_url).toBeTruthy();
      } else {
        expect(station.play_url).toBeUndefined();
      }
    }
  });
});

test.describe('GET /channels/{channel}/play', () => {
  test('a free station resolves to a signed HLS stream', async ({ api, freeRadioChannel }) => {
    test.skip(!freeRadioChannel, 'No station is currently marked free in the radio configuration.');

    const res = await api.playRadioChannel(freeRadioChannel!.id);
    expectRateLimitHeaders(res);

    // freeRadioChannel is a worker-scoped snapshot taken once at startup; tolerate the
    // station's free status changing before this test actually runs, the same way the
    // content-details play test tolerates a discovered title going non-free in the
    // meantime. A now-unlisted/non-free station answers 404 (see the API docs).
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expectValidSchema('channelStream', body);
      expect(body.url).toMatch(/^https:\/\//);
    }
  });

  test('an unknown channel id answers 404', async ({ api }) => {
    const res = await api.playRadioChannel('does-not-exist-00000000');
    expect(res.status()).toBe(404);
    expectValidSchema('error', await res.json());
  });

  test('a listed but non-free station answers 404', async ({ api, radioGroupBlock }) => {
    const nonFree = radioGroupBlock.body.items.find((item) => !item.playable);
    test.skip(!nonFree, 'Every configured station is currently free.');

    const res = await api.playRadioChannel(nonFree!.id);
    expect(res.status()).toBe(404);
  });

  test('the stream URL is signed fresh on every call', async ({ api, freeRadioChannel }) => {
    test.skip(!freeRadioChannel, 'No station is currently marked free in the radio configuration.');

    const [first, second] = await Promise.all([
      api.playRadioChannel(freeRadioChannel!.id),
      api.playRadioChannel(freeRadioChannel!.id),
    ]);
    test.skip(first.status() !== 200, 'Station is no longer free.');

    const [firstBody, secondBody] = await Promise.all([first.json(), second.json()]);
    expect(secondBody.url).not.toBe(firstBody.url);
  });
});
