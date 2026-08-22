import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';

describe('Bisbee production-cavity full-operation budget', () => {
  it('runs seed 42 through the acidic step-65 interval with bounded authority work and memory', () => {
    // Pin the intended workstation/mobile-conscious heap envelope. Without a
    // cap V8 may defer collection and report scheduler-dependent transient
    // peaks even though the forced-GC plateau is stable.
    const output = execFileSync(process.execPath, [
      '--max-old-space-size=384', 'tools/bisbee-production-budget.mjs',
    ], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    const line = output.split(/\r?\n/)
      .find(value => value.startsWith('[bisbee-production-budget] '));
    expect(line).toBeTruthy();
    const receipt = JSON.parse(line!.slice('[bisbee-production-budget] '.length));
    expect(receipt).toMatchObject({
      schema: 'bisbee-production-budget-v1',
      scenario: 'bisbee', simulation_seed: 42, shape_seed: 13,
      steps: 70, accepted_erosions: 6,
      full_surface_resolutions: [48, 64, 48, 64, 48, 64, 48, 64, 48, 64, 48, 64],
      provider_full_authentications: 0,
    });
    expect(receipt.peak_rss_mb).toBeLessThan(640);
    console.log(line);
  }, 60_000);

  it('plateaus after repeated authenticated commits and forced collection', () => {
    const output = execFileSync(process.execPath, [
      '--expose-gc', 'tools/cavity-production-memory-budget.mjs',
    ], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 45_000,
      maxBuffer: 1024 * 1024,
    });
    const line = output.split(/\r?\n/)
      .find(value => value.startsWith('[cavity-production-memory-budget] '));
    expect(line).toBeTruthy();
    const receipt = JSON.parse(
      line!.slice('[cavity-production-memory-budget] '.length),
    );
    expect(receipt).toMatchObject({
      schema: 'cavity-production-memory-budget-v1',
      scenario: 'reactive_wall', simulation_seed: 42, shape_seed: 5,
      commits: 6,
    });
    expect(receipt.samples.map((sample: any) => sample.cursor))
      .toEqual([1, 2, 3, 4, 5, 6]);
    console.log(line);
  }, 60_000);
});
