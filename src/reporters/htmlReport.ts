import { mkdirSync, writeFileSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, Suite } from '@playwright/test/reporter';
import { host } from '../config';
import { collectRunSummary, lastAttemptErrors, lastAttemptStdout, lastAttemptTracePath } from './runSummary';

const OUT_PATH = 'test-results/latest.html';

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

/**
 * Single self-contained HTML file, overwritten every run on purpose: this is a
 * quick at-a-glance view of the MOST RECENT run only, not a history — if you need
 * to compare against an earlier failure, that's what terminal scrollback (or
 * re-running) is for. A big red/green status banner with the run time, then one
 * card per FAILED test with its full error, code-frame snippet, captured stdout
 * and trace path. Passing tests are only a number in the banner — unlike
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
    const { tests, passed, skipped, flaky, failures, durationSec } = collectRunSummary(this.rootSuite, this.startedAt);

    const ok = failures.length === 0;
    const statusColor = ok ? '#1e7e34' : '#b02a2a';
    const statusText = ok ? 'ALL PASSED' : `${failures.length} FAILED`;
    const startedLabel = this.startedAt.toLocaleString();

    const cards = failures
      .map((test) => {
        const errorsHtml = lastAttemptErrors(test)
          .map((e) => `<pre>${escapeHtml([e.message, e.snippet].filter(Boolean).join('\n\n'))}</pre>`)
          .join('\n');

        const stdout = lastAttemptStdout(test);
        const stdoutHtml = stdout.trim()
          ? `<div class="section-label">stdout</div><pre>${escapeHtml(stdout.trimEnd())}</pre>`
          : '';

        const tracePath = lastAttemptTracePath(test);
        const traceHtml = tracePath
          ? `<div class="trace">Trace: <code>npx playwright show-trace ${escapeHtml(tracePath)}</code></div>`
          : '';

        return `
    <div class="card">
      <div class="card-title">✘ ${escapeHtml(test.titlePath().slice(1).join(' › '))}</div>
      <div class="card-loc">${escapeHtml(test.location.file)}:${test.location.line}</div>
      ${errorsHtml || '<p><em>(no error details captured)</em></p>'}
      ${stdoutHtml}
      ${traceHtml}
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
  .section-label { color: #666; font-size: 0.8em; text-transform: uppercase; letter-spacing: 0.04em; margin-top: 10px; }
  .trace { margin-top: 10px; font-size: 0.85em; color: #444; }
  .trace code { background: #fafafa; border: 1px solid #eee; border-radius: 4px; padding: 2px 6px; }
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
