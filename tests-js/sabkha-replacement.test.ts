import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare function setSeed(seed: number): void;

describe('absolute fluid-replacement events', () => {
  it('keeps every sabkha voxel alkaline through all twelve flood/evaporation cycles', () => {
    setSeed(42);
    const { conditions, events, defaultSteps } = SCENARIOS.sabkha_dolomitization();
    const sim = new VugSimulator(conditions, events);
    let minimum = Infinity;
    let maximum = -Infinity;
    let minimumStep = -1;

    for (let step = 0; step < defaultSteps; step++) {
      sim.run_step();
      const grid = sim.wall_state.voxelGridFor(sim);
      for (const voxel of grid.voxels) {
        const pH = voxel?.fluid?.pH;
        if (!Number.isFinite(pH)) continue;
        if (pH < minimum) {
          minimum = pH;
          minimumStep = sim.step;
        }
        maximum = Math.max(maximum, pH);
      }
    }

    expect(minimum, `minimum at simulation step ${minimumStep}`).toBeGreaterThanOrEqual(7.5);
    expect(maximum).toBeLessThanOrEqual(10.0);
  });
});
