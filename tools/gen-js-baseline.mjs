#!/usr/bin/env node
/**
 * tools/gen-js-baseline.mjs — capture the seed-42 calibration sweep
 * across every scenario and dump it to tests-js/baselines/seed42_v<N>.json.
 *
 * Run after a SIM_VERSION bump that changes seed-42 output:
 *   1. Bump SIM_VERSION in js/15-version.ts.
 *   2. `npm run build`
 *   3. `node tools/gen-js-baseline.mjs`
 *   4. Inspect the diff vs the previous baseline (a few `diff -u` calls
 *      between sequential seed42_v*.json files). Wide spread or
 *      catastrophic drops are red flags.
 *   5. Commit the new baseline alongside the SIM_VERSION-bump commit.
 *
 * The companion test suite (tests-js/calibration.test.ts) reads the
 * baseline matching the current SIM_VERSION and asserts every scenario
 * still produces the same per-mineral counts. CI fails if a chemistry
 * change shifts seed-42 output without updating the baseline — exactly
 * the regression-catch the JS-side harness exists for.
 *
 * Mirrors the logic in tests-js/setup.ts (jsdom + bundle eval + fetch
 * mock + DOM stub) but writes to disk instead of running tests. We
 * inline the harness here rather than import from setup.ts because
 * setup.ts uses Vitest's `beforeAll` hook which doesn't exist outside
 * a Vitest run.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

// --- jsdom + fetch mock + DOM stub (verbatim with setup.ts) ---

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
globalThis.window = dom.window;
globalThis.document = dom.window.document;

globalThis.fetch = async (url) => {
  let rel = String(url);
  if (rel.startsWith('./')) rel = rel.slice(2);
  else if (rel.startsWith('../')) rel = rel.slice(3);
  else if (rel.startsWith('/')) rel = rel.slice(1);
  else if (rel.startsWith('http')) return new Response('', { status: 404 });
  const filePath = path.join(ROOT, rel);
  try {
    return new Response(fs.readFileSync(filePath, 'utf8'), {
      status: 200, headers: { 'content-type': 'text/plain' },
    });
  } catch {
    return new Response('', { status: 404 });
  }
};

const realGetById = document.getElementById.bind(document);
const stub = () => new Proxy(function () { return stub(); }, {
  get(t, p) {
    if (p in t) return t[p];
    if (typeof p === 'string' && /^[a-z]/i.test(p)) return stub();
    return undefined;
  },
  set(t, p, v) { t[p] = v; return true; },
});
document.getElementById = (id) => realGetById(id) || stub();
document.querySelector = () => stub();
document.querySelectorAll = () => [];

// --- Walk dist/ and concat in build.mjs order ---

function walkSorted(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d).sort(); }
    catch { continue; }
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

const files = walkSorted(DIST);
if (!files.length) {
  console.error(`[gen-baseline] dist/ is empty — run \`npm run build\` first`);
  process.exit(1);
}
const concat = files.map(f => fs.readFileSync(f, 'utf8')).join('\n\n');
const epilogue = 'function setSeed(seed) { rng = new SeededRandom(seed | 0); }';
const exportNames = ['SIM_VERSION', 'SCENARIOS', 'VugSimulator', 'setSeed', 'SeededRandom'];
const expr = '{ ' + exportNames.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ') + ' }';
const fn = new Function(`${concat}\n${epilogue}\n;return ${expr};`);
const exports = fn();
for (const k of exportNames) globalThis[k] = exports[k];

// Wait for SCENARIOS (loaded async via the fetch mock).
async function waitForScenarios() {
  const t0 = Date.now();
  while (Date.now() - t0 < 5000) {
    if (SCENARIOS && Object.keys(SCENARIOS).length > 0) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error('SCENARIOS never populated — fetch mock or data path broken');
}
await waitForScenarios();

// --- Run every scenario at seed 42 + summarize ---

function summarize(sim) {
  const out = {};
  if (!sim || !sim.crystals) return out;
  for (const c of sim.crystals) {
    if (!out[c.mineral]) {
      out[c.mineral] = { active: 0, dissolved: 0, total: 0, max_um: 0 };
    }
    out[c.mineral].total++;
    if (c.dissolved) out[c.mineral].dissolved++;
    else out[c.mineral].active++;
    if (c.total_growth_um > out[c.mineral].max_um) {
      out[c.mineral].max_um = Math.round(c.total_growth_um * 10) / 10;
    }
  }
  // Sort keys for stable diff output across runs.
  const sorted = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

function runScenario(name, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 100); i++) sim.run_step();
  return sim;
}

const baseline = {};
const names = Object.keys(SCENARIOS).sort();
for (const name of names) {
  const sim = runScenario(name, 42);
  baseline[name] = summarize(sim);
  const total = sim.crystals.length;
  const minerals = Object.keys(baseline[name]).length;
  console.log(`  ${name.padEnd(36)} ${String(total).padStart(3)} crystals, ${String(minerals).padStart(2)} species`);
}

if (!fs.existsSync(BASELINES)) fs.mkdirSync(BASELINES, { recursive: true });
const outPath = path.join(BASELINES, `seed42_v${SIM_VERSION}.json`);
fs.writeFileSync(outPath, JSON.stringify(baseline, null, 2) + '\n');
console.log(`\n[gen-baseline] wrote ${path.relative(ROOT, outPath)} (${names.length} scenarios)`);
