// ============================================================
// js/99z-agent-interface.ts — Agent-friendly interface (v117).
// ============================================================
// Per proposals/PROPOSAL-AGENT-FRIENDLY-INTERFACE.md (Rock Bot +
// Professor, 2026-05-20) and boss-greenlit narrowed scope.
//
// Three surfaces the AI agents (and humans) use to drive the
// simulator without brittle browser automation:
//
//   1. URL QUERY PARAMETERS — shareable, deterministic specimen
//      links. `?scenario=jeffrey_mine&seed=42&shape_seed=3&steps=200`
//      is a stable identifier; the same URL produces the same
//      specimen every time it loads (modulo the determinism caveats
//      in §"Determinism audit" below).
//
//      Supported params:
//        scenario   = scenario id (required for anything to dispatch)
//                     or 'random' (deterministic-random when seed given)
//        seed       = integer, growth RNG seed
//        shape_seed = integer, cavity-geometry RNG seed (independent
//                     of `seed` per boss directive 2026-05-11)
//        steps      = integer, step count override (defaults to
//                     scenario's authored duration)
//        autogrow   = '1' → kick off the run automatically
//        dump       = 'specimen' → headless run + console JSON dump
//                     (implies autogrow=1; no specimen without a run)
//        mode       = 'play' (default, Simulation/legends mode) or
//                     'idle' (Zen Mode pre-selected to scenario)
//        lenient    = '1' → bad-param fallback (warn + continue)
//                     instead of hard-error (refuse + console.error)
//
//   2. window.vugg DEBUG HANDLE — script-mode TS bundles concatenate
//      `let`/`const`/`class` decls into one big script tag; those
//      identifiers live in lexical scope, NOT on `window`. Agents
//      with browser-DevTools console access need a deliberate
//      exposure to probe state. `window.vugg` provides read-time
//      getters into the bundle's globals + imperative helpers
//      (startScenario, dumpSpecimen, listScenarios) usable from
//      `mcp__claude_in_chrome__javascript_tool` and similar.
//
//   3. AGENT-FRIENDLY KEYBOARD SHORTCUTS — Playwright / browser-
//      automation tools frequently can't reliably click but CAN
//      send key events. Five bindings dodge the existing topo-
//      replay handler at index.html:40318 (which owns ←/→/Space
//      when topo-panel is visible) and the global Escape:
//
//        G       — grow (start sim if scenario param set; advance
//                  one step in fortress mode otherwise)
//        R       — randomize: pick a non-tutorial scenario at random
//        N       — open New Game menu
//        S       — step forward one (fortress mode only)
//        1-9, 0  — pick non-tutorial scenario N (alphabetical sort)
//
//      Skipped from original proposal: Space (topo-replay owns it),
//      ←/→ (same), Escape (global modal close), P (ambiguous),
//      L/E/C (potential future bindings — add only when needed).
//
// ── ?dump=specimen JSON SHAPE ───────────────────────────────────
// Mirrors agent-api/vugg-agent.js's `finish` response so an analyst
// who's parsed one runtime's output can parse the other's unchanged.
// Per-crystal fields: mineral, crystal_id, nucleation_step,
// nucleation_temp, position, c_length_mm, a_width_mm, habit,
// dominant_forms, zones_count, total_growth_um, twinned, twin_law,
// active, dissolved, phantom_count, morphology, fluorescence, zones[].
// Wrapper adds: ok, sim_version, scenario, seed, shape_seed,
// total_steps, crystals[], paragenetic_sequence[], log_length.
//
// ── DETERMINISM AUDIT (2026-05-20) ──────────────────────────────
// Five Math.random() call sites exist in the bundle. None affect
// specimen identity when the URL-param path is followed:
//
//   js/26-mineral-paragenesis.ts:319 — `(rng && rng.random ? ... : Math.random())`
//     Fallback for unset rng; the URL-boot path always seeds rng
//     before construction, so this branch never fires.
//   js/91-ui-legends.ts:86 — random seed when seed input empty;
//     URL boot pre-fills the input, so bypassed.
//   js/91-ui-legends.ts:210/212/218 — runRandom() for Quick Play,
//     which is procedural (RANDOM_ARCHETYPES, not SCENARIOS) and
//     not on the URL path.
//   js/93-ui-collection.ts:74 — crystal ID for save/load; not
//     content-affecting (IDs are identifiers, not specimen state).
//   js/98a-ui-zen.ts:83 — zen-mode random scenario pick; zen is
//     the screensaver, not the shareable-URL contract.
//
// Conclusion: ?seed=N gives byte-stable specimens on the URL path.
// The guard test runs the same scenario+seed twice and diffs the
// dump to catch any future Math.random regression that bleeds into
// specimen state.
//
// SCRIPT-mode TS: top-level `let`/`const`/`function`/`class` decls
// stay in shared bundle lexical scope. Direct references (SCENARIOS,
// rng, SeededRandom, VugSimulator) resolve at runtime via the same
// concat-IIFE the rest of the bundle uses. globalThis access is
// reserved for test-hook installation (test harness needs a
// universally-readable handle).
// ============================================================

// ---- Tutorial-policy filter (shared with zen + quick-play) ----
function _agentIsTutorial(name: string): boolean {
  return typeof name === 'string' && name.startsWith('tutorial_');
}

// ---- Param coercion with lenient/hard-error policy ----
function _agentParamInt(params: URLSearchParams, name: string, defaultVal: any, lenient: boolean): any {
  const raw = params.get(name);
  if (raw == null) return defaultVal;
  const trimmed = raw.trim();
  const n = parseInt(trimmed, 10);
  if (!Number.isFinite(n) || String(n) !== trimmed) {
    const msg = `[vugg] ?${name}=${raw} is not an integer`;
    if (lenient) { console.warn(msg + ' (lenient — using default)'); return defaultVal; }
    console.error(msg + ' (hard-error — pass ?lenient=1 to fall back)');
    throw new Error(msg);
  }
  return n;
}

function _agentParamBool(params: URLSearchParams, name: string, defaultVal: boolean): boolean {
  const raw = params.get(name);
  if (raw == null) return defaultVal;
  return raw === '1' || raw === 'true' || raw === 'yes';
}

// ---- Deterministic-random scenario pick from a seed ----
// Used by ?scenario=random&seed=N so the URL is shareable. Mulberry32
// one-shot (matches SeededRandom's algorithm so the picked index is
// stable across runtimes).
function _agentDeterministicPick(keys: string[], seed: number): string {
  let s = (seed >>> 0) + 0x6D2B79F5;
  s = Math.imul(s ^ (s >>> 15), s | 1) >>> 0;
  s = (s ^ (s + Math.imul(s ^ (s >>> 7), s | 61))) >>> 0;
  const r = (s ^ (s >>> 14)) >>> 0;
  return keys[r % keys.length];
}

// ---- Specimen JSON: mirror agent-api's `finish` shape ----
// `simOverride` lets the headless run pass its own sim directly;
// callers without one fall back to the global fortressSim / legendsSim /
// idleSim handles.
function _agentSpecimenJSON(simOverride?: any): any {
  const sim = simOverride
    || (typeof fortressSim !== 'undefined' && fortressSim)
    || (typeof legendsSim !== 'undefined' && legendsSim)
    || (typeof idleSim !== 'undefined' && idleSim)
    || null;
  if (!sim) return { ok: false, error: 'no active sim' };

  const crystals = (sim.crystals || []).map((c: any) => {
    const obj: any = {
      mineral: c.mineral,
      crystal_id: c.crystal_id,
      nucleation_step: c.nucleation_step,
      nucleation_temp: +(c.nucleation_temp || 0).toFixed(1),
      position: c.position,
      c_length_mm: +(c.c_length_mm || 0).toFixed(2),
      a_width_mm: +(c.a_width_mm || 0).toFixed(2),
      habit: c.habit,
      dominant_forms: Array.isArray(c.dominant_forms) ? c.dominant_forms.slice() : [],
      zones_count: (c.zones || []).length,
      total_growth_um: +(c.total_growth_um || 0).toFixed(1),
      twinned: !!c.twinned,
      twin_law: c.twin_law || null,
      active: c.active !== false,
      dissolved: !!c.dissolved,
      phantom_count: c.phantom_count || 0,
    };
    if (typeof c.describe_morphology === 'function') {
      try { obj.morphology = c.describe_morphology(); } catch { obj.morphology = null; }
    } else {
      obj.morphology = null;
    }
    if (typeof c.predict_fluorescence === 'function') {
      try { obj.fluorescence = c.predict_fluorescence(); } catch { obj.fluorescence = null; }
    } else {
      obj.fluorescence = null;
    }
    obj.zones = (c.zones || []).map((z: any) => ({
      step: z.step,
      temperature: +(z.temperature || 0).toFixed(1),
      thickness_um: +(z.thickness_um || 0).toFixed(2),
      trace_Fe: +(z.trace_Fe || 0).toFixed(2),
      trace_Mn: +(z.trace_Mn || 0).toFixed(2),
      trace_Al: +(z.trace_Al || 0).toFixed(2),
      is_phantom: !!z.is_phantom,
      note: z.note || null,
    }));
    return obj;
  });

  // Paragenetic sequence = unique minerals in nucleation order.
  // Order matters for the "did galena → linarite → caledonite actually
  // fire?" workflow Rock Bot called out as the primary use case.
  const seen = new Set<string>();
  const paragenesis: string[] = [];
  const ordered = [...crystals].sort((a, b) => (a.nucleation_step || 0) - (b.nucleation_step || 0));
  for (const c of ordered) {
    if (c.mineral && !seen.has(c.mineral)) {
      seen.add(c.mineral);
      paragenesis.push(c.mineral);
    }
  }

  const wnd: any = (typeof window !== 'undefined') ? window : (globalThis as any);
  const meta = (wnd.vugg && wnd.vugg._lastRunMeta) || {};

  return {
    ok: true,
    sim_version: (typeof SIM_VERSION !== 'undefined') ? SIM_VERSION : null,
    scenario: meta.scenario || null,
    seed: meta.seed != null ? meta.seed : null,
    shape_seed: meta.shape_seed != null ? meta.shape_seed : null,
    total_steps: sim.step,
    crystals,
    paragenetic_sequence: paragenesis,
    log_length: (sim.log || []).length,
  };
}

// ---- Headless run (no DOM, no narrative tempo) ----
// Constructs a sim from SCENARIOS[name](overrides), seeds RNG, runs
// `steps` iterations of run_step() in a tight loop, returns the sim.
// This is the fast path for ?dump=specimen — no animation, no DOM
// dependencies, no setTimeout. Tests use it directly via the
// `__vugg_agent_test_hooks` global.
//
// Seeds the lexically-scoped `rng` BEFORE constructing the sim so
// wall-state geometry (which consumes rng during VugSimulator
// construction) is deterministic.
function _agentHeadlessRun(scenarioName: string, opts: any): any {
  opts = opts || {};
  if (typeof SCENARIOS === 'undefined' || !SCENARIOS[scenarioName]) {
    throw new Error(`_agentHeadlessRun: unknown scenario '${scenarioName}'`);
  }
  const seed = opts.seed != null ? (opts.seed >>> 0) : (Math.floor(Math.random() * 2147483647) >>> 0);
  const shapeSeed = opts.shape_seed != null ? (opts.shape_seed | 0) : null;
  // Direct lexical-scope mutation — see file header note on script-mode TS.
  rng = new SeededRandom(seed);

  const overrides: any = {};
  if (shapeSeed != null) overrides.wall = { shape_seed: shapeSeed };

  const { conditions, events, defaultSteps } = SCENARIOS[scenarioName](overrides);
  const steps = (opts.steps != null && opts.steps > 0) ? (opts.steps | 0) : ((defaultSteps | 0) || 200);

  const sim = new VugSimulator(conditions, events);
  // === HELIX-OVERLAY-FORK ADDITION (strip view v155+, 2026-05-26) ===
  // Attach a StripRecorder so agent runs produce a dataset too.
  // Agents rarely want IDB pollution (a batch of 50 headless runs
  // would saturate the 5-slot cap immediately), so the dataset is
  // returned to the caller via the result object and NOT auto-saved.
  // Callers that want persistence can dispatch stripStorageSave
  // themselves on the returned dataset.
  let stripRecorder: any = null;
  if (typeof StripRecorder === 'function') {
    try {
      stripRecorder = new StripRecorder(sim, {
        duration_steps: steps,
        notes: `Agent — ${scenarioName} @ seed ${seed}`,
      });
      const m = stripRecorder.getManifest();
      if (m) m.scenario_id = String(scenarioName);
      sim._stripRecorder = stripRecorder;
    } catch (_e) { stripRecorder = null; }
  }
  // === END HELIX-OVERLAY-FORK ADDITION ==============================

  for (let s = 0; s < steps; s++) {
    sim.run_step();
  }

  // === HELIX-OVERLAY-FORK ADDITION (strip view v155+) ===============
  // Finalize the recorder. Dataset returned in result; IDB save is the
  // caller's choice.
  let stripDataset: any = null;
  if (stripRecorder) {
    try { stripDataset = stripRecorder.finalize(); } catch (_e) { stripDataset = null; }
  }
  // === END HELIX-OVERLAY-FORK ADDITION ==============================

  // Stash metadata so _agentSpecimenJSON can include it in the dump.
  const wnd: any = (typeof window !== 'undefined') ? window : (globalThis as any);
  wnd.vugg = wnd.vugg || {};
  wnd.vugg._lastRunMeta = { scenario: scenarioName, seed, shape_seed: shapeSeed };

  return {
    sim, seed, shape_seed: shapeSeed, scenario: scenarioName, total_steps: steps,
    // v155: strip dataset for the run. Agents can serialize via
    // stripSerialize, save via stripStorageSave, or just inspect.
    // null if the recorder wasn't available.
    stripDataset,
  };
}

// ---- Keyboard handler (G / R / N / S / 1-9 / 0) ----
function _agentKeyHandler(ev: KeyboardEvent): void {
  // Don't hijack typing. Same convention as topo-replay handler
  // at index.html:40320 (input/textarea/select/contentEditable).
  const tgt = ev && (ev.target as any);
  if (tgt) {
    const tag = (tgt.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (tgt.isContentEditable) return;
  }
  // Modifier-pressed combos belong to the browser / OS / page.
  if (ev.ctrlKey || ev.altKey || ev.metaKey) return;

  const k = ev.key;
  const upper = (k && k.length === 1) ? k.toUpperCase() : k;

  if (upper === 'G') {
    ev.preventDefault();
    _agentKeyGrow();
  } else if (upper === 'R') {
    ev.preventDefault();
    _agentKeyRandom();
  } else if (upper === 'N') {
    ev.preventDefault();
    if (typeof openNewGameMenu === 'function') openNewGameMenu();
  } else if (upper === 'S') {
    ev.preventDefault();
    _agentKeyStep();
  } else if (k && /^[0-9]$/.test(k)) {
    ev.preventDefault();
    const idx = (k === '0') ? 9 : (parseInt(k, 10) - 1);
    _agentKeyPickByIndex(idx);
  }
}

function _agentKeyGrow(): void {
  // If fortress is active, advance one step (G = "grow another step").
  // If not, and a ?scenario URL param is set, launch that scenario.
  if (typeof fortressActive !== 'undefined' && fortressActive && typeof fortressStep === 'function') {
    fortressStep('wait', null);
    return;
  }
  if (typeof location !== 'undefined' && location.search) {
    const params = new URLSearchParams(location.search);
    const s = params.get('scenario');
    if (s && typeof SCENARIOS !== 'undefined' && SCENARIOS[s]
        && typeof startScenarioInCreative === 'function') {
      startScenarioInCreative(s);
    }
  }
}

function _agentKeyStep(): void {
  if (typeof fortressActive !== 'undefined' && fortressActive && typeof fortressStep === 'function') {
    fortressStep('wait', null);
  }
}

function _agentKeyRandom(): void {
  if (typeof SCENARIOS === 'undefined') return;
  const keys = Object.keys(SCENARIOS).filter(k => !_agentIsTutorial(k));
  if (!keys.length) return;
  const pick = keys[Math.floor(Math.random() * keys.length)];
  if (typeof startScenarioInCreative === 'function') {
    startScenarioInCreative(pick);
  }
}

function _agentKeyPickByIndex(idx: number): void {
  if (typeof SCENARIOS === 'undefined') return;
  const keys = Object.keys(SCENARIOS).filter(k => !_agentIsTutorial(k)).sort();
  if (idx < 0 || idx >= keys.length) return;
  if (typeof startScenarioInCreative === 'function') {
    startScenarioInCreative(keys[idx]);
  }
}

// ---- window.vugg debug handle ----
// Read-time getters so the handle reflects current state, not a
// boot-time snapshot. Imperative helpers (startScenario, dumpSpecimen,
// listScenarios) are usable from `mcp__claude_in_chrome__javascript_tool`
// even when point-and-click automation fails.
function _agentExposeWindow(): void {
  const wnd: any = (typeof window !== 'undefined') ? window : (globalThis as any);
  if (!wnd) return;
  try {
    wnd.vugg = wnd.vugg || {};
    const v = wnd.vugg;

    function defineGetter(prop: string, fn: () => any): void {
      try {
        Object.defineProperty(v, prop, { get: fn, configurable: true });
      } catch {
        v[prop] = fn();
      }
    }

    defineGetter('SCENARIOS', () => (typeof SCENARIOS !== 'undefined' ? SCENARIOS : null));
    defineGetter('MINERAL_ENGINES', () => (typeof MINERAL_ENGINES !== 'undefined' ? MINERAL_ENGINES : null));
    defineGetter('MINERAL_SPEC', () => (typeof MINERAL_SPEC !== 'undefined' ? MINERAL_SPEC : null));
    defineGetter('SIM_VERSION', () => (typeof SIM_VERSION !== 'undefined' ? SIM_VERSION : null));
    defineGetter('fortressSim', () => (typeof fortressSim !== 'undefined' ? fortressSim : null));
    defineGetter('legendsSim', () => (typeof legendsSim !== 'undefined' ? legendsSim : null));
    defineGetter('idleSim', () => (typeof idleSim !== 'undefined' ? idleSim : null));
    defineGetter('rng', () => (typeof rng !== 'undefined' ? rng : null));

    v.startScenario = function (name: string, opts: any) {
      opts = opts || {};
      if (typeof startScenarioInCreative !== 'function') return null;
      startScenarioInCreative(name);
      // Override the Date.now()-seeded rng that fortressBeginFromScenario
      // just installed. Note: wall_state construction has already run, so
      // wall geometry uses the Date.now() seed — only growth is seeded
      // here. For fully deterministic runs, use ?seed= URL path OR
      // window.vugg.headlessRun() which seeds before construction.
      if (opts.seed != null) {
        rng = new SeededRandom(opts.seed >>> 0);
      }
      v._lastRunMeta = {
        scenario: name,
        seed: opts.seed != null ? opts.seed : null,
        shape_seed: opts.shape_seed != null ? opts.shape_seed : null,
      };
      if (opts.steps && opts.steps > 0
          && typeof fortressActive !== 'undefined' && fortressActive
          && typeof fortressSim !== 'undefined' && fortressSim) {
        for (let i = 0; i < opts.steps; i++) fortressSim.run_step();
      }
      return v._lastRunMeta;
    };

    v.headlessRun = function (name: string, opts: any) {
      const result = _agentHeadlessRun(name, opts || {});
      v.lastSpecimen = _agentSpecimenJSON(result.sim);
      return v.lastSpecimen;
    };

    v.dumpSpecimen = function () {
      v.lastSpecimen = _agentSpecimenJSON();
      return v.lastSpecimen;
    };

    v.listScenarios = function () {
      return (typeof SCENARIOS !== 'undefined') ? Object.keys(SCENARIOS).sort() : [];
    };

    if (v.lastSpecimen === undefined) v.lastSpecimen = null;
  } catch (e) {
    console.warn('[vugg] window.vugg exposure failed:', e);
  }
}

// ---- URL-param boot dispatch ----
// Reads ?scenario / ?seed / ?steps / ?autogrow / ?dump / ?mode / ?lenient
// after scenarios.json5 has loaded. Headless when dump=specimen,
// auto-narrative when autogrow=1, manual otherwise.
async function _agentBootFromURL(): Promise<void> {
  if (typeof window === 'undefined' || !window.location) return;
  const params = new URLSearchParams(window.location.search || '');
  const lenient = _agentParamBool(params, 'lenient', false);

  const scenario = params.get('scenario');
  const mode = params.get('mode') || 'play';
  if (!scenario && mode === 'play') return;  // nothing to do

  // Wait for scenarios.json5 to populate. Poll the flag the loader
  // in 70-events.ts sets when fetch completes.
  const deadlineMs = Date.now() + 8000;
  // Use direct lexical reference; `_scenariosJson5Ready` is declared
  // with `let` in 70-events.ts.
  while (!(typeof _scenariosJson5Ready !== 'undefined' && _scenariosJson5Ready)) {
    if (Date.now() > deadlineMs) {
      const msg = '[vugg] scenarios.json5 did not load within 8s — ?scenario= cannot dispatch';
      if (lenient) { console.warn(msg); return; }
      console.error(msg);
      return;
    }
    await new Promise(r => setTimeout(r, 50));
  }

  // Resolve scenario name (handles ?scenario=random).
  let resolved = scenario;
  if (scenario === 'random') {
    const keys = Object.keys(SCENARIOS).filter(k => !_agentIsTutorial(k));
    if (!keys.length) {
      console.error('[vugg] ?scenario=random — no non-tutorial scenarios available');
      return;
    }
    const seedRaw = params.get('seed');
    if (seedRaw != null && /^-?\d+$/.test(seedRaw)) {
      resolved = _agentDeterministicPick(keys, parseInt(seedRaw, 10) >>> 0);
    } else {
      resolved = keys[Math.floor(Math.random() * keys.length)];
    }
  } else if (scenario && !(scenario in SCENARIOS)) {
    const msg = `[vugg] ?scenario=${scenario} is not a known scenario`;
    if (lenient) { console.warn(msg + ' (lenient — falling back to title screen)'); return; }
    console.error(msg + ' (hard-error — pass ?lenient=1 to fall back). Known: ' + Object.keys(SCENARIOS).sort().join(', '));
    return;
  }

  // Parse run knobs.
  const seed = _agentParamInt(params, 'seed', null, lenient);
  const shapeSeed = _agentParamInt(params, 'shape_seed', null, lenient);
  const steps = _agentParamInt(params, 'steps', null, lenient);
  let autogrow = _agentParamBool(params, 'autogrow', false);
  const dump = params.get('dump');
  if (dump === 'specimen') autogrow = true;  // dump implies a run

  // Zen-mode pre-selection (?mode=idle&scenario=X).
  if (mode === 'idle') {
    if (typeof switchMode === 'function') {
      switchMode('idle');
    }
    if (resolved && typeof document !== 'undefined') {
      const sel = document.getElementById('idle-scenario') as HTMLSelectElement | null;
      if (sel) sel.value = resolved;
    }
    return;
  }

  // Headless run + JSON dump (the fast agent path).
  if (dump === 'specimen' && resolved) {
    try {
      const result = _agentHeadlessRun(resolved, { seed, shape_seed: shapeSeed, steps });
      const wnd: any = window;
      wnd.vugg = wnd.vugg || {};
      const specimen = _agentSpecimenJSON(result.sim);
      wnd.vugg.lastSpecimen = specimen;
      console.log('VUGG_SPECIMEN', JSON.stringify(specimen));
    } catch (e) {
      console.error('[vugg] ?dump=specimen run failed:', e);
    }
    return;
  }

  // Auto-narrative run via Simulation/legends mode (uses existing
  // runSimulation infra so narrative tempo + cavity replay still work).
  if (autogrow && resolved) {
    if (typeof switchMode === 'function') {
      switchMode('legends');
    }
    if (typeof document !== 'undefined') {
      const setVal = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLInputElement | null;
        if (el) el.value = val;
      };
      const setSelect = (id: string, val: string) => {
        const el = document.getElementById(id) as HTMLSelectElement | null;
        if (el) el.value = val;
      };
      setSelect('scenario', resolved);
      if (seed != null) setVal('seed', String(seed));
      if (shapeSeed != null) setVal('shape-seed', String(shapeSeed));
      if (steps != null) setVal('steps', String(steps));
    }
    if (typeof runSimulation === 'function') {
      runSimulation();
    }
    return;
  }

  // No autogrow — preselect scenario in the dropdown so the user
  // can click Grow themselves. Form fields prefilled.
  if (resolved && typeof switchMode === 'function') {
    switchMode('legends');
    if (typeof document !== 'undefined') {
      const sel = document.getElementById('scenario') as HTMLSelectElement | null;
      if (sel) sel.value = resolved;
      if (seed != null) {
        const seedEl = document.getElementById('seed') as HTMLInputElement | null;
        if (seedEl) seedEl.value = String(seed);
      }
      if (shapeSeed != null) {
        const shapeEl = document.getElementById('shape-seed') as HTMLInputElement | null;
        if (shapeEl) shapeEl.value = String(shapeSeed);
      }
      if (steps != null) {
        const stepsEl = document.getElementById('steps') as HTMLInputElement | null;
        if (stepsEl) stepsEl.value = String(steps);
      }
    }
  }
}

// ---- Side effects: install handlers + expose window.vugg ----
// Only in real browsers. The test harness loads the bundle via
// `new Function(...)` inside Node + jsdom — DOM stubs handle most
// of it, but we still skip the URL boot (no real `location.search`)
// and the keydown wiring (tests call the handler directly).
(function _agentBootSideEffects(): void {
  const isBrowser =
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof (document as any).addEventListener === 'function' &&
    // Vitest sets __VITEST__ on the global; the test harness loads
    // 99z inside `new Function(body)` so window/document exist (jsdom)
    // but the boot side-effects shouldn't fire.
    typeof (globalThis as any).__VITEST__ === 'undefined' &&
    !(globalThis as any).__vugg_skip_agent_boot;

  _agentExposeWindow();

  if (isBrowser) {
    document.addEventListener('keydown', _agentKeyHandler);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => { _agentBootFromURL(); });
    } else {
      _agentBootFromURL();
    }
  }
})();

// ---- Test hooks: expose helpers to vitest without DOM coupling ----
(function _agentTestHooks(): void {
  if (typeof globalThis === 'undefined') return;
  (globalThis as any).__vugg_agent_test_hooks = {
    _agentIsTutorial,
    _agentParamInt,
    _agentParamBool,
    _agentDeterministicPick,
    _agentSpecimenJSON,
    _agentHeadlessRun,
    _agentKeyHandler,
    _agentExposeWindow,
    _agentBootFromURL,
  };
})();
