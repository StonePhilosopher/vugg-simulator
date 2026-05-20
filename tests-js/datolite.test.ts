// tests-js/datolite.test.ts — datolite CaB(SiO4)(OH) (v110, 2026-05-20).
//
// First mineral of the Jeffrey Mine rodingite arc (v110-v116). Calcium
// boronosilicate; sorosilicate framework with B replacing Si in one
// tetrahedral site (Hawthorne et al. 1996 Can.Min. 34:1255). Low-T
// (50-350°C) alkaline (pH 7-12) hydrothermal vug filling in TWO
// settings: Lake Superior basalt amygdales (Bornhorst 2017 GSA Memoir
// 213) AND rodingite metasomatic contacts (Bernardini 1981 MR
// 12(5):277, the Jeffrey canonical anchor).
//
// Tests verify:
//  - canonical fluid clears the gate (Ca=200, B=5, SiO2=300, T=150,
//    pH=10 → σ > 0)
//  - B = 0 blocks (the new gate; pre-v110 datolite would silently
//    have fired with B = 0 because no consumer existed)
//  - pH = 5 blocks (acidic outside the 7-12 alkaline window — both
//    Lake Superior and Jeffrey settings are alkaline-only)
//  - T = 500°C blocks (above the 350°C ceiling; thermal breakdown
//    to wollastonite + boric acid regime)
//  - T = 30°C blocks (below the 50°C floor; precipitation kinetics
//    fail in cold meteoric water)
//  - MINERAL_ENGINES.datolite is wired (per vugg-add-mineral skill
//    §8, don't test MINERAL_SPEC directly — async loading trap)

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Datolite — CaB(SiO4)(OH) calcium boronosilicate (v110)', () => {
  describe('supersaturation gate', () => {
    it('canonical Lake Superior amygdale broth gives sigma > 0', () => {
      // Keweenaw basalt amygdale: Ca-rich plagioclase leaching, B from
      // late hydrothermal fluid, SiO2 from host basalt. pH ~8, T ~150°C.
      const fluid = new FluidChemistry({ Ca: 200, B: 5, SiO2: 300, pH: 8.0 });
      const cond = new VugConditions({ temperature: 150, fluid });
      expect(cond.supersaturation_datolite()).toBeGreaterThan(0);
    });

    it('canonical Jeffrey rodingite-contact broth gives sigma > 0', () => {
      // Jeffrey: hyperalkaline serpentinization-derived fluid, Ca-Al-rich
      // metasomatic, B trace from late phase. pH 10-11, T ~200°C.
      const fluid = new FluidChemistry({ Ca: 250, B: 4, SiO2: 250, pH: 10.5 });
      const cond = new VugConditions({ temperature: 200, fluid });
      expect(cond.supersaturation_datolite()).toBeGreaterThan(0);
    });

    it('B = 0 blocks the supersaturation gate', () => {
      // The defining gate — datolite is THE Ca-borosilicate; no B = no datolite.
      const fluid = new FluidChemistry({ Ca: 200, B: 0, SiO2: 300, pH: 9.0 });
      const cond = new VugConditions({ temperature: 150, fluid });
      expect(cond.supersaturation_datolite()).toBe(0);
    });

    it('acidic pH (5) blocks — datolite is alkaline-only', () => {
      const fluid = new FluidChemistry({ Ca: 200, B: 5, SiO2: 300, pH: 5.0 });
      const cond = new VugConditions({ temperature: 150, fluid });
      expect(cond.supersaturation_datolite()).toBe(0);
    });

    it('T = 500°C blocks — thermal breakdown to wollastonite + B(OH)3', () => {
      const fluid = new FluidChemistry({ Ca: 200, B: 5, SiO2: 300, pH: 9.0 });
      const cond = new VugConditions({ temperature: 500, fluid });
      expect(cond.supersaturation_datolite()).toBe(0);
    });

    it('T = 30°C blocks — kinetic precipitation floor at 50°C', () => {
      const fluid = new FluidChemistry({ Ca: 200, B: 5, SiO2: 300, pH: 9.0 });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_datolite()).toBe(0);
    });

    it('Ca = 30 (below 60 threshold) blocks', () => {
      const fluid = new FluidChemistry({ Ca: 30, B: 5, SiO2: 300, pH: 9.0 });
      const cond = new VugConditions({ temperature: 150, fluid });
      expect(cond.supersaturation_datolite()).toBe(0);
    });

    it('SiO2 = 30 (below 50 threshold) blocks', () => {
      const fluid = new FluidChemistry({ Ca: 200, B: 5, SiO2: 30, pH: 9.0 });
      const cond = new VugConditions({ temperature: 150, fluid });
      expect(cond.supersaturation_datolite()).toBe(0);
    });
  });

  describe('Engine registered in MINERAL_ENGINES', () => {
    it('datolite grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.datolite).toBe('function');
    });
  });

  describe('pH sweet spot 8-11', () => {
    it('pH 9 (middle of sweet spot) gives higher sigma than pH 7 (edge)', () => {
      const baseBroth = { Ca: 200, B: 5, SiO2: 300 };
      const fluid_sweet = new FluidChemistry({ ...baseBroth, pH: 9.0 });
      const fluid_edge = new FluidChemistry({ ...baseBroth, pH: 7.0 });
      const cond_sweet = new VugConditions({ temperature: 150, fluid: fluid_sweet });
      const cond_edge = new VugConditions({ temperature: 150, fluid: fluid_edge });
      expect(cond_sweet.supersaturation_datolite()).toBeGreaterThan(cond_edge.supersaturation_datolite());
    });
  });

  describe('T sweet spot 100-250°C', () => {
    it('T 200 (middle of sweet spot) gives higher sigma than T 50 (edge)', () => {
      const baseBroth = { Ca: 200, B: 5, SiO2: 300, pH: 9.0 };
      const fluid_a = new FluidChemistry(baseBroth);
      const fluid_b = new FluidChemistry(baseBroth);
      const cond_sweet = new VugConditions({ temperature: 200, fluid: fluid_a });
      const cond_edge = new VugConditions({ temperature: 50, fluid: fluid_b });
      expect(cond_sweet.supersaturation_datolite()).toBeGreaterThan(cond_edge.supersaturation_datolite());
    });
  });
});
