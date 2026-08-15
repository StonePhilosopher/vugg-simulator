#!/usr/bin/env node
/**
 * tools/prep-test-bundle.mjs — pretest helper.
 *
 * Walks dist/ once, writes:
 *   dist/.test-bundle.js            — concatenated script-mode sources
 *   dist/.test-bundle-exports.json  — auto-derived top-level decl names
 *
 * The vitest setup reads these so each worker's first file pays one
 * read + Function() instead of 150× readFileSync + a regex scan.
 * Harmless no-op if dist/ is empty (setup.ts will throw the usual hint).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');

function walkDistSorted() {
  const out = [];
  const stack = [DIST];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(d).sort();
    } catch {
      continue;
    }
    for (const name of entries) {
      if (name.startsWith('.')) continue;
      const p = path.join(d, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) stack.push(p);
      else if (name.endsWith('.js')) out.push(p);
    }
  }
  return out.sort((a, b) =>
    path.relative(DIST, a).split(path.sep).join('/').localeCompare(
      path.relative(DIST, b).split(path.sep).join('/'),
    ),
  );
}

if (!fs.existsSync(DIST)) {
  console.log('[prep-test-bundle] no dist/ — skip');
  process.exit(0);
}

const files = walkDistSorted();
if (!files.length) {
  console.log('[prep-test-bundle] dist/ empty — skip');
  process.exit(0);
}

const concatenated = files.map((f) => fs.readFileSync(f, 'utf8')).join('\n\n');
const RE = /^(?:function|const|let|class|var)\s+([A-Za-z_$][\w$]*)/gm;
const found = new Set();
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = RE.exec(src)) !== null) found.add(m[1]);
}

fs.writeFileSync(path.join(DIST, '.test-bundle.js'), concatenated);
fs.writeFileSync(
  path.join(DIST, '.test-bundle-exports.json'),
  JSON.stringify([...found]) + '\n',
);
console.log(
  `[prep-test-bundle] wrote dist/.test-bundle.js (${(concatenated.length / 1024).toFixed(0)} KiB, ${files.length} files, ${found.size} exports)`,
);
