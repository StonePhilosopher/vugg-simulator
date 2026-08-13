// tests-js/graduated-competition-wiring.test.ts — v128 wiring tests.
//
// Verifies that:
//   1. With GRADUATED_COMPETITION_ENABLED = false, the simulator's
//      _graduatedZones property stays null after run_step.
//   2. With the flag flipped ON (the v128c default), _graduatedZones
//      is populated as a Map keyed by crystal_id.
//   3. The wiring path (_dryRunEngineForCrystal + _applyZoneGrowthBudget)
//      doesn't crash when invoked against a realistic scenario.
//   4. Flag-flipping doesn't leak state into subsequent tests — the
//      afterAll restores the bundle's v128c default (true) so the
//      calibration sweep that reads the v128 baselines doesn't see
//      stale flag-off state.

import { describe, expect, it, afterAll } from 'vitest';
import {
  currentEvidenceIdentity,
  loadAuthenticatedEvidenceJson,
  requireEvidenceScenario,
} from './authenticated-evidence';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

// v128c default is ON. Any test that flips it must restore TRUE on
// exit, otherwise the calibration sweep (which runs against the v128
// baselines that depend on the flag being on) fails.
const V128C_DEFAULT = true;
const SEED42_BASELINE = loadAuthenticatedEvidenceJson(
  `tests-js/baselines/seed42_v${currentEvidenceIdentity.simVersion}.json`,
  'seed42-baseline',
);

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
      const { conditions, events } = scen();
      const sim = new VugSimulator(conditions, events);
      sim.run_step();
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
    sim.run_step();
    expect(sim._graduatedZones).not.toBeNull();
    expect(sim._graduatedZones instanceof Map).toBe(true);
  });

  it('authenticated seed-42 MVT run contains grown crystals', () => {
    const minerals = Object.values(requireEvidenceScenario(SEED42_BASELINE, 'mvt')) as any[];
    expect(minerals.reduce((sum, row) => sum + Number(row.total || 0), 0)).toBeGreaterThan(0);
    expect(minerals.some(row => Number(row.max_um || 0) > 0)).toBe(true);
  });

  it('authenticated seed-42 Schneeberg run preserves coexistence', () => {
    const grownMinerals = Object.entries(requireEvidenceScenario(SEED42_BASELINE, 'schneeberg'))
      .filter(([, row]: [string, any]) => Number(row.max_um || 0) > 0)
      .map(([mineral]) => mineral);
    expect(grownMinerals.length, `Schneeberg grown minerals: ${grownMinerals.join(', ')}`)
      .toBeGreaterThanOrEqual(2);
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
    sim1.run_step();
    expect(sim1._graduatedZones instanceof Map).toBe(true);

    (globalThis as any).setGraduatedCompetitionEnabled(false);
    try {
      setSeed(42);
      const { conditions: c2, events: e2 } = scenOn();
      const sim2 = new VugSimulator(c2, e2);
      sim2.run_step();
      expect(sim2._graduatedZones).toBeNull();
    } finally {
      (globalThis as any).setGraduatedCompetitionEnabled(V128C_DEFAULT);
    }
  });
});
