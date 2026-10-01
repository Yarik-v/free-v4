import { KNOWN_ISSUE_ANNOTATION } from '../src/reporters/runSummary';
import { test, expect, openCatalog, firstContinueWatchingLink } from './fixtures';

/**
 * Coverage for opening playback from a "Продолжить просмотр" (continue watching)
 * card, which links straight to the player. Confirmed live, this ends one of
 * three real ways: it plays; it answers "Контент не доступен" (content not
 * available — same shape as the Free API's `playFreeContent` 403 case); or the
 * player hits a fatal stream error and silently bounces back to the catalog
 * with no message at all. Which one a run hits depends on live backend/CDN
 * state, not on this test's code, so all three pass — the test catches a hang
 * or a broken flow — but the silent one is recorded as a known issue so it
 * still shows up in the report.
 */
test.describe('player', () => {
  test('a continue-watching title plays or ends in a known unavailable outcome', async ({ page }) => {
    await openCatalog(page, 'START');

    const link = await firstContinueWatchingLink(page);
    test.skip(!link, 'No "Продолжить просмотр" items for this service on this account right now.');

    await link!.click();

    // Confirmed live, the player shell (#videoPlayer — a decorative background
    // <video class="w-100"> also exists on this page, hence the id scope) does
    // NOT reliably mount before an outcome is known: sometimes it renders and
    // then the error toast overlays it, sometimes the toast alone appears
    // without the player ever mounting. So there's no shared "shell is visible"
    // precondition to assert first — just poll straight for whichever outcome
    // actually happens.
    const video = page.locator('video#videoPlayer');
    const unavailable = page.getByText('Контент не доступен');

    // Confirmed via trace (fatal hls.js `manifestLoadError`, a 404 on the signed
    // stream URL, in the console right before this happens): the silent outcome
    // shows up as the URL reaching /watch/ and then leaving it again without the
    // toast — hence `reachedPlayer`, since the current URL alone can't tell
    // "bounced back" apart from "hasn't navigated yet".
    // `video.evaluate()` waits (with no timeout) for the element to attach, so
    // once we've bounced back and it's gone for good, an unguarded evaluate()
    // call would hang for the rest of the poll's budget instead of ever
    // re-checking — confirmed via a trace where exactly that happened (a single
    // poll tick stuck on evaluate() for the full 15s). `count()` doesn't wait,
    // so it's checked first and evaluate() is only called when there's actually
    // an element to read from.
    type Outcome = 'playing' | 'unavailable-message' | 'unavailable-silent' | 'pending';
    let reachedPlayer = false;
    const checkOutcome = async (): Promise<Outcome> => {
      if (await unavailable.isVisible()) return 'unavailable-message';
      if (!/\/watch\//.test(page.url())) return reachedPlayer ? 'unavailable-silent' : 'pending';
      reachedPlayer = true;
      if ((await video.count()) === 0) return 'pending';
      const readyState = await video.evaluate((el: HTMLVideoElement) => el.readyState).catch(() => 0);
      return readyState > 0 ? 'playing' : 'pending';
    };

    // `as Outcome`, not `: Outcome`: TS would otherwise narrow this to 'pending'
    // and, blind to the assignment inside the poll callback, reject the check below.
    let outcome = 'pending' as Outcome;
    await expect.poll(async () => (outcome = await checkOutcome()), { timeout: 15_000 }).not.toBe('pending');

    if (outcome === 'unavailable-silent') {
      test.info().annotations.push({
        type: KNOWN_ISSUE_ANNOTATION,
        description:
          'Player silently returned to the catalog with no message (fatal hls.js manifestLoadError) instead of showing "Контент не доступен".',
      });
    }
  });
});
