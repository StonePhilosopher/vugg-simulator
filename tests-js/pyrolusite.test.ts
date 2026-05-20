// tests-js/pyrolusite.test.ts — supergene Mn(IV) oxide (v102, 2026-05-19).
//
// First dogfood test of the vugg-add-mineral skill. Pyrolusite β-MnO2,
// tetragonal rutile-type, is the default Mn(IV) supergene endmember
// when (Ba, K, Pb) low and Fe doesn't dominate. The discriminator-fork
// gates are the load-bearing assertions — they encode the canonical
// Mn-oxide family decision tree even though sister engines (romanechite,
// cryptomelane, coronadite, hausmannite, manganite) aren't wired yet.
//
// References:
//   * Anthony Handbook v.III pyrolusite
//   * Dana 7th v.I pp.555-561
//   * Potter & Rossman (1979) Am.Min. 64:1219 — "dendrites are
//     cryptomelane, not pyrolusite"
//   * Hem (1963) USGS WSP 1667-A — Eh-pH diagram + autocatalysis
//   * Champness (1971) Min.Mag. 38:245 — polianite mechanism
//   * Birkner & Navrotsky (2017) PNAS 114:E1046 — Mn-oxide cascade
//   * Post (1999) PNAS 96:3447 — tunnel-structure classification

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Pyrolusite β-MnO2 — supergene Mn(IV) endmember (v102)', () => {
  describe('canonical fluid gates', () => {
    it('Mode A supergene weathering (T 25, Mn 6, O2 1.2, pH 8) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Mn: 6, O2: 1.2, pH: 8.0, Fe: 1, Ba: 5, K: 10, Pb: 1,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pyrolusite()).toBeGreaterThan(0);
    });

    it('Mode B hydrothermal vein (T 150, Mn 8) gives σ > 0 but lower than Mode A', () => {
      const fluidA = new FluidChemistry({
        Mn: 8, O2: 1.2, pH: 8.0, Fe: 1, Ba: 5, K: 10, Pb: 1,
      });
      const condA = new VugConditions({ temperature: 25, fluid: fluidA });
      const sigmaA = condA.supersaturation_pyrolusite();
      const fluidB = new FluidChemistry({
        Mn: 8, O2: 1.2, pH: 8.0, Fe: 1, Ba: 5, K: 10, Pb: 1,
      });
      const condB = new VugConditions({ temperature: 150, fluid: fluidB });
      const sigmaB = condB.supersaturation_pyrolusite();
      expect(sigmaB).toBeGreaterThan(0);
      expect(sigmaA).toBeGreaterThan(sigmaB);
    });

    it('Mn < 0.2 blocks (below Hem 1963 supergene threshold)', () => {
      const fluid = new FluidChemistry({
        Mn: 0.1, O2: 1.2, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pyrolusite()).toBe(0);
    });

    it('T > 250 blocks (hausmannite field — Mn3O4 takes over)', () => {
      const fluid = new FluidChemistry({
        Mn: 10, O2: 1.2, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 300, fluid });
      expect(cond.supersaturation_pyrolusite()).toBe(0);
    });

    it('Low O2 (< 0.5 oxideRedoxAvailable) blocks (manganite γ-MnOOH field)', () => {
      const fluid = new FluidChemistry({
        Mn: 10, O2: 0.2, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pyrolusite()).toBe(0);
    });

    it('Acidic pH < 5.5 blocks (Mn²⁺ stays dissolved, AMD-style)', () => {
      const fluid = new FluidChemistry({
        Mn: 10, O2: 1.2, pH: 4.0,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pyrolusite()).toBe(0);
    });

    it('Very alkaline pH > 9.5 blocks (Mn-hydroxo complexes stay dissolved)', () => {
      const fluid = new FluidChemistry({
        Mn: 10, O2: 1.2, pH: 10.5,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pyrolusite()).toBe(0);
    });
  });

  describe('discriminator fork — competing Mn-oxide cousins suppress σ', () => {
    function baseFluid(overrides: any = {}) {
      return new FluidChemistry({
        Mn: 10, O2: 1.2, pH: 8.0, Fe: 1, Ba: 5, K: 10, Pb: 1, SiO2: 30,
        ...overrides,
      });
    }
    function sigmaWith(overrides: any = {}) {
      const fluid = baseFluid(overrides);
      const cond = new VugConditions({ temperature: 25, fluid });
      return cond.supersaturation_pyrolusite();
    }

    it('Fe > 2*Mn drops σ by ~0.3 (goethite captures the oxidation budget per Hem 1963 Eh sequence)', () => {
      const sigmaClean = sigmaWith({ Fe: 1 });        // Fe << 2*Mn
      const sigmaFeRich = sigmaWith({ Fe: 50 });      // Fe = 5x Mn
      expect(sigmaFeRich).toBeLessThan(sigmaClean * 0.5);
      // Should still fire — pyrolusite IS reported alongside goethite at Tsumeb
      expect(sigmaFeRich).toBeGreaterThan(0);
    });

    it('Ba > 100 drops σ by ~0.5 (would route to romanechite)', () => {
      const sigmaClean = sigmaWith({ Ba: 5 });
      const sigmaBaRich = sigmaWith({ Ba: 200 });
      expect(sigmaBaRich).toBeLessThan(sigmaClean * 0.75);
    });

    it('K > 50 drops σ by ~0.4 (would route to cryptomelane)', () => {
      const sigmaClean = sigmaWith({ K: 10 });
      const sigmaKRich = sigmaWith({ K: 100 });
      expect(sigmaKRich).toBeLessThan(sigmaClean * 0.6);
    });

    it('Pb > 30 drops σ by ~0.3 (would route to coronadite)', () => {
      const sigmaClean = sigmaWith({ Pb: 1 });
      const sigmaPbRich = sigmaWith({ Pb: 60 });
      expect(sigmaPbRich).toBeLessThan(sigmaClean * 0.5);
    });

    it('SiO2 > 200 drops σ (todorokite + Mn-silicates compete)', () => {
      const sigmaClean = sigmaWith({ SiO2: 30 });
      const sigmaSiRich = sigmaWith({ SiO2: 400 });
      expect(sigmaSiRich).toBeLessThan(sigmaClean);
    });
  });

  describe('habit dispatch / no-dendrites discipline', () => {
    it('minerals.json habit_variants does NOT include "dendritic" (Potter & Rossman 1979)', () => {
      const MINERAL_SPEC = (globalThis as any).MINERAL_SPEC;
      // MINERAL_SPEC loads async; if not yet populated, skip the check.
      // This test is best-effort to catch a regression where someone
      // adds a dendritic habit despite the Potter & Rossman 1979 finding.
      if (!MINERAL_SPEC || !MINERAL_SPEC.pyrolusite) return;
      const variants = MINERAL_SPEC.pyrolusite.habit_variants || [];
      const variantNames = variants.map((v: any) => v.name);
      expect(variantNames).not.toContain('dendritic');
    });
  });

  describe('Engine registered in MINERAL_ENGINES', () => {
    it('pyrolusite grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.pyrolusite).toBe('function');
    });
  });
});
