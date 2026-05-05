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
// The test below auto-loads the baseline matching the current
// SIM_VERSION. If a baseline doesn't exist for the current version,
// the test SKIPS (loud green dot is a feature: someone bumped a
// version without writing a baseline; CI flags it but doesn't fail).
//
// Mirror of vugg-simulator's old Python tests/baselines/seed42_v*.json
// regression sweep, ported to the JS runtime that actually ships.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { runScenario, scenarioNames } from './helpers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINES = path.join(ROOT, 'tests-js', 'baselines');

// Read SIM_VERSION from the source file directly rather than from the
// bundle global. The describe-block runs at file-import time, before
// setup.ts's beforeAll has eval'd the bundle — so `globalThis.SIM_VERSION`
// is still undefined when we'd want it. Parsing the source is robust
// across both timings.
function readSimVersion(): number {
  try {
    const src = fs.readFileSync(path.join(ROOT, 'js', '15-version.ts'), 'utf8');
    const m = src.match(/^const SIM_VERSION = (\d+);/m);
    return m ? Number(m[1]) : 0;
  } catch {
    return 0;
  }
}

function loadBaseline(): { version: number; baseline: Record<string, any> | null } {
  const version = readSimVersion();
  const file = path.join(BASELINES, `seed42_v${version}.json`);
  try {
    return { version, baseline: JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch {
    return { version, baseline: null };
  }
}

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

const { version, baseline } = loadBaseline();

describe('calibration sweep — seed 42 vs JS baseline', () => {
  if (!baseline) {
    it.skip(`baseline missing for SIM_VERSION ${version} — run \`node tools/gen-js-baseline.mjs\` to generate`, () => {});
    return;
  }
  // Iterate over the baseline's known scenarios so the test set is
  // stable even if scenarioNames() comes back empty (e.g. transient
  // bundle init issue). Cross-check that the runtime registry has
  // the same set as the baseline as a separate assertion below.
  const baselineScenarios = Object.keys(baseline).sort();
  for (const name of baselineScenarios) {
    it(`${name} matches baseline`, () => {
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
