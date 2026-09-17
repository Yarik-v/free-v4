import { stripVTControlCharacters } from 'node:util';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError } from '@playwright/test/reporter';
import { host } from '../config';

function printError(error: TestError): void {
  if (error.message) {
    for (const line of stripVTControlCharacters(error.message).split('\n')) {
      console.log(`  ${line}`);
    }
  }
  if (error.snippet) {
    console.log('');
    for (const line of stripVTControlCharacters(error.snippet).split('\n')) {
      console.log(`  ${line}`);
    }
  }
}

/**
 * Minimal reporter for local runs: prints the run's start time and a pass/fail/skip
 * summary, then full detail ONLY for tests that actually failed — no per-passing-test
 * noise. Register alongside (not instead of) `html`/`junit` if a full trace is needed.
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
    const tests = this.rootSuite.allTests();
    const durationSec = ((Date.now() - this.startedAt.getTime()) / 1000).toFixed(1);

    let passed = 0;
    let skipped = 0;
    let flaky = 0;
    const failures: TestCase[] = [];

    for (const test of tests) {
      switch (test.outcome()) {
        case 'skipped':
          skipped++;
          break;
        case 'expected':
          passed++;
          break;
        case 'flaky':
          flaky++;
          break;
        default:
          failures.push(test);
      }
    }

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
      const lastResult = test.results[test.results.length - 1];
      console.log(`\n${'='.repeat(80)}`);
      console.log(`✘ ${test.titlePath().slice(1).join(' › ')}`);
      console.log(`  ${test.location.file}:${test.location.line}\n`);

      const errors = lastResult?.errors ?? [];
      if (errors.length === 0) {
        console.log('  (no error details captured)');
      }
      errors.forEach((error, i) => {
        if (i > 0) console.log('');
        printError(error);
      });

      const stdout = lastResult?.stdout.map((c) => c.toString()).join('') ?? '';
      if (stdout.trim()) {
        console.log('\n  stdout:');
        for (const line of stdout.trimEnd().split('\n')) console.log(`  ${line}`);
      }
    }
    console.log(`${'='.repeat(80)}\n`);
  }
}
