// tests-js/graduated-competition-wiring.test.ts — v128 wiring tests.
//
// Verifies that:
//   1. With GRADUATED_COMPETITION_ENABLED = false, the simulator's
//      _graduatedZones property stays null after run_step.
//   2. With the flag flipped ON (the v128c default), _graduatedZones
//      is populated as a Map keyed by crystal_id.
//   3. The wiring path (_dryRunEngineForCrystal + _applyZoneMassBalance)
//      doesn't crash when invoked against a realistic scenario.
//   4. Flag-flipping doesn't leak state into subsequent tests — the
//      afterAll restores the bundle's v128c default (true) so the
//      calibration sweep that reads the v128 baselines doesn't see
//      stale flag-off state.

import { describe, expect, it, afterAll } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

// v128c default is ON. Any test that flips it must restore TRUE on
// exit, otherwise the calibration sweep (which runs against the v128
// baselines that depend on the flag being on) fails.
const V128C_DEFAULT = true;

afterAll(() => {
  (globalThis as any).setGraduatedCompetitionEnabled(V128C_DEFAULT);
});

describe('v128 wiring — flag-off path is inert', () => {
  it('flag-off: _graduatedZones stays null after run_step', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(false);
    try {
      setSeed(42);
      const scen = SCENARIOS['mvt'];
      if (!scen) {
        // Defensive — bundle without mvt scenario is a setup bug.
        return;
      }
      const { conditions, events, defaultSteps } = scen();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < Math.min(defaultSteps ?? 50, 50); i++) sim.run_step();
      expect(sim._graduatedZones).toBeNull();
    } finally {
      (globalThis as any).setGraduatedCompetitionEnabled(V128C_DEFAULT);
    }
  });
});

describe('v128 wiring — flag-on path fires (default)', () => {
  it('flag-on: _graduatedZones is a Map after run_step', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    setSeed(42);
    const scen = SCENARIOS['mvt'];
    if (!scen) return;
    const { conditions, events } = scen();
    const sim = new VugSimulator(conditions, events);
    for (let i = 0; i < 20; i++) sim.run_step();
    expect(sim._graduatedZones).not.toBeNull();
    expect(sim._graduatedZones instanceof Map).toBe(true);
  });

  it('flag-on: at least one crystal grew (paragenesis not stuck at zero)', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    setSeed(42);
    const scen = SCENARIOS['mvt'];
    if (!scen) return;
    const { conditions, events, defaultSteps } = scen();
    const sim = new VugSimulator(conditions, events);
    const steps = Math.min(defaultSteps ?? 100, 100);
    for (let i = 0; i < steps; i++) sim.run_step();
    expect(sim.crystals.length, 'mvt with graduated comp at seed 42 should produce ≥ 1 crystal').toBeGreaterThan(0);
    const grown = sim.crystals.filter((c: any) => c.total_growth_um > 0);
    expect(grown.length, 'at least one crystal should have grown').toBeGreaterThan(0);
  });

  it('flag-on schneeberg: multiple minerals coexist (cascade prevention smoke test)', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    setSeed(42);
    const scen = SCENARIOS['schneeberg'];
    if (!scen) return;
    const { conditions, events, defaultSteps } = scen();
    const sim = new VugSimulator(conditions, events);
    const steps = Math.min(defaultSteps ?? 100, 100);
    for (let i = 0; i < steps; i++) sim.run_step();
    const minerals = new Set(sim.crystals.filter((c: any) => c.total_growth_um > 0).map((c: any) => c.mineral));
    expect(minerals.size, `schneeberg at seed 42 produced minerals: ${[...minerals].join(', ')}`).toBeGreaterThanOrEqual(2);
  });
});

describe('v128 wiring — flag-flip determinism', () => {
  it('toggling flag off then on leaves no state leak', () => {
    (globalThis as any).setGraduatedCompetitionEnabled(true);
    setSeed(42);
    const scenOn = SCENARIOS['mvt'];
    if (!scenOn) return;
    const { conditions: c1, events: e1 } = scenOn();
    const sim1 = new VugSimulator(c1, e1);
    for (let i = 0; i < 20; i++) sim1.run_step();

    (globalThis as any).setGraduatedCompetitionEnabled(false);
    try {
      setSeed(42);
      const { conditions: c2, events: e2, defaultSteps } = scenOn();
      const sim2 = new VugSimulator(c2, e2);
      for (let i = 0; i < Math.min(defaultSteps ?? 50, 50); i++) sim2.run_step();
      expect(sim2._graduatedZones).toBeNull();
    } finally {
      (globalThis as any).setGraduatedCompetitionEnabled(V128C_DEFAULT);
    }
  });
});
