// Calibration sweep shard 0/8 — see calibration-lib.ts for why this is sharded.
import { describe, expect, it } from 'vitest';
import { runScenario, scenarioNames } from './helpers';
import {
  CALIBRATION_SHARD_COUNT,
  loadBaseline,
  scenariosForShard,
  summarize,
} from './calibration-lib';

const SHARD = 0;
const { version, baseline } = loadBaseline();

describe(`calibration sweep — seed 42 vs JS baseline (shard ${SHARD}/${CALIBRATION_SHARD_COUNT})`, () => {
  if (!baseline) {
    it.skip(`baseline missing for SIM_VERSION ${version} — run \`node tools/gen-js-baseline.mjs\` to generate`, () => {});
    return;
  }
  for (const name of scenariosForShard(baseline, SHARD)) {
    it(`${name} matches baseline`, () => {
      const sim = runScenario(name, { seed: 42 });
      expect(sim).toBeTruthy();
      expect(summarize(sim)).toEqual(baseline[name]);
    });
  }
  it('baseline + runtime SCENARIOS cover the same set', () => {
    expect(scenarioNames().sort()).toEqual(Object.keys(baseline).sort());
  });
});
