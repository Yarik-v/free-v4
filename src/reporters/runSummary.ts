import { stripVTControlCharacters } from 'node:util';
import type { Suite, TestCase } from '@playwright/test/reporter';

export interface RunSummary {
  tests: TestCase[];
  passed: number;
  skipped: number;
  flaky: number;
  failures: TestCase[];
  durationSec: string;
}

/**
 * Buckets every test in `rootSuite` by outcome, relative to `startedAt`. Shared by
 * every reporter in this directory so they can never disagree on counts or on which
 * tests count as failures.
 */
export function collectRunSummary(rootSuite: Suite, startedAt: Date): RunSummary {
  const tests = rootSuite.allTests();
  const durationSec = ((Date.now() - startedAt.getTime()) / 1000).toFixed(1);

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

  return { tests, passed, skipped, flaky, failures, durationSec };
}

/** The last attempt's errors, message + code-frame snippet, ANSI stripped. Never truncated. */
export function lastAttemptErrors(test: TestCase): Array<{ message?: string; snippet?: string }> {
  const lastResult = test.results[test.results.length - 1];
  return (lastResult?.errors ?? []).map((error) => ({
    message: error.message ? stripVTControlCharacters(error.message) : undefined,
    snippet: error.snippet ? stripVTControlCharacters(error.snippet) : undefined,
  }));
}

/** The last attempt's captured stdout, concatenated to one string (empty if none). */
export function lastAttemptStdout(test: TestCase): string {
  const lastResult = test.results[test.results.length - 1];
  return lastResult?.stdout.map((chunk) => chunk.toString()).join('') ?? '';
}

/** Path to the last attempt's trace.zip, if `use.trace` recorded one. */
export function lastAttemptTracePath(test: TestCase): string | undefined {
  const lastResult = test.results[test.results.length - 1];
  return lastResult?.attachments.find((a) => a.name === 'trace')?.path;
}
