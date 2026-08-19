// tests-js/calibration.test.ts — per-scenario seed-42 calibration
// sweep against the JS-side baseline.
//
// What this catches: any chemistry / engine / RNG ordering change
// that shifts seed-42 output. When SIM_VERSION bumps, the workflow is:
//   1. Bump SIM_VERSION in js/15-version.ts.
//   2. `npm run build`
//   3. `node tools/gen-js-baseline.mjs` → writes
//      tests-js/baselines/seed42_v<N>.json.
//   4. Diff against the previous baseline; commit the new one if the
//      shifts are intentional and within the band you'd defend.
// The test below authenticates the baseline matching the current built
// SIM_VERSION. Missing, stale, or tampered evidence fails closed.
//
// Mirror of vugg-simulator's old Python tests/baselines/seed42_v*.json
// regression sweep, ported to the JS runtime that actually ships.

import { describe, expect, it } from 'vitest';
import { currentEvidenceIdentity, loadAuthenticatedEvidenceJson } from './authenticated-evidence';
import { runScenario, scenarioNames } from './helpers';

const version = currentEvidenceIdentity.simVersion;
const baseline = loadAuthenticatedEvidenceJson(
  `tests-js/baselines/seed42_v${version}.json`,
  'seed42-baseline',
) as Record<string, any>;

function summarize(sim: any): Record<string, any> {
  const out: Record<string, any> = {};
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
  const sorted: Record<string, any> = {};
  for (const k of Object.keys(out).sort()) sorted[k] = out[k];
  return sorted;
}

// SIM 264 commissioning measured the heaviest canonical seed-42 locality
// (Tsumeb/supergene_oxidation) at about 570 s on this host. Keep a finite hang
// detector, but size it above a complete authenticated authored scenario.
const CALIBRATION_SCENARIO_TIMEOUT_MS = 900_000;

describe('calibration sweep — seed 42 vs JS baseline', () => {
  // Iterate over the baseline's known scenarios so the test set is
  // stable even if scenarioNames() comes back empty (e.g. transient
  // bundle init issue). Cross-check that the runtime registry has
  // the same set as the baseline as a separate assertion below.
  const baselineScenarios = Object.keys(baseline).sort();
  for (const name of baselineScenarios) {
    it(`${name} matches baseline`, { timeout: CALIBRATION_SCENARIO_TIMEOUT_MS }, () => {
      const sim = runScenario(name, { seed: 42 });
      expect(sim).toBeTruthy();  // SCENARIOS must include every baseline name
      const got = summarize(sim);
      expect(got).toEqual(baseline[name]);
    });
  }
  it('baseline + runtime SCENARIOS cover the same set', () => {
    const live = scenarioNames();
    const baselineSet = baselineScenarios;
    expect(live.sort()).toEqual(baselineSet);
  });
});
