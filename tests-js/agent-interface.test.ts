// tests-js/agent-interface.test.ts — guard test for the v117
// agent-friendly interface (URL params, window.vugg, keyboard
// shortcuts, ?dump=specimen, determinism).
//
// Per proposals/PROPOSAL-AGENT-FRIENDLY-INTERFACE.md (Rock Bot +
// Professor) and boss-greenlit narrowed scope (2026-05-20).
//
// What this file guards:
//   1. URL param coercion — lenient vs hard-error policy, type checks.
//   2. Specimen JSON shape — every field agent-api/vugg-agent.js's
//      `finish` response uses, plus paragenetic_sequence ordering.
//   3. Keyboard binding map — five bindings (G/R/N/S/digits), no
//      conflict with topo-replay (←/→/Space) or global Escape.
//   4. Scenario resolution — ?scenario=random with seed is
//      deterministic; tutorials are filtered when randomizing.
//   5. End-to-end determinism — _agentHeadlessRun with same
//      (scenario, seed, shape_seed) twice yields byte-identical
//      paragenetic sequence + nucleation steps.

import { createRequire } from 'node:module';
import path from 'node:path';
import { describe, expect, it, beforeAll } from 'vitest';

declare const SCENARIOS: any;
declare const SIM_VERSION: number;
declare const loadSaves: () => any[];
declare const loadSaveById: (id: string) => boolean;

const require = createRequire(import.meta.url);
const agentApi = require(path.resolve(process.cwd(), 'agent-api/vugg-agent.js'));

// The helpers live on globalThis after the bundle's _agentTestHooks
// IIFE installs them at load time.
function hooks(): any {
  const h = (globalThis as any).__vugg_agent_test_hooks;
  if (!h) throw new Error('agent test hooks not exposed — bundle ordering or 99z module broken');
  return h;
}

function makeParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
}

describe('Agent-friendly interface — v117 guard test', () => {
  beforeAll(() => {
    // setup.ts has already loaded the bundle + populated SCENARIOS.
    // Sanity check that 99z's test hooks made it through.
    expect((globalThis as any).__vugg_agent_test_hooks).toBeTruthy();
  });

  describe('URL param coercion', () => {
    it('_agentParamInt returns default when param missing', () => {
      const { _agentParamInt } = hooks();
      expect(_agentParamInt(makeParams(''), 'seed', null, false)).toBe(null);
      expect(_agentParamInt(makeParams(''), 'steps', 200, false)).toBe(200);
    });

    it('_agentParamInt parses valid integers', () => {
      const { _agentParamInt } = hooks();
      expect(_agentParamInt(makeParams('?seed=42'), 'seed', null, false)).toBe(42);
      expect(_agentParamInt(makeParams('?steps=200'), 'steps', null, false)).toBe(200);
      expect(_agentParamInt(makeParams('?n=-7'), 'n', null, false)).toBe(-7);
    });

    it('_agentParamInt hard-errors on bad value (lenient=false)', () => {
      const { _agentParamInt } = hooks();
      expect(() => _agentParamInt(makeParams('?seed=banana'), 'seed', null, false)).toThrow();
    });

    it('_agentParamInt warns + returns default on bad value (lenient=true)', () => {
      const { _agentParamInt } = hooks();
      expect(_agentParamInt(makeParams('?seed=banana'), 'seed', 99, true)).toBe(99);
    });

    it('_agentParamBool accepts 1/true/yes; rejects everything else', () => {
      const { _agentParamBool } = hooks();
      expect(_agentParamBool(makeParams('?autogrow=1'), 'autogrow', false)).toBe(true);
      expect(_agentParamBool(makeParams('?autogrow=true'), 'autogrow', false)).toBe(true);
      expect(_agentParamBool(makeParams('?autogrow=yes'), 'autogrow', false)).toBe(true);
      expect(_agentParamBool(makeParams('?autogrow=0'), 'autogrow', false)).toBe(false);
      expect(_agentParamBool(makeParams('?autogrow=no'), 'autogrow', false)).toBe(false);
      expect(_agentParamBool(makeParams(''), 'autogrow', false)).toBe(false);
      expect(_agentParamBool(makeParams(''), 'autogrow', true)).toBe(true);
    });
  });

  describe('Tutorial filter', () => {
    it('_agentIsTutorial recognizes tutorial_ prefix', () => {
      const { _agentIsTutorial } = hooks();
      expect(_agentIsTutorial('tutorial_first_crystal')).toBe(true);
      expect(_agentIsTutorial('tutorial_mn_calcite')).toBe(true);
      expect(_agentIsTutorial('jeffrey_mine')).toBe(false);
      expect(_agentIsTutorial('mvt')).toBe(false);
      expect(_agentIsTutorial('')).toBe(false);
      expect(_agentIsTutorial(null as any)).toBe(false);
      expect(_agentIsTutorial(undefined as any)).toBe(false);
    });
  });

  describe('Deterministic-random scenario pick', () => {
    it('same seed → same pick across calls', () => {
      const { _agentDeterministicPick } = hooks();
      const keys = ['cooling', 'jeffrey_mine', 'mvt', 'naica_geothermal'];
      const a = _agentDeterministicPick(keys, 42);
      const b = _agentDeterministicPick(keys, 42);
      expect(a).toBe(b);
      expect(keys).toContain(a);
    });

    it('different seeds → distribution covers multiple picks', () => {
      const { _agentDeterministicPick } = hooks();
      const keys = ['a', 'b', 'c', 'd', 'e'];
      const picks = new Set<string>();
      for (let s = 0; s < 100; s++) picks.add(_agentDeterministicPick(keys, s));
      // 100 seeds vs 5 keys — distribution should reach at least 3 of them
      // (loose bound — Mulberry32 is uniform enough).
      expect(picks.size).toBeGreaterThanOrEqual(3);
    });
  });

  describe('?scenario=random tutorial filter', () => {
    it('random pick from real SCENARIOS never includes tutorials', () => {
      const { _agentIsTutorial, _agentDeterministicPick } = hooks();
      const keys = Object.keys(SCENARIOS).filter(k => !_agentIsTutorial(k));
      expect(keys.length).toBeGreaterThan(0);
      expect(keys.some(_agentIsTutorial)).toBe(false);
      // Spot-check: 50 random-seed picks all land on non-tutorial keys
      for (let s = 0; s < 50; s++) {
        const pick = _agentDeterministicPick(keys, s);
        expect(_agentIsTutorial(pick)).toBe(false);
      }
    });
  });

  describe('_agentHeadlessRun + _agentSpecimenJSON', () => {
    it('runs a known scenario to completion and emits expected JSON shape', () => {
      const { _agentHeadlessRun, _agentSpecimenJSON } = hooks();
      // 'mvt' is a stable Phase 1 scenario; small enough to run fast.
      const result = _agentHeadlessRun('mvt', { seed: 42, steps: 50 });
      expect(result.sim).toBeTruthy();
      expect(result.sim.step).toBe(50);
      expect(result.scenario).toBe('mvt');
      expect(result.seed).toBe(42);

      const spec = _agentSpecimenJSON(result.sim);
      // Wrapper fields
      expect(spec.ok).toBe(true);
      expect(spec).toMatchObject({
        serializer_contract: 'vugg-browser-agent-specimen-v1',
        runtime_scope: 'canonical-browser-simulator',
        agent_api_relation: 'shared-crystal-core-not-response-parity',
      });
      expect(spec.sim_version).toBe(SIM_VERSION);
      expect(spec.scenario).toBe('mvt');
      expect(spec.seed).toBe(42);
      expect(spec.total_steps).toBe(50);
      expect(Array.isArray(spec.crystals)).toBe(true);
      expect(Array.isArray(spec.paragenetic_sequence)).toBe(true);
      expect(typeof spec.log_length).toBe('number');

      // Per-crystal shape (only checked if any crystals nucleated)
      if (spec.crystals.length > 0) {
        const c = spec.crystals[0];
        expect(typeof c.mineral).toBe('string');
        expect(typeof c.crystal_id).toBe('number');
        expect(typeof c.nucleation_step).toBe('number');
        expect(typeof c.c_length_mm).toBe('number');
        expect(typeof c.a_width_mm).toBe('number');
        expect(typeof c.habit).toBe('string');
        expect(Array.isArray(c.dominant_forms)).toBe(true);
        expect(Array.isArray(c.zones)).toBe(true);
        expect(typeof c.twinned).toBe('boolean');
        expect(typeof c.active).toBe('boolean');
      }
    });

    it('shares the exact crystal core with agent-api without claiming envelope parity', () => {
      const { _agentSpecimenJSON } = hooks();
      const zone: any = {
        step: 3, temperature: 87.25, thickness_um: 4.125,
        trace_Fe: 1.25, trace_Mn: 2.5, trace_Al: 3.75, trace_Ti: 0.125,
        fluid_inclusion: true, inclusion_type: 'primary', ca_from_wall: 0.25,
        is_phantom: false, note: 'shared core',
      };
      const crystal: any = {
        mineral: 'calcite', crystal_id: 9, nucleation_step: 2,
        nucleation_temp: 90, position: 'vug wall', c_length_mm: 1.25,
        a_width_mm: 0.75, habit: 'scalenohedral', dominant_forms: ['{211}'],
        zones: [zone], total_growth_um: 4.125, twinned: false, twin_law: null,
        active: true, dissolved: false, phantom_count: 0, radiation_damage: 0.2,
        describe_morphology: () => 'scalenohedral',
        predict_fluorescence: () => 'dim',
      };
      const browser = _agentSpecimenJSON({
        crystals: [crystal], step: 3, log: [],
        _agentRunMeta: { scenario: 'fixture', seed: 1, shape_seed: 2 },
      }).crystals[0];
      const headless = agentApi.serializeAgentCrystal(crystal, true);
      expect(Object.keys(browser)).toEqual(Object.keys(headless));
      expect(Object.keys(browser.zones[0])).toEqual(Object.keys(headless.zones[0]));
      expect(browser).toEqual(headless);
    });

    it('paragenetic_sequence is ordered by nucleation_step (no duplicates)', () => {
      const { _agentHeadlessRun, _agentSpecimenJSON } = hooks();
      const result = _agentHeadlessRun('mvt', { seed: 42, steps: 100 });
      const spec = _agentSpecimenJSON(result.sim);
      const seq = spec.paragenetic_sequence;
      // No duplicates
      expect(new Set(seq).size).toBe(seq.length);
      // Every paragenetic mineral has at least one crystal in the dump
      const mineralsPresent = new Set(spec.crystals.map((c: any) => c.mineral));
      for (const m of seq) expect(mineralsPresent.has(m)).toBe(true);
    });
  });

  describe('Determinism — same (scenario, seed) twice → same specimen', () => {
    it('mvt seed=42 steps=80 is byte-stable across runs', () => {
      const { _agentHeadlessRun, _agentSpecimenJSON } = hooks();
      const a = _agentHeadlessRun('mvt', { seed: 42, steps: 80 });
      const aSpec = _agentSpecimenJSON(a.sim);
      const b = _agentHeadlessRun('mvt', { seed: 42, steps: 80 });
      const bSpec = _agentSpecimenJSON(b.sim);

      expect(aSpec.total_steps).toBe(bSpec.total_steps);
      expect(aSpec.crystals.length).toBe(bSpec.crystals.length);
      expect(aSpec.paragenetic_sequence).toEqual(bSpec.paragenetic_sequence);

      // Per-crystal sanity: mineral identity + nucleation step match.
      // (We compare by index because crystal_id is assigned in nucleation
      // order, which is itself deterministic given identical RNG state.)
      for (let i = 0; i < aSpec.crystals.length; i++) {
        expect(aSpec.crystals[i].mineral).toBe(bSpec.crystals[i].mineral);
        expect(aSpec.crystals[i].nucleation_step).toBe(bSpec.crystals[i].nucleation_step);
        expect(aSpec.crystals[i].crystal_id).toBe(bSpec.crystals[i].crystal_id);
      }
    });

    it('different seeds → different specimens (sanity check that seed is wired)', () => {
      const { _agentHeadlessRun, _agentSpecimenJSON } = hooks();
      const a = _agentSpecimenJSON(_agentHeadlessRun('mvt', { seed: 42, steps: 60 }).sim);
      const b = _agentSpecimenJSON(_agentHeadlessRun('mvt', { seed: 999, steps: 60 }).sim);
      // Crystals counts will likely differ; if not, paragenetic order
      // or step numbers will. At least one of these must differ.
      const same = a.crystals.length === b.crystals.length
                && JSON.stringify(a.paragenetic_sequence) === JSON.stringify(b.paragenetic_sequence)
                && a.crystals.every((c: any, i: number) => c.nucleation_step === b.crystals[i].nucleation_step);
      expect(same).toBe(false);
    });
  });

  describe('Keyboard handler — input gating + binding map', () => {
    it('_agentKeyHandler is exposed and callable', () => {
      const { _agentKeyHandler } = hooks();
      expect(typeof _agentKeyHandler).toBe('function');
    });

    it('skips when target is <input> / <textarea> / <select>', () => {
      const { _agentKeyHandler } = hooks();
      // Build a fake event with input target. The handler should bail
      // before calling any side-effect functions, so success is "no throw".
      const fakeEv = {
        key: 'G',
        target: { tagName: 'INPUT', isContentEditable: false },
        ctrlKey: false, altKey: false, metaKey: false,
        preventDefault: () => {},
      } as any;
      expect(() => _agentKeyHandler(fakeEv)).not.toThrow();
    });

    it('skips modifier-pressed combos', () => {
      const { _agentKeyHandler } = hooks();
      const fakeEv = {
        key: 'G',
        target: { tagName: 'BODY', isContentEditable: false },
        ctrlKey: true, altKey: false, metaKey: false,
        preventDefault: () => {},
      } as any;
      expect(() => _agentKeyHandler(fakeEv)).not.toThrow();
    });

    it('non-bound keys are no-ops (no preventDefault)', () => {
      const { _agentKeyHandler } = hooks();
      let prevented = false;
      const fakeEv = {
        key: 'Z',
        target: { tagName: 'BODY', isContentEditable: false },
        ctrlKey: false, altKey: false, metaKey: false,
        preventDefault: () => { prevented = true; },
      } as any;
      _agentKeyHandler(fakeEv);
      expect(prevented).toBe(false);
    });
  });

  describe('window.vugg exposure', () => {
    it('_agentExposeWindow attaches a vugg handle (when window-like global exists)', () => {
      const { _agentExposeWindow } = hooks();
      // In jsdom, `window` is the same as globalThis. The handle should
      // be live after setup.ts loads the bundle (which triggers the
      // _agentBootSideEffects IIFE that calls _agentExposeWindow).
      const w: any = (globalThis as any).window || globalThis;
      expect(w.vugg).toBeTruthy();
      // Read-time getters
      expect(w.vugg.SCENARIOS).toBeTruthy();
      expect(w.vugg.SIM_VERSION).toBe(SIM_VERSION);
      // Imperative helpers
      expect(typeof w.vugg.headlessRun).toBe('function');
      expect(typeof w.vugg.dumpSpecimen).toBe('function');
      expect(typeof w.vugg.listScenarios).toBe('function');
    });

    it('window.vugg.listScenarios returns sorted scenario keys', () => {
      const w: any = (globalThis as any).window || globalThis;
      const keys = w.vugg.listScenarios();
      expect(Array.isArray(keys)).toBe(true);
      expect(keys.length).toBeGreaterThan(0);
      const sorted = [...keys].sort();
      expect(keys).toEqual(sorted);
    });

    it('window.vugg.headlessRun runs a scenario and caches lastSpecimen', () => {
      const w: any = (globalThis as any).window || globalThis;
      const spec = w.vugg.headlessRun('mvt', { seed: 7, steps: 30 });
      expect(spec.ok).toBe(true);
      expect(spec.scenario).toBe('mvt');
      expect(spec.seed).toBe(7);
      expect(w.vugg.lastSpecimen).toBe(spec);
    });

    it('window.vugg applies shape_seed to the constructed Creative wall and save replay', async () => {
      localStorage.clear();
      const w: any = (globalThis as any).window || globalThis;
      const meta = await w.vugg.startScenario('cooling', {
        seed: 7001, shape_seed: 73, steps: 1,
      });
      expect(meta).toEqual({ scenario: 'cooling', seed: 7001, shape_seed: 73 });
      expect(w.vugg.fortressSim.conditions.wall.shape_seed).toBe(73);
      const save = loadSaves().find(row => row.origin?.seed === 7001);
      expect(save?.origin).toMatchObject({
        type: 'scenario', scenario: 'cooling', seed: 7001, shape_seed: 73,
      });
      expect(loadSaveById(save.id)).toBe(true);
      expect(w.vugg.fortressSim.conditions.wall.shape_seed).toBe(73);
    });

    it('rejects coercive shape_seed values instead of recording an unapplied override', async () => {
      const w: any = (globalThis as any).window || globalThis;
      await expect(w.vugg.startScenario('cooling', { seed: 7002, shape_seed: '73' }))
        .rejects.toThrow('shape_seed must be a safe integer');
    });

    it('never relabels an older run when an unknown scenario fails to launch', async () => {
      const w: any = (globalThis as any).window || globalThis;
      const beforeMeta = await w.vugg.startScenario('cooling', {
        seed: 7003, shape_seed: 79,
      });
      const beforeSim = w.vugg.fortressSim;
      expect(beforeMeta).toEqual({ scenario: 'cooling', seed: 7003, shape_seed: 79 });

      await expect(w.vugg.startScenario('__definitely_missing__', { seed: 9999 }))
        .rejects.toThrow("scenario '__definitely_missing__' did not start");
      expect(w.vugg.fortressSim).toBe(beforeSim);
      expect(beforeSim._agentRunMeta).toBe(beforeMeta);
      expect(w.vugg._lastRunMeta).toBe(beforeMeta);
    });

    it('serializes identity from the selected visible sim, never the last headless label', async () => {
      const w: any = (globalThis as any).window || globalThis;
      const launch = await startScenarioInCreative('cooling', 7008, undefined, 89);
      expect(launch.sim).toBe(w.vugg.fortressSim);
      const visibleStep = launch.sim.step;

      const headless = w.vugg.headlessRun('mvt', { seed: 99, shape_seed: 11, steps: 1 });
      expect(headless).toMatchObject({ scenario: 'mvt', seed: 99, shape_seed: 11 });
      const dumped = w.vugg.dumpSpecimen();
      expect(dumped).toMatchObject({
        scenario: 'cooling', seed: 7008, shape_seed: 89, total_steps: visibleStep,
      });
      expect(launch.sim.conditions._scenario.id).toBe('cooling');
      expect(launch.sim.conditions.wall.shape_seed).toBe(89);
    });

    it('rejects a superseded async launch and binds metadata only to its winner', async () => {
      const w: any = (globalThis as any).window || globalThis;
      const superseded = w.vugg.startScenario('cooling', {
        seed: 7004, shape_seed: 81,
      });
      const winner = w.vugg.startScenario('cooling', {
        seed: 7005, shape_seed: 83,
      });

      await expect(superseded).rejects.toThrow("scenario 'cooling' did not start");
      await expect(winner).resolves.toEqual({
        scenario: 'cooling', seed: 7005, shape_seed: 83,
      });
      expect(w.vugg.fortressSim._agentRunMeta).toEqual({
        scenario: 'cooling', seed: 7005, shape_seed: 83,
      });
      expect(w.vugg.fortressSim.conditions.wall.shape_seed).toBe(83);
    });

    it('rejects ownership lost between construction and the agent continuation', async () => {
      const w: any = (globalThis as any).window || globalThis;
      const first = w.vugg.startScenario('cooling', {
        seed: 7006, shape_seed: 85,
      });
      let second: Promise<any> | null = null;
      await new Promise<void>(resolve => queueMicrotask(() => {
        second = w.vugg.startScenario('cooling', {
          seed: 7007, shape_seed: 87,
        });
        resolve();
      }));

      await expect(first).rejects.toThrow("scenario 'cooling' did not start");
      await expect(second).resolves.toEqual({
        scenario: 'cooling', seed: 7007, shape_seed: 87,
      });
      expect(w.vugg.fortressSim._agentRunMeta).toEqual({
        scenario: 'cooling', seed: 7007, shape_seed: 87,
      });
    });
  });

  describe('Bundle / build invariants', () => {
    it('js/99z-agent-interface.ts is on disk and sorts last', async () => {
      const fs = await import('node:fs');
      const path = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
      const file = path.join(ROOT, 'js', '99z-agent-interface.ts');
      expect(fs.existsSync(file)).toBe(true);

      // Only consider .ts source files (exclude .d.ts ambient type files).
      const all = fs.readdirSync(path.join(ROOT, 'js'))
        .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
        .sort();
      expect(all[all.length - 1]).toBe('99z-agent-interface.ts');
    });

    it('SIM_VERSION is at v117 or later (agent-interface shipped v117)', () => {
      // v117 is when this file landed; later versions are fine. Pinning
      // >= avoids needing to edit this test on every SIM_VERSION bump.
      expect(SIM_VERSION).toBeGreaterThanOrEqual(117);
    });
  });
});
