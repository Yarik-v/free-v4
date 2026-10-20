import { KNOWN_ISSUE_ANNOTATION } from '../src/reporters/runSummary';
import { test, expect, firstContinueWatchingLink, openFirstTitleDetails, WATCH_BUTTON_NAME } from './fixtures';

/**
 * Coverage for opening playback. Starts from a "Продолжить просмотр" (continue
 * watching) card on the dashboard, which links straight to the player: taken
 * from the dashboard's own row, which covers every service, rather than one
 * service's catalog page, which only has the row while that service has something
 * in progress. An account with nothing in progress has no such row at all, so
 * the test then opens the first title's details page and presses its "Смотреть"
 * button instead, which leads to the same /watch/ player rather than skipping.
 * Confirmed live, this ends one of three real ways: it plays; it answers
 * "Контент не доступен" (content not available — same shape as the Free API's
 * `playFreeContent` 403 case); or the player hits a fatal stream error and
 * silently bounces back to the previous page with no message at all. Which one a
 * run hits depends on live backend/CDN state, not on this test's code, so all
 * three pass — the test catches a hang or a broken flow — but the silent one is
 * recorded as a known issue so it still shows up in the report.
 */
test.describe('player', () => {
  test('a title opened from the dashboard plays or ends in a known unavailable outcome', async ({ page }) => {
    const continueLink = await firstContinueWatchingLink(page);
    if (continueLink) {
      await continueLink.click();
    } else {
      await openFirstTitleDetails(page);
      await page.getByRole('button', { name: WATCH_BUTTON_NAME }).click();
    }

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
          'Player silently returned to the previous page with no message (fatal hls.js manifestLoadError) instead of showing "Контент не доступен".',
      });
    }
  });
});
