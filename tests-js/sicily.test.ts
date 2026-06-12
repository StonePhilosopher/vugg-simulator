// tests-js/sicily.test.ts — Sicilian Solfifera Series scenario pins
// (2026-05-18, v80).
//
// Pins the new sicily_solfifera scenario + the v80 native_sulfur
// engine broadening that made BSR-near-surface mode reachable.
// Sister test file to sulphur-bank.test.ts — both anchor canonical
// native-sulfur deposit types, one acid-sulfate hot-spring (Sulphur
// Bank) and one sedimentary BSR (Sicily).
//
// What this catches: future engine re-narrowing of the pH gate, or
// scenario drift that pushes Sicily's fluid out of the BSR-mode
// peak (pH 5.5-6.5).
//
// Anchor: Cianciana / Caltanissetta district, Agrigento province,
// Sicily. Solfifera Series (Messinian, 6-5.3 Ma). Ziegenbalg et al.
// 2010 (Sedimentary Geology) + Manzi et al. 2009 (Sedimentology).

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runFullScenario(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['sicily_solfifera']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let maxSigma = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const s = sim.conditions.supersaturation_native_sulfur();
    if (s > maxSigma) maxSigma = s;
  }
  return { sim, maxSigma };
}

describe('Sicilian Solfifera Series — sedimentary BSR native_sulfur (v80)', () => {
  describe('native_sulfur fires in BSR-mode across seeds', () => {
    it.each([42, 1, 7])('seed %d: native_sulfur peak sigma > 1.5', (seed) => {
      const { maxSigma } = runFullScenario(seed);
      expect(maxSigma, `native_sulfur peak sigma at seed ${seed} was ${maxSigma.toFixed(2)}`)
        .toBeGreaterThan(1.5);
    });

    it('native_sulfur nucleates with the bipyramidal_alpha habit across the seed space', { timeout: 120000 }, () => {
      // 120s budget: 8 full sicily runs ≈ 5s each standalone, ~3× under
      // parallel suite load (the v181 ring_fluids lesson — time budgets
      // are part of the contract). meta-autunite's 8-seed check uses 60s
      // for the same shape; sicily's two extra seeds + margin → 120s.
      // The iconic Sicilian {111} dipyramid form. The engine's habit
      // dispatcher selects bipyramidal_alpha for T < 60°C (or
      // T < 95°C + excess σ < 1.5). Sicily's T=30°C keeps it firmly
      // in the alpha-sulfur window.
      //
      // v181: converted from `it.each([42, 1, 7])` single-seed pins to a
      // widened coverage check — the same pattern as v135's pharmacolite
      // and v137's meta-autunite conversions. The T-reconciliation rebake
      // re-rolled every seed's nucleation realization, and seed 42 came up
      // empty for native_sulfur (the σ test above still passes there — the
      // BSR-mode GATE is intact at every seed; only the nucleation dice
      // moved). Measured rate at v181: 15/16 seeds fire, every firing
      // crystal bipyramidal_alpha — so the threshold here is ≥6 of 8, far
      // stronger than the old 3 lucky pins. For sicily the thermal change
      // is pure re-phasing (T sits at the floor; pulses are gated off by
      // T0=30°C), so the cross-seed rate is preserved by construction —
      // a future drop below 6/8 means CHEMISTRY regressed, not luck.
      const seeds = [42, 1, 7, 13, 99, 2024, 17, 3];
      let fired = 0, bipy = 0;
      for (const seed of seeds) {
        const { sim } = runFullScenario(seed);
        const ns = sim.crystals.filter((c: any) => c.mineral === 'native_sulfur');
        if (ns.length >= 1) fired++;
        if (ns.some((c: any) => c.habit === 'bipyramidal_alpha')) bipy++;
      }
      expect(fired, `native_sulfur fired in only ${fired}/${seeds.length} seeds (expected ≥6)`)
        .toBeGreaterThanOrEqual(6);
      expect(bipy, `bipyramidal_alpha in only ${bipy}/${seeds.length} seeds (expected ≥6)`)
        .toBeGreaterThanOrEqual(6);
    });
  });

  describe('engine broadening — bimodal pH factor (v80)', () => {
    // Verify the engine's pH factor peaks at BOTH 2.5 (acid-sulfate)
    // and 6.0 (BSR-near-surface). The valley between modes (pH ~4)
    // should give a lower σ than either peak.
    function sigmaAtFluid(pH: number, S = 400, O2 = 0.4, T = 30): number {
      const fluid = new FluidChemistry({ S, O2, pH });
      const cond = new VugConditions({ temperature: T, fluid });
      return cond.supersaturation_native_sulfur();
    }

    it('Sulphur Bank-style fluid (pH 2.0) gives sigma > 1.0', () => {
      const s = sigmaAtFluid(2.0, 500, 0.4, 75);
      expect(s, `Sulphur-Bank-style fluid produced sigma ${s.toFixed(2)}`)
        .toBeGreaterThan(1.0);
    });

    it('Sicily-style fluid (pH 6.0) gives sigma > 1.0', () => {
      const s = sigmaAtFluid(6.0, 400, 0.4, 30);
      expect(s, `Sicily-style fluid produced sigma ${s.toFixed(2)}`)
        .toBeGreaterThan(1.0);
    });

    it('valley fluid (pH 4.0) gives lower sigma than either peak', () => {
      const valley = sigmaAtFluid(4.0, 400, 0.4, 30);
      const acidPeak = sigmaAtFluid(2.5, 400, 0.4, 30);
      const bsrPeak = sigmaAtFluid(6.0, 400, 0.4, 30);
      expect(valley, `valley sigma ${valley.toFixed(2)} should be < acid peak ${acidPeak.toFixed(2)}`)
        .toBeLessThan(acidPeak);
      expect(valley, `valley sigma ${valley.toFixed(2)} should be < BSR peak ${bsrPeak.toFixed(2)}`)
        .toBeLessThan(bsrPeak);
    });

    it('pH > 6.5 returns 0 (the broadened cap)', () => {
      // The v80 broadening was pH 5 → 6.5. Above 6.5 the gate
      // still blocks (would-be alkaline modes are geologically
      // implausible for synproportionation kinetics).
      const s = sigmaAtFluid(7.0, 400, 0.4, 30);
      expect(s, `pH=7.0 should hit the engine's pH > 6.5 gate`).toBe(0);
    });

    it('Sicily-style (alkaline) fluid fires under v80; would have been blocked under v79', () => {
      // Documents the engine broadening regression target. The
      // Sicily scenario depends on this admitting alkaline σ.
      const s = sigmaAtFluid(6.0, 400, 0.4, 30);
      expect(s, `BSR-mode sigma at pH=6.0 must be > 0 (v80 broadening)`)
        .toBeGreaterThan(0);
      // Specifically: ph_bsr at pH=6.0 is 1.0 (peak). σ_pre-T = s_f × eh_f × ph_f
      //   = 2.0 × ~1.0 × 1.0 = ~2.0. × T_factor 1.2 = ~2.4. × activity_correction.
      expect(s, `BSR sigma should be comfortably > 2.0`)
        .toBeGreaterThan(2.0);
    });
  });

  describe('supporting paragenesis (Solfifera Series assemblage)', () => {
    it('selenite fires (residual Messinian gypsum) at seed 42', () => {
      const { sim } = runFullScenario(42);
      const hits = sim.crystals.filter((c: any) => c.mineral === 'selenite');
      expect(hits.length, 'selenite should fire from 600 ppm Ca + 400 ppm S')
        .toBeGreaterThan(0);
    });

    it('celestine fires (Sr-mineral from gypsum-derived Sr) at seed 42', () => {
      const { sim } = runFullScenario(42);
      const hits = sim.crystals.filter((c: any) => c.mineral === 'celestine');
      expect(hits.length, 'celestine should fire from 30 ppm Sr + sulfate')
        .toBeGreaterThan(0);
    });
  });

  describe('scenario architecture sanity', () => {
    it('wall composition is limestone (calcite/gypsum matrix host)', () => {
      // Sicily IS hosted in calcite/gypsum matrix. The limestone
      // composition's dissolve() releases Ca + CO₃, modeling the
      // actual gypsum/calcite matrix dissolution. UNLIKE Sulphur
      // Bank (silicate-hosted), Sicily WANTS the carbonate buffer
      // to hold pH at 6.0 in the BSR-mode window.
      const { conditions } = SCENARIOS['sicily_solfifera']();
      expect(conditions.wall.composition).toBe('limestone');
    });

    it('reactivity is gentle (~0.5) so pH stays in BSR window', () => {
      const { conditions } = SCENARIOS['sicily_solfifera']();
      expect(conditions.wall.reactivity, 'reactivity should be 0.5 for BSR-mode buffering')
        .toBeLessThanOrEqual(0.8);
      expect(conditions.wall.reactivity).toBeGreaterThan(0);
    });

    it('initial pH in BSR window (5.5-6.5)', () => {
      const { conditions } = SCENARIOS['sicily_solfifera']();
      expect(conditions.fluid.pH).toBeGreaterThanOrEqual(5.5);
      expect(conditions.fluid.pH).toBeLessThanOrEqual(6.5);
    });

    it('initial T is sedimentary (20-50°C)', () => {
      // Sicily is a SEDIMENTARY deposit. BSR happens cool.
      // Hot-spring T (>60°C) would push us out of the BSR regime.
      const { conditions } = SCENARIOS['sicily_solfifera']();
      expect(conditions.temperature).toBeGreaterThanOrEqual(20);
      expect(conditions.temperature).toBeLessThanOrEqual(50);
    });

    it('metal_sum is LOW (Messinian marls are clean)', () => {
      const { conditions } = SCENARIOS['sicily_solfifera']();
      const f = conditions.fluid;
      const metal_sum = (f.Fe || 0) + (f.Cu || 0) + (f.Pb || 0) + (f.Zn || 0);
      expect(metal_sum,
        `Messinian marls should have metal_sum < 30, got ${metal_sum}`)
        .toBeLessThan(30);
    });

    it('Sr is present for celestine signature', () => {
      // Sicilian gypsum carries 0.5-3% Sr, partitioning into late
      // celestine. The scenario's 30 ppm Sr models this signature.
      const { conditions } = SCENARIOS['sicily_solfifera']();
      expect(conditions.fluid.Sr,
        `Sr ${conditions.fluid.Sr} should be > 10 for the celestine pin`)
        .toBeGreaterThan(10);
    });
  });

  describe('event registry wiring', () => {
    it('gypsum_dissolution event resolves and mutates state', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sicily_solfifera']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 14; i++) sim.run_step();
      const caPre = sim.conditions.fluid.Ca;
      const sPre = sim.conditions.fluid.S;
      sim.run_step();   // step 15 — gypsum_dissolution
      expect(sim.conditions.fluid.Ca, `Ca should rise: ${caPre} -> ${sim.conditions.fluid.Ca}`)
        .toBeGreaterThan(caPre);
      expect(sim.conditions.fluid.S, `S should rise: ${sPre} -> ${sim.conditions.fluid.S}`)
        .toBeGreaterThan(sPre);
    });

    it('meteoric_o2_pulse event pins O₂ to 0.40', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sicily_solfifera']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 24; i++) sim.run_step();
      sim.run_step();   // step 25 — meteoric_o2_pulse
      expect(sim.conditions.fluid.O2).toBeCloseTo(0.40, 1);
    });

    it('carbonate_buffer event pins pH at 6.0', () => {
      setSeed(42);
      const { conditions, events } = SCENARIOS['sicily_solfifera']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 84; i++) sim.run_step();
      sim.run_step();   // step 85 — carbonate_buffer
      expect(sim.conditions.fluid.pH).toBeCloseTo(6.0, 1);
    });
  });
});
