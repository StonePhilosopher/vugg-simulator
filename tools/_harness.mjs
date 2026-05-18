// tools/_harness.mjs — shared jsdom + bundle-eval harness for tool scripts.
//
// Six tool scripts (gen-js-baseline, twin_rate_check, mineral_coverage_check,
// stale_mineral_probe, high_fill_probe, geology_check) need the same setup:
//
//   1. JSDOM (so the bundle's DOM-touching code doesn't crash)
//   2. fetch mock (so the bundle can load data/*.json5 and data/*.json
//      from disk, since they were originally fetched over HTTP)
//   3. document.getElementById/querySelector stubs (so the UI module
//      registrations don't crash on missing elements)
//   4. Walk dist/, concat all .js into a single string, eval as a Function
//      so the top-level `const` declarations in the bundle stay scoped
//      and don't leak globals
//   5. Capture chosen exports from the function's scope via a return
//      expression at the end of the concat
//   6. Wait for SCENARIOS to populate (the bundle loads scenarios.json5
//      asynchronously via the mocked fetch — the bundle's IIFE returns
//      before that promise resolves)
//
// Pre-extraction (2026-05-18 audit): ~50 lines of this duplicated across
// six tools. Now: one call.
//
// Usage:
//
//   import { loadSimBundle } from './_harness.mjs';
//
//   const { SIM_VERSION, SCENARIOS, VugSimulator, setSeed } =
//     await loadSimBundle({ toolName: 'my_tool' });
//
//   // Optional extras for tools that need internal helpers:
//   const { activityCorrectionFactor, ionicStrength } =
//     await loadSimBundle({ extraExports: ['activityCorrectionFactor', 'ionicStrength'] });

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HARNESS_ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Base export set — what every tool needs.
const BASE_EXPORTS = ['SIM_VERSION', 'SCENARIOS', 'VugSimulator', 'setSeed', 'SeededRandom'];

let _loaded = null;  // memoize across multiple calls in the same process

/**
 * Set up jsdom + fetch + DOM stubs, eval the dist/ bundle, return chosen exports.
 *
 * @param {object} opts
 * @param {string[]} [opts.extraExports=[]] - additional global names to capture beyond BASE_EXPORTS
 * @param {string} [opts.toolName='tool'] - identifier used in error messages
 * @param {number} [opts.scenarioTimeoutMs=5000] - how long to wait for SCENARIOS to populate
 * @returns {Promise<object>} an object containing all base + extra exports
 */
export async function loadSimBundle(opts = {}) {
  const {
    extraExports = [],
    toolName = 'tool',
    scenarioTimeoutMs = 5000,
  } = opts;

  // Memoize: each tool typically calls this once but if a tool happens to
  // call it twice (e.g. via re-import), don't redo the expensive eval.
  if (_loaded) {
    const exportNames = [...BASE_EXPORTS, ...extraExports];
    const out = {};
    for (const n of exportNames) out[n] = _loaded[n];
    return out;
  }

  // 1. JSDOM
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', { url: 'http://localhost' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.sessionStorage = dom.window.sessionStorage;

  // 2. fetch mock — read from disk relative to the repo root
  globalThis.fetch = async (url) => {
    let rel = String(url);
    if (rel.startsWith('./')) rel = rel.slice(2);
    else if (rel.startsWith('../')) rel = rel.slice(3);
    else if (rel.startsWith('/')) rel = rel.slice(1);
    else if (rel.startsWith('http')) return new Response('', { status: 404 });
    const filePath = path.join(HARNESS_ROOT, rel);
    try {
      return new Response(fs.readFileSync(filePath, 'utf8'), {
        status: 200, headers: { 'content-type': 'text/plain' },
      });
    } catch {
      return new Response('', { status: 404 });
    }
  };

  // 3. document stubs — proxy returns chained stubs for arbitrary property access
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

  // 4. Walk dist/ and concat
  const DIST = path.join(HARNESS_ROOT, 'dist');
  const files = walkSorted(DIST);
  if (!files.length) {
    console.error(`[${toolName}] dist/ is empty — run \`npm run build\` first`);
    process.exit(1);
  }
  const concat = files.map(f => fs.readFileSync(f, 'utf8')).join('\n\n');

  // 5. Eval as a Function so top-level const declarations stay scoped.
  // The epilogue defines setSeed in terms of the bundle's internal `rng`,
  // which is module-scoped and not otherwise accessible from outside.
  const epilogue = 'function setSeed(seed) { rng = new SeededRandom(seed | 0); }';
  const exportNames = [...BASE_EXPORTS, ...extraExports];
  const expr = '{ ' + exportNames.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ') + ' }';
  const fn = new Function(`${concat}\n${epilogue}\n;return ${expr};`);
  const exports = fn();

  // Mirror chosen exports to globalThis so tools can still reference
  // them as free identifiers (matches the pre-extraction pattern).
  for (const k of exportNames) globalThis[k] = exports[k];

  // 6. Wait for SCENARIOS to populate (bundle loads scenarios.json5 async)
  await waitForScenarios(exports, scenarioTimeoutMs, toolName);

  _loaded = exports;
  return exports;
}

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
  return out.sort((a, b) => {
    const distRel = (x) => path.relative(dir, x).split(path.sep).join('/');
    return distRel(a).localeCompare(distRel(b));
  });
}

async function waitForScenarios(exports, timeoutMs, toolName) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    if (exports.SCENARIOS && Object.keys(exports.SCENARIOS).length > 0) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(`[${toolName}] SCENARIOS never populated`);
}
