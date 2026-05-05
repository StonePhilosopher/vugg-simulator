// tests-js/setup.ts — load the vugg JS bundle into the jsdom global
// scope so tests can drive VugSimulator / scenarios deterministically.
//
// What this file does, top to bottom:
//   1. Mock global fetch so the bundle's data/scenarios.json5 +
//      data/minerals.json + narratives/*.md fetches resolve against
//      local files. Without this, the bundle boots with the inline
//      MINERAL_SPEC fallback only and SCENARIOS stays empty.
//   2. Read every tsc-compiled file under dist/ in the same order
//      build.mjs concatenates them, eval the result inside an IIFE,
//      and bind the resulting class / function names to the global
//      scope so test files can reference them by name.
//   3. Wait for the async _loadScenariosJSON5() the bundle kicks off
//      at startup to finish populating SCENARIOS.
//
// Architecture note: SCRIPT-mode TypeScript (no import/export) means
// top-level `let`/`const`/`function` declarations are scoped to the
// concatenated bundle. We use `new Function('... ; return {...}')` to
// run the bundle once and pull out the named exports, then assign
// them to globalThis. From there, `globalThis.VugSimulator` etc. is
// the test entry point.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeAll } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const DATA = path.join(ROOT, 'data');
const NARRATIVES = path.join(ROOT, 'narratives');

// ---- Bundle file ordering (mirrors tools/build.mjs walkSorted) ----

function walkDistSorted(): string[] {
  const out: string[] = [];
  const stack: string[] = [DIST];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: string[];
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
  // Re-sort by full relative path so directory traversal order
  // doesn't matter (build.mjs has the same step).
  return out.sort((a, b) =>
    path.relative(DIST, a).split(path.sep).join('/').localeCompare(
      path.relative(DIST, b).split(path.sep).join('/'),
    ),
  );
}

// ---- Fetch mock ----
//
// The bundle uses fetch() for data/* and narratives/* files. Tests
// run in Node + jsdom, where fetch exists but doesn't resolve relative
// paths against the repo. We override with a file-backed stub.
//
// Path resolution: any URL starting with './', '../', or '/' is mapped
// to an actual file under ROOT. Anything else (e.g. https://) hits
// the real fetch (or fails — tests shouldn't depend on network).

function installFetchMock() {
  const realFetch = (globalThis as any).fetch;
  (globalThis as any).fetch = async (url: string, _init?: any) => {
    const u = String(url);
    let rel = u;
    // Normalize the three path-prefix variants the bundle tries
    // (./, ../, /) — all of them map to the repo root.
    if (rel.startsWith('./')) rel = rel.slice(2);
    else if (rel.startsWith('../')) rel = rel.slice(3);
    else if (rel.startsWith('/')) rel = rel.slice(1);
    else if (rel.startsWith('http')) {
      // Outside-the-repo URLs go to the real fetch (or just 404).
      return realFetch ? realFetch(url) : new Response('', { status: 404 });
    }
    const filePath = path.join(ROOT, rel);
    try {
      const buf = fs.readFileSync(filePath, 'utf8');
      return new Response(buf, { status: 200, headers: { 'content-type': 'text/plain' } });
    } catch {
      return new Response('', { status: 404 });
    }
  };
}

// ---- DOM stub ----
//
// The bundle's UI-level files (97-fortress, 98-groove, 99-renderer
// interaction wiring) call `document.getElementById('foo')` at top
// level then chain `.addEventListener(...)` etc. on the result. In
// the browser the elements exist (defined in index.html); in jsdom
// they don't, and the chained call throws on null. Override the
// query methods so missing ids return a stub Proxy that no-ops every
// access — the bundle's UI wires up against ghost elements but the
// engine classes (which is all tests care about) instantiate cleanly.

function installDomStub() {
  const realGetById = document.getElementById.bind(document);
  const realQuery = document.querySelector.bind(document);
  const realQueryAll = document.querySelectorAll.bind(document);

  // Recursive Proxy: every property access returns another Proxy;
  // every function call returns one too. Boolean / string contexts
  // give sensible defaults via the symbol traps.
  const makeStub = (): any => {
    const target: any = function () { return makeStub(); };
    target.style = {};
    target.classList = {
      add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false,
    };
    target.dataset = {};
    target.children = [];
    target.childNodes = [];
    target.attributes = {};
    target.appendChild = () => target;
    target.removeChild = () => target;
    target.insertBefore = () => target;
    target.addEventListener = () => {};
    target.removeEventListener = () => {};
    target.setAttribute = () => {};
    target.getAttribute = () => null;
    target.removeAttribute = () => {};
    target.dispatchEvent = () => true;
    target.focus = () => {};
    target.blur = () => {};
    target.click = () => {};
    target.contains = () => false;
    target.getBoundingClientRect = () => ({ x: 0, y: 0, width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0 });
    target.querySelector = () => makeStub();
    target.querySelectorAll = () => [];
    target.cloneNode = () => makeStub();
    target.getContext = () => null;
    target.innerHTML = '';
    target.textContent = '';
    target.value = '';
    target.checked = false;
    target.disabled = false;
    target.scrollTop = 0;
    target.scrollLeft = 0;
    target.scrollHeight = 0;
    target.scrollWidth = 0;
    target.clientWidth = 0;
    target.clientHeight = 0;
    target.offsetWidth = 0;
    target.offsetHeight = 0;
    target.offsetTop = 0;
    target.offsetLeft = 0;
    return new Proxy(target, {
      get(t, prop) {
        if (prop in t) return (t as any)[prop];
        // Unknown property → stub callable. The Proxy makes the
        // common patterns (chained .style.color = '...', etc.) work
        // without listing every possible property.
        return makeStub();
      },
      set(t, prop, value) {
        (t as any)[prop] = value;
        return true;
      },
    });
  };

  document.getElementById = (id: string) => {
    const real = realGetById(id);
    return real || makeStub();
  };
  document.querySelector = (sel: string) => {
    const real = realQuery(sel);
    return real || makeStub();
  };
  document.querySelectorAll = (sel: string) => {
    const real = realQueryAll(sel);
    return real.length ? real : ([] as any);
  };
}

// ---- Bundle eval ----
//
// Names returned from the IIFE — the public API tests consume. Add
// more here as tests need them; the cost is one identifier in the
// returned object literal.

const EXPORTS = [
  'SIM_VERSION',
  'MINERAL_SPEC',
  'MINERAL_ENGINES',
  'SCENARIOS',
  'VugSimulator',
  'VugConditions',
  'FluidChemistry',
  'VugWall',
  'WallState',
  'WallCell',
  'Crystal',
  'GrowthZone',
  'rng',
  'setSeed',
  'ORIENTATION_PREFERENCE',
  'WATER_STATE_PREFERENCE',
  // Phase 4a redox infrastructure (20c-chemistry-redox.ts).
  'EH_DYNAMIC_ENABLED',
  'REDOX_COUPLES',
  'nernstOxidizedFraction',
  'redoxFraction',
  'ehFromO2',
  'o2FromEh',
  // Phase 4b sulfate-class helpers (20c-chemistry-redox.ts).
  'sulfateRedoxAvailable',
  'sulfateRedoxFactor',
  // Phase 4b hydroxide-class helpers (20c-chemistry-redox.ts).
  'hydroxideRedoxAvailable',
  'hydroxideRedoxFactor',
  // Phase 4b oxide-class helpers (20c-chemistry-redox.ts).
  'oxideRedoxAvailable',
  'oxideRedoxFactor',
  'oxideRedoxAnoxic',
  'oxideRedoxAnoxicFactor',
  'oxideRedoxWindow',
  'oxideRedoxTent',
  // Phase 4b arsenate-class helpers (20c-chemistry-redox.ts).
  'arsenateRedoxAvailable',
  'arsenateRedoxFactor',
  // Phase 4b carbonate-class helpers (20c-chemistry-redox.ts).
  'carbonateRedoxAvailable',
  'carbonateRedoxFactor',
  'carbonateRedoxAnoxic',
  'carbonateRedoxPenalty',
  // Phase 4b sulfide-class helpers (20c-chemistry-redox.ts).
  'sulfideRedoxAnoxic',
  'sulfideRedoxLinearFactor',
  'sulfideRedoxTent',
];

let _bundleLoaded = false;

function loadBundle() {
  if (_bundleLoaded) return;
  installFetchMock();
  const files = walkDistSorted();
  if (!files.length) {
    throw new Error(
      `[setup] dist/ is empty — run \`npx tsc -p tsconfig.json\` (or \`npm run build\`) before \`npm test\``,
    );
  }
  // Pre-populate jsdom with a minimal DOM stub so the bundle's
  // top-level UI wiring (addEventListener calls keyed off
  // getElementById) doesn't throw. We don't need the DOM to actually
  // work — just to not crash on null.X. Override getElementById /
  // querySelector to fall back to a no-op mock element so missing
  // ids return SOMETHING.
  installDomStub();
  const concatenated = files
    .map(f => fs.readFileSync(f, 'utf8'))
    .join('\n\n');
  // Epilogue: inject a setSeed helper that reassigns the bundle's
  // global `rng` from outside — the bundle never exposed one because
  // the UI handlers set `rng = new SeededRandom(seed)` inline. Tests
  // need a stable handle to do the same, so we make one here. Lives
  // inside the IIFE scope so it can mutate `let rng`.
  const epilogue = `
    function setSeed(seed) {
      rng = new SeededRandom(seed | 0);
    }
  `;
  const exportObject = '{' + EXPORTS.map(n => `${n}: typeof ${n} !== 'undefined' ? ${n} : undefined`).join(', ') + '}';
  const body = `${concatenated}\n${epilogue}\n;return ${exportObject};`;
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const fn = new Function(body);
  const exports = fn();
  for (const name of EXPORTS) {
    if (exports[name] !== undefined) {
      (globalThis as any)[name] = exports[name];
    }
  }
  _bundleLoaded = true;
}

// ---- Wait for scenarios ----
//
// _loadScenariosJSON5() inside the bundle is async. After eval, the
// Promise is in flight; SCENARIOS gets populated when it resolves.
// Wait up to 5s, polling every 50ms. Throws if scenarios never
// arrive (likely indicates the fetch mock or data path is broken).

async function waitForScenarios(timeoutMs = 5000): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const sc = (globalThis as any).SCENARIOS;
    if (sc && Object.keys(sc).length > 0) return;
    await new Promise(r => setTimeout(r, 50));
  }
  throw new Error(
    `[setup] SCENARIOS never populated within ${timeoutMs}ms — fetch mock or data/scenarios.json5 path likely broken`,
  );
}

beforeAll(async () => {
  loadBundle();
  await waitForScenarios();
});
