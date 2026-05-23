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
  'MINERAL_GATES_REGISTRY',  // v127 — per-mineral nucleation gates (sigma_crit, T/pH/O2/fluid_min, surface_energy)
  // v127 initiative scaffold (read-only — does not affect growth in v127, lands in v128 graduated competition).
  'baseInitiative',
  'temperatureInitiativeModifier',
  'edgeOfGateInitiativeModifier',
  'surfaceEnergyInitiativeModifier',
  'competitionInitiativeModifier',
  'cascadeRippleInitiativeModifier',
  'computeInitiative',
  'rankInitiative',
  'getInitiativeTrace',
  'clearInitiativeTrace',
  // v128 graduated-competition allocation (js/44).
  'GRADUATED_COMPETITION_ENABLED',
  'GRADUATED_GAP_THRESHOLD',
  'GRADUATED_POWER_LAW_K',
  'GRADUATED_WINNER_TAKES_FRAC',
  // Setter functions for the closure-scoped tuning constants. Tests
  // that need to flip the flag mid-run must call setGraduatedCompetitionEnabled(...)
  // not assign to globalThis — the bundle's `let` bindings live inside
  // the IIFE and globalThis writes don't reach them.
  'setGraduatedCompetitionEnabled',
  'setGraduatedGapThreshold',
  'setGraduatedPowerLawK',
  'setGraduatedWinnerTakesFrac',
  'computeGraduatedAllocations',
  'buildCrystalDryRun',
  // MASS_BALANCE_SCALE is referenced by buildCrystalDryRun lookup.
  'MASS_BALANCE_SCALE',
  'MINERAL_STOICHIOMETRY',
  'MINERAL_GAME_COLORS',
  'crystalColor',
  'zoneColor',
  'SCENARIOS',
  'VugSimulator',
  'VugConditions',
  'FluidChemistry',
  'VugWall',
  'WallState',
  'WallCell',
  'WallMesh',
  'Crystal',
  'GrowthZone',
  'EVENT_REGISTRY',
  'rng',
  'setSeed',
  'ORIENTATION_PREFERENCE',
  'WATER_STATE_PREFERENCE',
  // Phase D habit-bias helper (99i-renderer-three.ts).
  '_topoCAxisForCrystal',
  // Habit-variant picker (07-habit-variant.ts) — Proposal B (2026-05)
  // added a 5th `localFill` parameter.
  'selectHabitVariant',
  // Slice 4 dripstone token resolver (99i-renderer-three.ts).
  '_resolveCrystalGeomToken',
  '_habitGeomToken',
  // v134 (2026-05-22) — 99i fluorite-twin parity: _buildHabitGeom is
  // exposed so tests can assert the twin token produces the right
  // BufferGeometry vertex count (24 cube faces × 3 = 72 vertex triples).
  '_buildHabitGeom',
  // 2026-05-22 wireframe cluster-spec refactor (99d-renderer-wireframe.ts).
  // Per-habit cluster pattern dispatch; mirrors 99i's _CLUSTER_PATTERNS.
  '_druzyClusterSpec',
  '_druzyClusterCount',  // legacy alias — count-only API for back-compat
  // 2026-05-22 twin cluster-pattern wiring (v134). _clusterPatternKeyForPrim
  // maps PRIM_* → pattern key (99d); _CLUSTER_PATTERNS maps token string →
  // pattern (99i). Tests verify all 7 twin primitives route to appropriate
  // patterns.
  '_clusterPatternKeyForPrim',
  '_CLUSTER_PATTERNS',
  '_CLUSTER_PATTERNS_2D',
  // 2026-05-22 hopper/skeletal texture (v134, 99a-renderer-textures.ts).
  // _resolveTexture maps (mineral, habit) → texture token; the 'hopper'
  // token routes to _texture_hopper which paints stepped right-angle
  // notches per Tanaka et al. 2018.
  '_resolveTexture',
  'HABIT_TO_TEXTURE',
  'TEXTURE_PARAMS',
  // 2026-05-22 fluorite penetration-twin primitive (v134,
  // 99c-renderer-primitives.ts + 99d dispatch). Two interpenetrating
  // cubes rotated 60° around their shared body diagonal — the iconic
  // Cumbria / Cave-in-Rock fluorite twin.
  'PRIM_FLUORITE_PENETRATION_TWIN',
  'PRIM_CUBE',  // baseline reference for twin tests
  // 2026-05-22 selenite swallowtail-twin primitive (v134 second iconic
  // twin, 99c-renderer-primitives.ts + 99d dispatch). Two tabular
  // gypsum blades opening in a V at 60° from a shared base contact.
  'PRIM_SELENITE_SWALLOWTAIL_TWIN',
  // 2026-05-22 galena spinel-law octahedron-twin primitive (v134 third
  // iconic twin). Two octahedra sharing a {111} triangular face — the
  // classic contact twin documented in Ramdohr 1980 + Boyle 1968.
  'PRIM_GALENA_OCTAHEDRON_TWIN',
  // 2026-05-22 aragonite cyclic-sextet pseudo-hex twin (v134 fourth
  // iconic twin). Three tabular orthorhombic prisms at 60° around the
  // c-axis, interpenetrating to form pseudo-hexagonal column.
  'PRIM_ARAGONITE_PSEUDOHEX_TWIN',
  // 2026-05-22 cerussite stellate-sixling twin (v134 fifth iconic twin).
  // Flat-star counterpart to aragonite — 3 thin blades in the wall plane
  // (XZ), each rotated 60° → 6 visible arms.
  'PRIM_CERUSSITE_SIXLING_TWIN',
  // 2026-05-22 marcasite cockscomb twin (v134 sixth iconic twin). Two
  // thin needle blades joined on {110}, opening in a tight 40° V — the
  // diagnostic FeS2-dimorph signature.
  'PRIM_MARCASITE_COCKSCOMB_TWIN',
  // 2026-05-22 pyrite iron-cross twin (v134 seventh and final iconic
  // twin — completes RESEARCH-CRYSTAL-NATURALISM.md §7's list of 7).
  // Two chiral {120} pyritohedra interpenetrating at 90° around c-axis.
  'PRIM_PYRITE_IRON_CROSS_TWIN',
  // 2026-05-22 marcasite spearhead twin (v134 secondary, post-iconic-7).
  // Elongated rhombic bipyramid — the {101} contact twin.
  'PRIM_MARCASITE_SPEARHEAD_TWIN',
  // 2026-05-22 aragonite contact twin (v134 secondary). Single V-pair
  // {110} contact (vs cyclic-sextet's 3-fold). Prismatic (square)
  // cross-section distinguishes from selenite's tabular swallowtail.
  'PRIM_ARAGONITE_CONTACT_TWIN',
  '_lookupCrystalPrimitive',
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
  // Phase 4d arsenic-state split (v92, 20c-chemistry-redox.ts).
  'arsenicOxidizedFraction',
  'arsenateAvailablePpm',
  'arseniteAvailablePpm',
  // Phase 4b carbonate-class helpers (20c-chemistry-redox.ts).
  'carbonateRedoxAvailable',
  'carbonateRedoxFactor',
  'carbonateRedoxAnoxic',
  'carbonateRedoxPenalty',
  // Phase 4b sulfide-class helpers (20c-chemistry-redox.ts).
  'sulfideRedoxAnoxic',
  'sulfideRedoxLinearFactor',
  'sulfideRedoxTent',
  // Phase 4b molybdate / phosphate / silicate-class helpers.
  'molybdateRedoxAvailable',
  'molybdateRedoxFactor',
  'phosphateRedoxAvailable',
  'phosphateRedoxFactor',
  'silicateRedoxAvailable',
  'silicateRedoxFactor',
  // Phase 4b native-class helpers.
  'nativeRedoxAnoxic',
  'nativeRedoxLinearFactor',
  'nativeRedoxWindow',
  'nativeRedoxTent',
  // 75-transitions.ts — paramorph + dehydration + light transition tables
  // and the per-step apply functions. Tests-js/meta-autunite-trio.test.ts
  // (v85) needs the dehydration entry to drive heat / vadose paths
  // synthetically; the pararealgar test (v84) drives light transitions
  // via run_step + wall.is_lit so it doesn't need the explicit hook.
  'PARAMORPH_TRANSITIONS',
  'DEHYDRATION_TRANSITIONS',
  'LIGHT_TRANSITIONS',
  'applyParamorphTransitions',
  'applyDehydrationTransitions',
  'applyLightTransitions',
];

let _bundleLoaded = false;

// Load the vendored Three.js module into the test global scope so the
// 99i renderer's geometry builders (which reference THREE.BufferGeometry,
// THREE.BoxGeometry, THREE.Float32BufferAttribute, etc.) work when
// invoked from tests. In the browser, index.html boots the same module
// before the bundle runs and sets THREE as a global. In jsdom we mimic
// that here.
async function installThreeGlobal(): Promise<void> {
  if ((globalThis as any).THREE) return;
  const threeModulePath = path.join(ROOT, 'tools', 'three.module.js');
  // Use file:// URL so dynamic import resolves the absolute path on
  // both POSIX and Windows.
  const url = 'file://' + threeModulePath.replace(/\\/g, '/');
  const THREE = await import(url);
  (globalThis as any).THREE = THREE;
}

async function loadBundle() {
  if (_bundleLoaded) return;
  installFetchMock();
  await installThreeGlobal();
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
  await loadBundle();
  await waitForScenarios();
});
