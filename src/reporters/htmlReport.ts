import { mkdirSync, writeFileSync } from 'node:fs';
import { stripVTControlCharacters } from 'node:util';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestError } from '@playwright/test/reporter';
import { host } from '../config';

const OUT_PATH = 'test-results/latest.html';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/** Full message plus the code-frame snippet, if Playwright captured one — nothing truncated. */
function renderError(error: TestError): string {
  const parts: string[] = [];
  if (error.message) parts.push(stripVTControlCharacters(error.message));
  if (error.snippet) parts.push(stripVTControlCharacters(error.snippet));
  return escapeHtml(parts.join('\n\n'));
}

/**
 * Single self-contained HTML file, overwritten every run: a big red/green status
 * banner with the run time, then one card per FAILED test with its full error and
 * code-frame snippet. Passing tests are only a number in the banner — unlike
 * Playwright's own `html` reporter, this never lists a test that didn't fail.
 */
export default class HtmlReporter implements Reporter {
  private startedAt = new Date();
  private rootSuite!: Suite;

  onBegin(_config: FullConfig, suite: Suite): void {
    this.startedAt = new Date();
    this.rootSuite = suite;
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

    const ok = failures.length === 0;
    const statusColor = ok ? '#1e7e34' : '#b02a2a';
    const statusText = ok ? 'ALL PASSED' : `${failures.length} FAILED`;
    const startedLabel = this.startedAt.toLocaleString();

    const cards = failures
      .map((test) => {
        const lastResult = test.results[test.results.length - 1];
        const errorsHtml = (lastResult?.errors ?? [])
          .map((error) => `<pre>${renderError(error)}</pre>`)
          .join('\n');
        return `
    <div class="card">
      <div class="card-title">✘ ${escapeHtml(test.titlePath().slice(1).join(' › '))}</div>
      <div class="card-loc">${escapeHtml(test.location.file)}:${test.location.line}</div>
      ${errorsHtml || '<p><em>(no error details captured)</em></p>'}
    </div>`;
      })
      .join('\n');

    const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Test run — ${startedLabel}</title>
<style>
  body { font-family: -apple-system, system-ui, sans-serif; margin: 0; padding: 24px; background: #f5f5f5; color: #222; }
  .banner { background: ${statusColor}; color: white; padding: 20px 24px; border-radius: 8px; margin-bottom: 20px; }
  .banner h1 { margin: 0 0 4px; font-size: 1.4em; }
  .banner .meta { opacity: 0.9; font-size: 0.95em; }
  .card { background: white; border-left: 4px solid ${statusColor}; border-radius: 6px; padding: 14px 18px; margin-bottom: 14px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .card-title { font-weight: 600; margin-bottom: 4px; }
  .card-loc { color: #666; font-size: 0.85em; margin-bottom: 8px; font-family: monospace; }
  pre { background: #fafafa; border: 1px solid #eee; border-radius: 4px; padding: 10px; overflow-x: auto; font-size: 0.85em; white-space: pre-wrap; margin: 8px 0; }
  .empty { color: #1e7e34; font-weight: 600; }
</style>
</head>
<body>
  <div class="banner">
    <h1>${statusText}</h1>
    <div class="meta">${startedLabel} · host: ${host} · ${tests.length} tests · ${passed} passed · ${skipped} skipped · ${failures.length} failed${flaky > 0 ? ` · ${flaky} flaky` : ''} · ${durationSec}s</div>
  </div>
  ${ok ? '<p class="empty">No failures. ✅</p>' : cards}
</body>
</html>
`;

    mkdirSync('test-results', { recursive: true });
    writeFileSync(OUT_PATH, html, 'utf8');
    console.log(`\nHTML report: ${OUT_PATH}`);
  }
}
