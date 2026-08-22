// tests-js/realgar-orpiment.test.ts — As-sulfide mineral pins
// (2026-05-19, v82).
//
// Two new minerals: realgar (AsS, orange-red) and orpiment (As₂S₃,
// golden-yellow). The classic As-sulfide pair — co-deposits in
// hot-spring + epithermal environments. White & Roberson 1962
// place the broader hot-spring Hg deposit class in siliceous sinter; the
// mine-specific occurrence remains explicitly provisional in scenarios.json5.
//
// Test scope: engine gate correctness, σ math sanity, end-to-end
// nucleation at Sulphur Bank across seeds, locality-bounded surface placement.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runSulphurBank(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let maxSigmaRlg = 0;
  let maxSigmaOrp = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const sr = sim.conditions.supersaturation_realgar();
    const so = sim.conditions.supersaturation_orpiment();
    if (sr > maxSigmaRlg) maxSigmaRlg = sr;
    if (so > maxSigmaOrp) maxSigmaOrp = so;
  }
  return { sim, maxSigmaRlg, maxSigmaOrp };
}

describe('Realgar (AsS) + Orpiment (As₂S₃) — v82 mineral additions', () => {
  describe('supersaturation_realgar gates', () => {
    function sigmaAt(opts: any): number {
      const { T, ...fluidOpts } = opts;
      const fluid = new FluidChemistry(fluidOpts);
      const cond = new VugConditions({ temperature: T ?? 75, fluid });
      return cond.supersaturation_realgar();
    }

    it('returns 0 when As < 5', () => {
      expect(sigmaAt({ As: 3, S: 200, O2: 0.3, pH: 4, T: 75 })).toBe(0);
    });

    it('returns 0 when S < 30', () => {
      expect(sigmaAt({ As: 30, S: 20, O2: 0.3, pH: 4, T: 75 })).toBe(0);
    });

    it('returns 0 at pH > 9 (alkali destabilizes AsS)', () => {
      expect(sigmaAt({ As: 30, S: 200, O2: 0.3, pH: 9.5, T: 75 })).toBe(0);
    });

    it('fires σ > 1.0 at Sulphur-Bank-style fluid (As=30, S=500, pH=2, T=75)', () => {
      const s = sigmaAt({ As: 30, S: 500, O2: 0.4, pH: 2.0, T: 75 });
      expect(s, `realgar σ at SB-style fluid was ${s.toFixed(2)}`).toBeGreaterThan(1.0);
    });

    it('T optimum 50-180°C', () => {
      const at100 = sigmaAt({ As: 30, S: 500, O2: 0.4, pH: 3, T: 100 });
      const at300 = sigmaAt({ As: 30, S: 500, O2: 0.4, pH: 3, T: 300 });
      expect(at100, `realgar at T=100 was ${at100.toFixed(2)}`).toBeGreaterThan(at300);
    });
  });

  describe('supersaturation_orpiment gates', () => {
    function sigmaAt(opts: any): number {
      const { T, ...fluidOpts } = opts;
      const fluid = new FluidChemistry(fluidOpts);
      const cond = new VugConditions({ temperature: T ?? 75, fluid });
      return cond.supersaturation_orpiment();
    }

    it('returns 0 when As < 8 (higher threshold than realgar)', () => {
      expect(sigmaAt({ As: 6, S: 200, O2: 0.3, pH: 4, T: 75 })).toBe(0);
    });

    it('returns 0 when S < 50 (higher S requirement than realgar — As₂S₃ stoich)', () => {
      expect(sigmaAt({ As: 30, S: 40, O2: 0.3, pH: 4, T: 75 })).toBe(0);
    });

    it('returns 0 at pH > 9.5 (orpiment tolerates slightly higher pH than realgar)', () => {
      expect(sigmaAt({ As: 30, S: 200, O2: 0.3, pH: 10, T: 75 })).toBe(0);
    });

    it('fires σ > 1.0 at Sulphur-Bank-style fluid', () => {
      const s = sigmaAt({ As: 30, S: 500, O2: 0.4, pH: 2.0, T: 75 });
      expect(s, `orpiment σ at SB-style fluid was ${s.toFixed(2)}`).toBeGreaterThan(1.0);
    });

    it('orpiment tolerates higher pH than realgar (9.0-9.5 window)', () => {
      // At pH 9.3, realgar is BLOCKED (gate > 9) but orpiment fires
      // (gate > 9.5).
      const fluid = new FluidChemistry({ As: 30, S: 500, O2: 0.3, pH: 9.3 });
      const cond = new VugConditions({ temperature: 75, fluid });
      expect(cond.supersaturation_realgar(),
        `realgar should be blocked at pH 9.3`).toBe(0);
      expect(cond.supersaturation_orpiment(),
        `orpiment should fire at pH 9.3`).toBeGreaterThan(0);
    });
  });

  describe('Sulphur Bank integration (the documented accessory As-sulfides)', () => {
    it.each([42, 1, 7])('seed %d: realgar peak σ > 3.0', (seed) => {
      const { maxSigmaRlg } = runSulphurBank(seed);
      expect(maxSigmaRlg, `realgar peak σ at seed ${seed} was ${maxSigmaRlg.toFixed(2)}`)
        .toBeGreaterThan(3.0);
    });

    it.each([42, 1, 7])('seed %d: orpiment peak σ > 3.0', (seed) => {
      const { maxSigmaOrp } = runSulphurBank(seed);
      expect(maxSigmaOrp, `orpiment peak σ at seed ${seed} was ${maxSigmaOrp.toFixed(2)}`)
        .toBeGreaterThan(3.0);
    });

    it.each([42, 1, 7])('seed %d: at least 4 realgar-origin crystals (realgar + pararealgar)', (seed) => {
      // v84 (2026-05-19): realgar transforms to pararealgar via
      // light-induced isomerization (applyLightTransitions in
      // 75-transitions.ts). At Sulphur Bank (surface hot-spring vent
      // exposed to light), ALL realgar typically transforms by
      // end-of-run — geologically realistic for collected specimens
      // (museum-drawer realgar is largely pararealgar after decades
      // of room-light exposure). The pin counts the combined
      // realgar-origin assemblage rather than just un-transformed
      // realgar.
      const { sim } = runSulphurBank(seed);
      const realgarOrigin = sim.crystals.filter((c: any) =>
        (c.mineral === 'realgar' || c.paramorph_origin === 'realgar') && c.active,
      );
      expect(realgarOrigin.length,
        `seed ${seed}: only ${realgarOrigin.length} realgar-origin crystals (realgar + pararealgar)`)
        .toBeGreaterThanOrEqual(4);
    });

    it.each([42, 1, 7])('seed %d: at least 4 extant orpiment crystals, including an exposed survivor', (seed) => {
      const { sim } = runSulphurBank(seed);
      const orpiment = sim.crystals.filter((c: any) => c.mineral === 'orpiment');
      const extant = orpiment.filter((c: any) => !c.dissolved && c.total_growth_um > 0);
      const exposed = extant.filter((c: any) => c.active);
      const enclosed = extant.filter((c: any) => c.enclosed_by != null);
      expect(extant.length, `seed ${seed}: only ${extant.length} extant orpiment`)
        .toBeGreaterThanOrEqual(4);
      expect(exposed.length, `seed ${seed}: no exposed orpiment survivor`).toBeGreaterThanOrEqual(1);
      expect(exposed.length + enclosed.length).toBe(extant.length);
    });

    it.each([42, 1, 7])('seed %d: realgar-origin reaches a canonical habit', (seed) => {
      // v84: includes pararealgar (light-induced paramorph of realgar).
      // habit was set at growth time before transformation, so a
      // pararealgar crystal still has its original realgar habit.
      const { sim } = runSulphurBank(seed);
      const r = sim.crystals.filter((c: any) =>
        c.mineral === 'realgar' || c.paramorph_origin === 'realgar',
      );
      expect(r.length).toBeGreaterThan(0);
      const canonical = ['prismatic_red', 'granular_orange', 'sublimation_crust_red'];
      const matched = r.filter((c: any) => canonical.includes(c.habit));
      expect(matched.length,
        `seed ${seed}: no realgar-origin crystal in canonical habits (got: ${[...new Set(r.map((c: any) => c.habit))].join(', ')})`)
        .toBeGreaterThan(0);
    });

    it.each([42, 1, 7])('seed %d: orpiment reaches a canonical habit', (seed) => {
      const { sim } = runSulphurBank(seed);
      const o = sim.crystals.filter((c: any) => c.mineral === 'orpiment');
      expect(o.length).toBeGreaterThan(0);
      const canonical = ['foliated_golden', 'columnar_yellow', 'granular_yellow'];
      const matched = o.filter((c: any) => canonical.includes(c.habit));
      expect(matched.length,
        `seed ${seed}: no orpiment in canonical habits (got: ${[...new Set(o.map((c: any) => c.habit))].join(', ')})`)
        .toBeGreaterThan(0);
    });
  });

  describe('locality-bounded placement (co-deposition does not imply substrate)', () => {
    it('realgar-origin starts on the altered vug wall, never on withdrawn Sulphur Bank phases', () => {
      // v84: include pararealgar crystals (paramorph_origin='realgar')
      // — their position was set at nucleation time before any
      // transformation, so the substrate pin still applies.
      let realgarOrigin = 0;
      for (const seed of [42, 1, 7]) {
        const { sim } = runSulphurBank(seed);
        const rlg = sim.crystals.filter((c: any) =>
          c.mineral === 'realgar' || c.paramorph_origin === 'realgar',
        );
        for (const c of rlg) {
          const pos = (c.position || '');
          realgarOrigin++;
          expect(pos).toBe('vug wall');
          expect(pos).not.toContain('arsenopyrite');
          expect(pos).not.toContain('quartz');
        }
      }
      expect(realgarOrigin, 'expected realgar-origin crystals across three commissioned seeds')
        .toBeGreaterThan(0);
    });

    it('orpiment nucleates on realgar or other substrate across 3 seeds', () => {
      // Orpiment's substrate priority is realgar (40%) → native_sulfur
      // (30%) → arsenopyrite (25%) → wall. Geologically real: many
      // Allchar / Shimen specimens have orpiment overgrowing realgar
      // as the σ trajectory shifts S/As toward orpiment-favored.
      let onSubstrate = 0;
      for (const seed of [42, 1, 7]) {
        const { sim } = runSulphurBank(seed);
        const orp = sim.crystals.filter((c: any) => c.mineral === 'orpiment');
        for (const c of orp) {
          const pos = (c.position || '');
          if (pos.includes('realgar') || pos.includes('native_sulfur') || pos.includes('arsenopyrite')) {
            onSubstrate++;
          }
        }
      }
      expect(onSubstrate,
        `expected orpiment nucleating on a substrate across 3 seeds; got ${onSubstrate}`)
        .toBeGreaterThan(0);
    });
  });

  describe('Sulphur Bank scenario carries the As fluid + species declaration', () => {
    it('initial fluid has As >= 8 ppm (clears orpiment gate; bumped to 10 in v83)', () => {
      // v82 originally used As=30 ppm (above measured Sulphur Bank
      // range); v83 tuned to 10 ppm following White & Roberson 1962
      // + EPA Superfund monitoring data (0.5-10 ppm dissolved).
      // sulphur_bank_h2s_recharge events add +2 As each (6 events),
      // so trajectory rises to ~22 ppm by step 200 — covering the
      // localized-enrichment zone where realgar + orpiment actually
      // precipitate. The pin floor of 8 ppm matches orpiment's
      // engine gate (the most-restrictive of the three As-engines).
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.fluid.As).toBeGreaterThanOrEqual(8);
    });

    it('expects_species lists realgar + orpiment', () => {
      const callable = SCENARIOS['sulphur_bank'];
      const spec = (callable as any)._json5_spec;
      expect(spec).toBeTruthy();
      expect(spec.expects_species).toContain('realgar');
      expect(spec.expects_species).toContain('orpiment');
    });
  });
});
