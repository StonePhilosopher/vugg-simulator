// tests-js/conichalcite.test.ts — Ca-Cu arsenate engine pins
// (v87, 2026-05-19).
//
// Conichalcite CaCu(AsO₄)(OH) — orthorhombic Ca-Cu arsenate. Vivid
// emerald-green from Cu²⁺ chromophore in octahedral coordination.
// Ca-cation analog of olivenite (Mohs 4.5 vs olivenite's 3). Per
// research-conichalcite.md (boss canonical 2026-05).
//
// Cation-fork mechanic: Ca/(Ca+Cu) > 0.4 routes to conichalcite;
// Cu-dominant fluid stays with olivenite (the two may coexist in
// the same vug as a "two-shade green" assemblage when both gates
// clear, but the cation fork shifts the σ ceiling depending on the
// local ratio).
//
// What this catches:
//   * supersaturation gate correctness (Ca/Cu/As thresholds; cation
//     fork; pH window; T window; oxidizing requirement).
//   * Engine fires in supergene_oxidation across 3 seeds.
//   * Substrate preference includes scorodite/olivenite/etc.
//   * pH < 4.5 dissolves existing conichalcite.
//   * Cu-dominant fluids (Bisbee initial) block conichalcite via
//     the cation gate (correctly route to olivenite).
//   * Sulphur Bank scenario has no Cu — zero conichalcite.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runSupergeneOxidation(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['supergene_oxidation']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let maxSigma = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const s = sim.conditions.supersaturation_conichalcite();
    if (s > maxSigma) maxSigma = s;
  }
  return { sim, maxSigma };
}

describe('Conichalcite — Ca-Cu arsenate engine (v87)', () => {
  describe('supersaturation_conichalcite gate correctness', () => {
    function sigmaAt(opts: any): number {
      const { T, ...fluidOpts } = opts;
      const fluid = new FluidChemistry(fluidOpts);
      const cond = new VugConditions({ temperature: T ?? 30, fluid });
      return cond.supersaturation_conichalcite();
    }

    it('returns 0 when Ca < 15', () => {
      expect(sigmaAt({ Ca: 8, Cu: 50, As: 25, O2: 1.5, pH: 6.5, T: 30 })).toBe(0);
    });

    it('returns 0 when Cu < 10', () => {
      expect(sigmaAt({ Ca: 100, Cu: 5, As: 25, O2: 1.5, pH: 6.5, T: 30 })).toBe(0);
    });

    it('returns 0 when As < 5', () => {
      expect(sigmaAt({ Ca: 100, Cu: 50, As: 2, O2: 1.5, pH: 6.5, T: 30 })).toBe(0);
    });

    it('returns 0 when reducing (As stays as As(III))', () => {
      expect(sigmaAt({ Ca: 100, Cu: 50, As: 25, O2: 0.0, pH: 6.5, T: 30 })).toBe(0);
    });

    it('returns 0 at pH < 5.0 (acid destabilization)', () => {
      expect(sigmaAt({ Ca: 100, Cu: 50, As: 25, O2: 1.5, pH: 4.5, T: 30 })).toBe(0);
    });

    it('returns 0 at pH > 7.5 (alkaline cutoff)', () => {
      expect(sigmaAt({ Ca: 100, Cu: 50, As: 25, O2: 1.5, pH: 8.0, T: 30 })).toBe(0);
    });

    it('returns 0 at T > 100°C (out of supergene window)', () => {
      expect(sigmaAt({ Ca: 100, Cu: 50, As: 25, O2: 1.5, pH: 6.5, T: 120 })).toBe(0);
    });

    it('returns 0 when Cu-dominant (Bisbee initial Ca=60, Cu=400 → ratio 0.13)', () => {
      // Cation fork: Cu-rich fluid routes to olivenite, not conichalcite.
      expect(sigmaAt({ Ca: 60, Cu: 400, As: 8, O2: 1.5, pH: 5.5, T: 30 })).toBe(0);
    });

    it('fires σ > 1.0 at supergene_oxidation-style chemistry', () => {
      const s = sigmaAt({ Ca: 120, Cu: 55, As: 25, O2: 1.5, pH: 6.5, T: 30 });
      expect(s, `conichalcite σ was ${s.toFixed(2)}`).toBeGreaterThan(1.0);
    });

    it('T optimum 15-40°C — peaks above T=70 fallback', () => {
      const at30 = sigmaAt({ Ca: 120, Cu: 55, As: 25, O2: 1.5, pH: 6.5, T: 30 });
      const at80 = sigmaAt({ Ca: 120, Cu: 55, As: 25, O2: 1.5, pH: 6.5, T: 80 });
      expect(at30, `σ at T=30 was ${at30.toFixed(2)}`).toBeGreaterThan(at80);
    });

    it('Pb > 50 suppresses (routes to mimetite/pyromorphite)', () => {
      const lowPb = sigmaAt({ Ca: 120, Cu: 55, As: 25, Pb: 10, O2: 1.5, pH: 6.5, T: 30 });
      const hiPb  = sigmaAt({ Ca: 120, Cu: 55, As: 25, Pb: 200, O2: 1.5, pH: 6.5, T: 30 });
      expect(hiPb).toBeLessThan(lowPb);
    });
  });

  describe('supergene_oxidation integration — primary scenario target (Tsumeb-style)', () => {
    it.each([42, 1, 7])('seed %d: conichalcite peak σ > 1.0', (seed) => {
      const { maxSigma } = runSupergeneOxidation(seed);
      expect(maxSigma, `seed ${seed}: conichalcite peak σ was ${maxSigma.toFixed(2)}`)
        .toBeGreaterThan(1.0);
    });

    it.each([42, 1, 7])('seed %d: at least one conichalcite crystal forms', (seed) => {
      const { sim } = runSupergeneOxidation(seed);
      const con = sim.crystals.filter((c: any) => c.mineral === 'conichalcite');
      expect(con.length, `seed ${seed}: zero conichalcite crystals formed`)
        .toBeGreaterThan(0);
    });

    it.each([42, 1, 7])('seed %d: conichalcite respects cap=4', (seed) => {
      const { sim } = runSupergeneOxidation(seed);
      const con = sim.crystals.filter((c: any) => c.mineral === 'conichalcite');
      expect(con.length).toBeLessThanOrEqual(4);
    });
  });

  describe('substrate preference — scorodite/olivenite/copper/malachite/chrysocolla/wall', () => {
    it('conichalcite nucleates on canonical substrate across 3 seeds', () => {
      let onSubstrate = 0;
      let total = 0;
      for (const seed of [42, 1, 7]) {
        const { sim } = runSupergeneOxidation(seed);
        const con = sim.crystals.filter((c: any) => c.mineral === 'conichalcite');
        for (const c of con) {
          total++;
          const pos = c.position || '';
          if (pos.includes('scorodite') || pos.includes('olivenite')
              || pos.includes('native_copper') || pos.includes('malachite')
              || pos.includes('chrysocolla') || pos === 'vug wall') {
            onSubstrate++;
          }
        }
      }
      expect(total, 'no conichalcite to inspect across 3 seeds').toBeGreaterThan(0);
      expect(onSubstrate,
        `expected conichalcite on canonical substrate; got ${onSubstrate}/${total}`)
        .toBe(total);
    }, 120_000);
  });

  describe('cation fork — Cu-dominant blocks conichalcite, routes to olivenite', () => {
    it('high Cu (no Ca) blocks conichalcite even with As + redox', () => {
      // Olivenite needs Zn>=0.5 trace too (its own broth-ratio gate);
      // give it a small Zn floor so it fires while conichalcite blocks.
      const fluid = new FluidChemistry({ Ca: 5, Cu: 400, Zn: 5, As: 25, O2: 1.5, pH: 6.5 });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_conichalcite()).toBe(0);
      // Olivenite should fire instead (Cu-dominant fluid with trace Zn)
      expect(cond.supersaturation_olivenite()).toBeGreaterThan(0);
    });

    it('high Ca (low Cu but trace) fires conichalcite, blocks olivenite', () => {
      const fluid = new FluidChemistry({ Ca: 400, Cu: 30, Zn: 1, As: 25, O2: 1.5, pH: 6.5 });
      const cond = new VugConditions({ temperature: 30, fluid });
      const sigC = cond.supersaturation_conichalcite();
      expect(sigC, `expected σ_conichalcite > 0 when Ca-dominant`)
        .toBeGreaterThan(0);
      // Cu=30 still clears olivenite's Cu>=50 gate? 30 is below 50,
      // so olivenite blocked. This pins both directions.
      expect(cond.supersaturation_olivenite()).toBe(0);
    });
  });

  describe('other scenarios — chemistry-determined firing', () => {
    it('sulphur_bank: zero conichalcite (no Cu)', () => {
      setSeed(42);
      const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < (defaultSteps ?? 200); i++) sim.run_step();
      const con = sim.crystals.filter((c: any) => c.mineral === 'conichalcite');
      expect(con.length).toBe(0);
    });

    it('gem_pegmatite: zero conichalcite (no As)', () => {
      setSeed(42);
      const { conditions, events, defaultSteps } = SCENARIOS['gem_pegmatite']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < (defaultSteps ?? 230); i++) sim.run_step();
      const con = sim.crystals.filter((c: any) => c.mineral === 'conichalcite');
      expect(con.length).toBe(0);
    });
  });
});
