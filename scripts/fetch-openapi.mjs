// Refreshes spec/openapi.yaml from the published docs, so schema-driven tests
// stay in sync with the contract without hand-editing the spec.
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_URL = 'https://pages.kartina.tv/middleware/docs/free/openapi.yaml';
const OUT_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'spec', 'openapi.yaml');

const res = await fetch(SPEC_URL);
if (!res.ok) {
  throw new Error(`Failed to fetch ${SPEC_URL}: ${res.status} ${res.statusText}`);
}
const text = await res.text();
await writeFile(OUT_PATH, text, 'utf8');
console.log(`Wrote ${OUT_PATH} (${text.length} bytes)`);
