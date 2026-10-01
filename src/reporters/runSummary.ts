import { stripVTControlCharacters } from 'node:util';
import type { Suite, TestCase } from '@playwright/test/reporter';

/**
 * Annotation type a test pushes onto `test.info().annotations` when it passes but
 * observed a real, documented product problem it deliberately tolerates. Both
 * reporters list these even on an all-green run, since they otherwise only show
 * failures and the problem would be invisible.
 */
export const KNOWN_ISSUE_ANNOTATION = 'known-issue';

export interface KnownIssue {
  test: TestCase;
  description: string;
}

export interface RunSummary {
  tests: TestCase[];
  passed: number;
  skipped: number;
  flaky: number;
  failures: TestCase[];
  knownIssues: KnownIssue[];
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
  const knownIssues: KnownIssue[] = [];

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
        continue;
    }
    for (const { type, description } of test.annotations) {
      if (type === KNOWN_ISSUE_ANNOTATION) knownIssues.push({ test, description: description ?? '' });
    }
  }

  return { tests, passed, skipped, flaky, failures, knownIssues, durationSec };
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
