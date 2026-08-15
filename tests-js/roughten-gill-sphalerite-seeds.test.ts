// Roughten Gill sphalerite widened-seed coverage — own file so it can
// run in parallel with brochantite-seeds (and the rest of the suite).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runScenario(scenarioName: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

const SEEDS = [42, 1, 7, 13, 99, 2024, 17, 3, 5, 11, 23, 47, 71, 137, 211, 313];

describe('Roughten Gill — sphalerite seed coverage', () => {
  it('fires sphalerite as Zn primary across the seed sample', { timeout: 150000 }, () => {
    let anyHit = 0;
    for (const seed of SEEDS) {
      const s = runScenario('roughten_gill', seed);
      if (s.crystals.filter((c: any) => c.mineral === 'sphalerite').length > 0) anyHit++;
    }
    expect(anyHit,
      `expected at least 1/${SEEDS.length} roughten_gill seeds to fire sphalerite; got ${anyHit}/${SEEDS.length}`)
      .toBeGreaterThan(0);
  });
});
