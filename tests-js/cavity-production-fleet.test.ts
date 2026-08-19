import { describe, expect, it } from 'vitest';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;

describe('Cartesian cavity production acceptance fleet', () => {
  it('authenticates every authored shape seed at 48³ against the 64³ reference', () => {
    const requested = String(process.env.CAVITY_FLEET_SCENARIOS || '').split(',')
      .map(value => value.trim()).filter(Boolean);
    const scenarioIds = requested.length ? requested : Object.keys(SCENARIOS).sort();
    if (!requested.length) {
      expect(new Set(scenarioIds.map(id => SCENARIOS[id]().conditions.wall.shape_seed)).size)
        .toBeGreaterThan(20);
    }
    const failures: string[] = [];
    const receipts: any[] = [];
    for (const scenarioId of scenarioIds) {
      try {
        setSeed(42);
        const { conditions, events } = SCENARIOS[scenarioId]();
        const authoredShapeSeed = conditions.wall.shape_seed;
        const sim = new VugSimulator(conditions, events);
        const enabled = sim.enableProductionCavityAuthority();
        receipts.push({
          scenarioId,
          shapeSeed: authoredShapeSeed,
          contractDigest: enabled.contract.contract_digest,
          relativeVolumeDifference: enabled.contract.baseline_volume_convergence.relative_difference,
          maxAgreementVoxels: enabled.contract.agreement_gate.max_normal_root_distance_voxels,
        });
      } catch (error: any) {
        failures.push(`${scenarioId}: ${error?.message || String(error)}`);
      }
    }
    console.log('[cavity-production-fleet]', JSON.stringify(receipts));
    expect(failures, failures.join('\n')).toEqual([]);
    expect(receipts).toHaveLength(scenarioIds.length);
    expect(Math.max(...receipts.map(row => row.relativeVolumeDifference))).toBeLessThanOrEqual(0.02);
    expect(Math.max(...receipts.map(row => row.maxAgreementVoxels))).toBeLessThanOrEqual(0.75);
  }, 300_000);
});
