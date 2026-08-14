import { describe, expect, it } from 'vitest';

declare const CavityProductionAuthority: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: any;

describe('Cartesian production authority — evolved Tsumeb witness', () => {
  it('keeps the seed-2 step-111 reference surface closed and receipted', () => {
    // Seed 2 is an intentional witness from the commissioned locality fleet
    // (seeds 1, 2, 42), not a replacement for the ordinary gameplay seed 42.
    // Before the signed near-zero scalar floor, the 64^3 convergence surface
    // lost one tiny but topologically required cap at this exact prefix.
    setSeed(2);
    const { conditions, events } = SCENARIOS.supergene_oxidation();
    expect(conditions.wall.shape_seed).toBe(7);
    const sim = new VugSimulator(conditions, events);
    for (let step = 0; step < 111; step++) sim.run_step();

    expect(sim.step).toBe(111);
    const wall = sim.wall_state;
    const ledger = wall.cavityEvolutionLedger();
    expect(ledger.cursor).toBeGreaterThan(0);
    const entry = ledger.entries[ledger.cursor - 1];
    const authority = entry.geometry_authority;
    expect(authority.topology).toMatch(/near-zero.*spacing\/4096 scalar floor/i);
    expect(authority.agreement.unresolved_sample_count).toBe(0);
    expect(authority.agreement.max_field_residual)
      .toBeLessThanOrEqual(authority.agreement.numerical_zero_tolerance);
    expect(authority.volume_convergence.relative_difference).toBeLessThanOrEqual(0.02);
    expect(authority.volume_model).toBe('cartesian-field-freudenthal-volume-v2');

    const active = wall.activeCavitySurfaceAnchorProvider();
    expect(active.surface.topology).toMatchObject({
      negative_border: true,
      nonempty: true,
      closed_two_manifold: true,
    });
    expect(() => CavityProductionAuthority.authenticateSurface(
      wall,
      active.field,
      active.surface,
      wall._cavityProductionAuthorityContract,
      ledger.cursor,
    )).not.toThrow();
  }, 120_000);
});
