// Pharmacolite widened-seed coverage — extracted from pharmacolite.test.ts
// so the ~44s 32-seed schneeberg sweep doesn't serialize behind (or block)
// the fast gate/unit pins in the parent file.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runSchneeberg(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['schneeberg']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 160;
  for (let i = 0; i < steps; i++) sim.run_step();
  return { sim };
}

describe('Pharmacolite — widened seed coverage (parallel-friendly)', () => {
  it('at least one pharmacolite crystal appears across the seed sample', { timeout: 300000 }, () => {
    // History / rationale lives in pharmacolite.test.ts (v136→v214
    // widen + timeout bumps). Scientific intent unchanged: pharmacolite
    // CAN fire somewhere in the broader schneeberg seed space.
    let anyHit = 0;
    const seeds = [
      42, 1, 7, 13, 99, 2024, 17, 3, 5, 11, 23, 47, 71, 137, 211, 313,
      401, 503, 617, 727, 829, 941, 1031, 1129, 1223, 1327, 1429, 1523,
      1627, 1721, 1823, 1931,
    ];
    for (const seed of seeds) {
      const { sim } = runSchneeberg(seed);
      if (sim.crystals.some((c: any) => c.mineral === 'pharmacolite')) anyHit++;
    }
    expect(anyHit,
      `expected at least 1/${seeds.length} schneeberg seeds to fire pharmacolite; got ${anyHit}/${seeds.length}`)
      .toBeGreaterThan(0);
  });
});
