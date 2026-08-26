import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import {
  validateBisbeeProductionBudgetReceipt,
} from '../tools/bisbee-production-budget-contract.mjs';

const validBudgetReceipt = () => ({
  schema: 'bisbee-production-budget-v2',
  scenario: 'bisbee',
  simulation_seed: 42,
  shape_seed: 13,
  steps: 70,
  accepted_erosions: 6,
  full_surface_resolutions: [48, 64, 48, 64, 48, 64, 48, 64, 48, 64, 48, 64],
  provider_full_authentications: 0,
  erosion_authority: Array.from({ length: 6 }, (_, index) => ({
    event_id: index + 1,
    field_build_and_extract_evaluations: 2,
    production_48: 1,
    reference_64: 1,
    provider_install: 0,
    volume_only_field_evaluations: 39,
  })),
  elapsed_ms: 45_999,
  elapsed_allowance_ms: 46_000,
  maximum_step_ms: 4_999.9,
  process_cpu_ms: 32_000,
  peak_rss_mb: 639.9,
  peak_heap_mb: 383.9,
  peak_external_mb: 95.9,
  peak_array_buffers_mb: 63.9,
});

describe('Bisbee production-cavity full-operation budget', () => {
  it('runs seed 42 through the acidic step-65 interval with bounded authority work and memory', () => {
    // Pin the intended workstation/mobile-conscious heap envelope. Without a
    // cap V8 may defer collection and report scheduler-dependent transient
    // peaks even though the forced-GC plateau is stable.
    const output = execFileSync(process.execPath, [
      '--max-old-space-size=384', 'tools/bisbee-production-budget.mjs',
    ], {
      cwd: process.cwd(), encoding: 'utf8', timeout: 55_000,
      maxBuffer: 1024 * 1024,
    });
    const line = output.split(/\r?\n/)
      .find(value => value.startsWith('[bisbee-production-budget] '));
    expect(line).toBeTruthy();
    const receipt = JSON.parse(line!.slice('[bisbee-production-budget] '.length));
    expect(receipt).toMatchObject({
      schema: 'bisbee-production-budget-v2',
      scenario: 'bisbee', simulation_seed: 42, shape_seed: 13,
      steps: 70, accepted_erosions: 6,
      full_surface_resolutions: [48, 64, 48, 64, 48, 64, 48, 64, 48, 64, 48, 64],
      provider_full_authentications: 0,
      elapsed_allowance_ms: 46_000,
    });
    expect(validateBisbeeProductionBudgetReceipt(receipt)).toBe(true);
    expect(receipt.peak_rss_mb).toBeLessThan(640);
    console.log(line);
  }, 70_000);

  it('fails closed at every workload, time, and memory boundary', () => {
    expect(validateBisbeeProductionBudgetReceipt(validBudgetReceipt())).toBe(true);
    const rejects = (mutate: (receipt: any) => void) => {
      const receipt = structuredClone(validBudgetReceipt());
      mutate(receipt);
      expect(() => validateBisbeeProductionBudgetReceipt(receipt)).toThrow();
    };
    rejects(receipt => { receipt.elapsed_ms = 46_000; });
    rejects(receipt => { receipt.elapsed_allowance_ms = 46_001; });
    rejects(receipt => { receipt.maximum_step_ms = 5_000; });
    rejects(receipt => { receipt.accepted_erosions = 7; });
    rejects(receipt => { receipt.full_surface_resolutions.push(48); });
    rejects(receipt => { receipt.full_surface_resolutions[1] = 48; });
    rejects(receipt => { receipt.provider_full_authentications = 1; });
    rejects(receipt => { receipt.erosion_authority[0].volume_only_field_evaluations = 40; });
    rejects(receipt => { receipt.peak_rss_mb = 640; });
    rejects(receipt => { receipt.peak_heap_mb = 384; });
    rejects(receipt => { receipt.peak_external_mb = 96; });
    rejects(receipt => { receipt.peak_array_buffers_mb = 64; });
  });

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
