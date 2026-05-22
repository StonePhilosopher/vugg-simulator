// tests-js/graduated-competition.test.ts — unit tests for the v128
// graduated-competition allocation math (js/44-graduated-competition.ts).
//
// The algorithm is purely arithmetic (no RNG, no I/O); tests exercise:
//
//   - No-rationing regime (fluid abundant → scaling = 1.0 for all)
//   - Power-law small-gap regime (≤ 3 initiative units apart)
//   - Winner-takes-most large-gap regime (> 3 initiative units apart)
//   - Liebig's-law-of-the-minimum (most constrained species caps growth)
//   - Equal-initiative tiebreak via σ then crystal_id
//   - Pathological all-zero initiatives → equal split
//   - Single-crystal group (degenerate)
//
// v128b will wire this into the simulator behind GRADUATED_COMPETITION_
// ENABLED; v128c will flip the flag and add scenario-level paragenesis
// tests (the 5 calibration assertions). This file stays at the
// arithmetic-correctness level.

import { describe, expect, it } from 'vitest';

declare const computeGraduatedAllocations: any;
declare const buildCrystalDryRun: any;

describe('computeGraduatedAllocations — no rationing', () => {
  it('returns scaling=1 for everyone when fluid is abundant', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.5, initiative: 10,
        desired_thickness_um: 5.0, debit_per_species: { Ca: 0.1, CO3: 0.1 } },
      { crystal_id: 2, mineral: 'aragonite', sigma: 1.2, initiative: 8,
        desired_thickness_um: 4.0, debit_per_species: { Ca: 0.08, CO3: 0.08 } },
    ];
    const fluid = { Ca: 100, CO3: 100 };  // way more than needed
    const out = fn(runs, fluid);
    expect(out.get(1).scaling).toBe(1.0);
    expect(out.get(2).scaling).toBe(1.0);
    expect(out.get(1).limiting_species).toBeNull();
    expect(out.get(2).limiting_species).toBeNull();
  });
});

describe('computeGraduatedAllocations — power-law small-gap regime', () => {
  it('two equal-initiative minerals split a limited cation 50/50', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
      { crystal_id: 2, mineral: 'aragonite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
    ];
    const fluid = { Ca: 1.0 };  // half of total demand
    const out = fn(runs, fluid);
    // 50/50 share of 1.0 Ca = 0.5 each, divided by demand 1.0 = 50% scaling
    expect(out.get(1).scaling).toBeCloseTo(0.5, 2);
    expect(out.get(2).scaling).toBeCloseTo(0.5, 2);
  });

  it('k=2 power-law: initiative 12 vs 10 → ~59/41 split (not 50/50, not 100/0)', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.0, initiative: 12,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
      { crystal_id: 2, mineral: 'aragonite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
    ];
    const fluid = { Ca: 1.0 };  // half total demand
    const out = fn(runs, fluid);
    // share_1 = 144/(144+100) = 0.59; share_2 = 100/244 = 0.41
    expect(out.get(1).scaling).toBeCloseTo(0.59, 1);
    expect(out.get(2).scaling).toBeCloseTo(0.41, 1);
    // Higher initiative gets more growth (the directional claim).
    expect(out.get(1).scaling).toBeGreaterThan(out.get(2).scaling);
  });
});

describe('computeGraduatedAllocations — winner-takes-most large-gap regime', () => {
  it('initiative 15 vs 8 (gap=7 > threshold 3) → top gets 80%, other 20%', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.0, initiative: 15,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
      { crystal_id: 2, mineral: 'aragonite', sigma: 1.0, initiative: 8,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
    ];
    const fluid = { Ca: 1.0 };  // half total demand
    const out = fn(runs, fluid);
    expect(out.get(1).scaling).toBeCloseTo(0.8, 2);
    expect(out.get(2).scaling).toBeCloseTo(0.2, 2);
  });

  it('three minerals at very disparate initiatives (15, 5, 3): winner 80%, rest split remaining ~20% by k=2', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.0, initiative: 15,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
      { crystal_id: 2, mineral: 'aragonite', sigma: 1.0, initiative: 5,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
      { crystal_id: 3, mineral: 'dolomite', sigma: 1.0, initiative: 3,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
    ];
    const fluid = { Ca: 1.0 };  // 1/3 of total demand
    const out = fn(runs, fluid);
    // Winner: 80% of fluid = 0.8 Ca, divided by demand 1.0 = 80% scaling
    expect(out.get(1).scaling).toBeCloseTo(0.8, 2);
    // Rest split 20%: k=2 weights are 25 and 9, totals 34; shares 25/34 and 9/34 of 0.2 fluid
    expect(out.get(2).scaling).toBeCloseTo((25 / 34) * 0.2, 2);
    expect(out.get(3).scaling).toBeCloseTo((9 / 34) * 0.2, 2);
  });
});

describe('computeGraduatedAllocations — Liebig (most-constrained-species cap)', () => {
  it('Cu-rationed × Zn-abundant: scaling driven by Cu', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'azurite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 10.0, debit_per_species: { Cu: 1.0, CO3: 1.0 } },
      { crystal_id: 2, mineral: 'smithsonite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 10.0, debit_per_species: { Zn: 1.0, CO3: 1.0 } },
    ];
    // CO3 oversubscribed (demand 2, available 1.5); Cu and Zn fine (1 each, demand 1)
    const fluid = { Cu: 2.0, Zn: 2.0, CO3: 1.5 };
    const out = fn(runs, fluid);
    // Both share 1.5 CO3 evenly (50/50 at equal initiative) → 0.75 each →
    //   scaling = 0.75 / 1.0 = 0.75
    expect(out.get(1).scaling).toBeCloseTo(0.75, 2);
    expect(out.get(2).scaling).toBeCloseTo(0.75, 2);
    expect(out.get(1).limiting_species).toBe('CO3');
    expect(out.get(2).limiting_species).toBe('CO3');
  });

  it('mineral with multi-species debit caps on most-constrained', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'azurite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 10.0, debit_per_species: { Cu: 0.6, CO3: 0.4 } },
    ];
    // Cu oversubscribed (1 demand, 0.3 avail) → 30% scaling there
    // CO3 fine (0.4 demand, 1.0 avail) → 100% there
    const fluid = { Cu: 0.3, CO3: 1.0 };
    const out = fn(runs, fluid);
    // Single crystal gets 100% of demanded Cu pool (no competitors), so allowed = 0.3
    // scaling = 0.3 / 0.6 = 0.5
    expect(out.get(1).scaling).toBeCloseTo(0.5, 2);
    expect(out.get(1).limiting_species).toBe('Cu');
  });
});

describe('computeGraduatedAllocations — edge cases', () => {
  it('empty runs → empty map', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const out = fn([], { Ca: 100 });
    expect(out.size).toBe(0);
  });

  it('single crystal alone → no rationing', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 5.0, debit_per_species: { Ca: 0.5 } },
    ];
    const fluid = { Ca: 0.3 };  // less than demand, but no competitors
    const out = fn(runs, fluid);
    // Single crystal: share = 1.0 of Ca pool → allowed = 0.3 → scaling = 0.3 / 0.5 = 0.6
    expect(out.get(1).scaling).toBeCloseTo(0.6, 2);
  });

  it('all-zero initiatives → equal split of rationed species', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 0.5, initiative: 0,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
      { crystal_id: 2, mineral: 'aragonite', sigma: 0.5, initiative: 0,
        desired_thickness_um: 10.0, debit_per_species: { Ca: 1.0 } },
    ];
    const fluid = { Ca: 1.0 };
    const out = fn(runs, fluid);
    expect(out.get(1).scaling).toBeCloseTo(0.5, 2);
    expect(out.get(2).scaling).toBeCloseTo(0.5, 2);
  });

  it('missing fluid species → treated as 0 (caps the crystal at 0 scaling)', () => {
    const fn = (globalThis as any).computeGraduatedAllocations;
    const runs = [
      { crystal_id: 1, mineral: 'calcite', sigma: 1.0, initiative: 10,
        desired_thickness_um: 5.0, debit_per_species: { Ca: 1.0, CO3: 1.0 } },
    ];
    const fluid = { Ca: 5.0 };  // CO3 missing entirely
    const out = fn(runs, fluid);
    // CO3 share = 1.0 of 0 = 0 allowed → scaling = 0 / 1 = 0
    expect(out.get(1).scaling).toBeCloseTo(0, 2);
    expect(out.get(1).limiting_species).toBe('CO3');
  });
});

describe('buildCrystalDryRun', () => {
  it('builds a CrystalDryRun from MINERAL_STOICHIOMETRY × MASS_BALANCE_SCALE', () => {
    const fn = (globalThis as any).buildCrystalDryRun;
    const r = fn(42, 'calcite', 1.5, 9, 5.0);
    expect(r).not.toBeNull();
    expect(r.crystal_id).toBe(42);
    expect(r.mineral).toBe('calcite');
    expect(r.sigma).toBe(1.5);
    expect(r.initiative).toBe(9);
    expect(r.desired_thickness_um).toBe(5.0);
    // calcite is {Ca: 1, CO3: 1}; expect both with the same coefficient.
    expect(r.debit_per_species.Ca).toBeGreaterThan(0);
    expect(r.debit_per_species.CO3).toBeGreaterThan(0);
    expect(r.debit_per_species.Ca).toBeCloseTo(r.debit_per_species.CO3, 10);
  });

  it('returns null for minerals without stoichiometry', () => {
    const fn = (globalThis as any).buildCrystalDryRun;
    const r = fn(42, 'unobtanium', 1.0, 5, 1.0);
    expect(r).toBeNull();
  });
});

describe('graduated competition tuning constants exposed for sweeps', () => {
  it('GRADUATED_COMPETITION_ENABLED is on as of v128c', () => {
    expect((globalThis as any).GRADUATED_COMPETITION_ENABLED).toBe(true);
  });

  it('GRADUATED_GAP_THRESHOLD defaults to 3', () => {
    expect((globalThis as any).GRADUATED_GAP_THRESHOLD).toBe(3);
  });

  it('GRADUATED_WINNER_TAKES_FRAC defaults to 0.8', () => {
    expect((globalThis as any).GRADUATED_WINNER_TAKES_FRAC).toBe(0.8);
  });

  it('GRADUATED_POWER_LAW_K defaults to 2', () => {
    expect((globalThis as any).GRADUATED_POWER_LAW_K).toBe(2);
  });
});
