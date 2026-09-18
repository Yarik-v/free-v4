import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';
import { host } from '../config';
import { collectRunSummary, lastAttemptErrors, lastAttemptStdout, lastAttemptTracePath } from './runSummary';

/**
 * Minimal reporter for local runs: prints the run's start time and a pass/fail/skip
 * summary, then full detail ONLY for tests that actually failed — no per-passing-test
 * noise. Pairs with `./htmlReport.ts` (same failure data, rendered as a static page);
 * neither replaces `use.trace` — a failed test's trace.zip is still written, and its
 * path is printed below so it stays inspectable via `playwright show-trace`.
 */
export default class FailuresOnlyReporter implements Reporter {
  private startedAt = new Date();
  private rootSuite!: Suite;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.startedAt = new Date();
    this.rootSuite = suite;
    console.log(`\nRun started: ${this.startedAt.toLocaleString()} (host: ${host})`);
  }

  onEnd(_result: FullResult): void {
    const { tests, passed, skipped, flaky, failures, durationSec } = collectRunSummary(this.rootSuite, this.startedAt);

    console.log(
      `${tests.length} tests — ${passed} passed, ${skipped} skipped, ${failures.length} failed` +
        (flaky > 0 ? `, ${flaky} flaky` : '') +
        ` (${durationSec}s)\n`,
    );

    if (failures.length === 0) {
      console.log('No failures.');
      return;
    }

    console.log(`FAILED (${failures.length}):`);
    for (const test of failures) {
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✘ ${test.titlePath().slice(1).join(' › ')}`);
      console.log(`  ${test.location.file}:${test.location.line}\n`);

      const errors = lastAttemptErrors(test);
      if (errors.length === 0) console.log('  (no error details captured)');
      errors.forEach(({ message, snippet }, i) => {
        if (i > 0) console.log('');
        if (message) for (const line of message.split('\n')) console.log(`  ${line}`);
        if (snippet) {
          console.log('');
          for (const line of snippet.split('\n')) console.log(`  ${line}`);
        }
      });

      const stdout = lastAttemptStdout(test);
      if (stdout.trim()) {
        console.log('\n  stdout:');
        for (const line of stdout.trimEnd().split('\n')) console.log(`  ${line}`);
      }

      const tracePath = lastAttemptTracePath(test);
      if (tracePath) console.log(`\n  Trace: npx playwright show-trace ${tracePath}`);
    }
    console.log(`${'='.repeat(80)}\n`);
  }
}
