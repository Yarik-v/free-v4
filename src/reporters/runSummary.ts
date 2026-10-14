import { stripVTControlCharacters } from 'node:util';
import type { FullResult, Suite, TestCase, TestError } from '@playwright/test/reporter';

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

export interface RunVerdict {
  text: string;
  tone: 'ok' | 'warn' | 'bad';
}

/**
 * The one-line verdict both reporters lead with. "No test failed" isn't enough:
 * a spec file that fails to load stops Playwright from running anything
 * (confirmed: 0 tests, exit code 1), an interrupted or timed-out run leaves
 * tests unrun, and an all-skipped run verifies nothing. None of those may read
 * as green.
 */
export function runVerdict(summary: RunSummary, status: FullResult['status'], errorCount: number): RunVerdict {
  if (summary.failures.length > 0) return { text: `${summary.failures.length} FAILED`, tone: 'bad' };
  if (status === 'interrupted') return { text: 'RUN INTERRUPTED', tone: 'bad' };
  if (status === 'timedout') return { text: 'RUN TIMED OUT', tone: 'bad' };
  if (status !== 'passed' || errorCount > 0) return { text: 'RUN FAILED — errors outside tests', tone: 'bad' };
  if (summary.passed + summary.flaky === 0) return { text: 'NOTHING PASSED — every test was skipped', tone: 'warn' };
  return { text: 'ALL PASSED', tone: 'ok' };
}

/** An error raised outside any test (e.g. a spec file that fails to load), ANSI stripped. */
export function formatRunError(error: TestError): string {
  const text = [error.stack ?? error.message ?? error.value ?? 'unknown error', error.snippet].filter(Boolean).join('\n\n');
  return stripVTControlCharacters(text);
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

/**
 * Whether the test's project runs with a saved login (`use.storageState`). Its
 * traces then record that session's cookies in the network log (confirmed:
 * hundreds of cookie entries in a single browser-ui trace). Playwright can't leave
 * the network log out of a trace, so reporters warn next to the trace path instead.
 */
export function traceHasSessionCookies(test: TestCase): boolean {
  return Boolean(test.parent.project()?.use.storageState);
}

/**
 * "free-api: free-dashboard.kartina.tv · browser-ui: playtest.kartina.tv": one
 * entry per project that actually has tests in this run, from its own `baseURL`.
 */
export function describeTargets(rootSuite: Suite): string {
  const targets = rootSuite.suites
    .filter((projectSuite) => projectSuite.allTests().length > 0)
    .map((projectSuite) => {
      const project = projectSuite.project();
      const baseURL = project?.use.baseURL;
      // A malformed UI_BASE_URL/API_HOST is reported by the project's own
      // fixtures; here it's just shown as-is rather than crashing the reporter.
      const target = !baseURL ? 'no baseURL' : URL.canParse(baseURL) ? new URL(baseURL).host : baseURL;
      return `${project?.name}: ${target}`;
    });
  return targets.length > 0 ? targets.join(' · ') : 'no tests collected';
}
