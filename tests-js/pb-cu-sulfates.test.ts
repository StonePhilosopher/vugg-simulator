// tests-js/pb-cu-sulfates.test.ts — Pb-Cu supergene sulfate trio
// (v100, 2026-05-19).
//
// Three supergene Pb-Cu sulfate-carbonate-hydroxide minerals from
// the late-stage Pb-Cu oxidation cycle (Leadhills Scotland type
// district + Tsumeb + Bisbee). All require SIMULTANEOUS oxidation
// of galena AND Cu-sulfide. Discriminator: pH + CO3:SO4 ratio:
//
//   linarite     PbCu(SO4)(OH)2         pH 4-7    CO3:SO4 < 0.3
//                                        (Cu-Pb rich + low-CO3)
//   caledonite   Pb5Cu2(CO3)(SO4)3(OH)6 pH 5-7    CO3:SO4 0.3-1
//                                        (mixed, blue-green)
//   leadhillite  Pb4(SO4)(CO3)2(OH)2    pH 6-8    CO3:SO4 > 1.5
//                                        (CO3-dominant, Cu-poor)
//
// Refs: Williams 1990 Oxide Zone Geochemistry; Smith 1994 Tsumeb
// monograph; Wilson & Dunn 1978 MinRec 9:251 (Leadhills); Steele
// et al. 1998 Mineralog. Mag. 62:451 (leadhillite polymorphism).

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Pb-Cu supergene sulfate trio (v100)', () => {
  describe('Linarite — Pb-Cu sulfate-hydroxide, low CO3', () => {
    it('Pb + Cu + S, low CO3, mildly acidic fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 200, CO3: 10, O2: 1.0, pH: 5.5,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_linarite()).toBeGreaterThan(0);
    });

    it('CO3:SO4 > 0.3 blocks (caledonite or leadhillite win)', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 100, CO3: 100, O2: 1.0, pH: 5.5,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_linarite()).toBe(0);
    });

    it('High Cl blocks (boleite group)', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 200, CO3: 10, Cl: 300, O2: 1.0, pH: 5.5,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_linarite()).toBe(0);
    });
  });

  describe('Caledonite — Pb-Cu carbonate-sulfate, mixed', () => {
    it('Pb + Cu + S + CO3, balanced ratio, gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 100, CO3: 50, O2: 1.0, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_caledonite()).toBeGreaterThan(0);
    });

    it('Very low CO3 blocks (linarite wins)', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 200, CO3: 2, O2: 1.0, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_caledonite()).toBe(0);
    });

    it('Very high CO3 blocks (leadhillite wins)', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 50, CO3: 300, O2: 1.0, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_caledonite()).toBe(0);
    });
  });

  describe('Leadhillite — Pb sulfate-carbonate, CO3-dominant Cu-poor', () => {
    it('Pb + S + high CO3, alkaline, Cu-poor fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Pb: 150, Cu: 5, S: 50, CO3: 200, O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_leadhillite()).toBeGreaterThan(0);
    });

    it('Cu > 50 blocks (caledonite/linarite win)', () => {
      const fluid = new FluidChemistry({
        Pb: 150, Cu: 100, S: 50, CO3: 200, O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_leadhillite()).toBe(0);
    });

    it('Low CO3:SO4 blocks (need CO3-dominant)', () => {
      const fluid = new FluidChemistry({
        Pb: 150, Cu: 5, S: 200, CO3: 30, O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_leadhillite()).toBe(0);
    });
  });

  describe('CO3:SO4 ratio sweep — the discriminator works', () => {
    it('CO3:SO4 = 0.05: linarite fires, caledonite + leadhillite blocked', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 200, CO3: 10, O2: 1.0, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_linarite()).toBeGreaterThan(0);
      expect(cond.supersaturation_caledonite()).toBe(0);
      expect(cond.supersaturation_leadhillite()).toBe(0);
    });

    it('CO3:SO4 = 0.5: caledonite fires, linarite + leadhillite blocked', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 50, S: 100, CO3: 50, O2: 1.0, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_linarite()).toBe(0);
      expect(cond.supersaturation_caledonite()).toBeGreaterThan(0);
      expect(cond.supersaturation_leadhillite()).toBe(0);
    });

    it('CO3:SO4 = 4.0: leadhillite fires, linarite + caledonite blocked', () => {
      const fluid = new FluidChemistry({
        Pb: 150, Cu: 5, S: 50, CO3: 200, O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_linarite()).toBe(0);
      expect(cond.supersaturation_caledonite()).toBe(0);
      expect(cond.supersaturation_leadhillite()).toBeGreaterThan(0);
    });
  });

  describe('Engines registered in MINERAL_ENGINES', () => {
    it('all three Pb-Cu sulfate engines wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.linarite).toBe('function');
      expect(typeof MINERAL_ENGINES.caledonite).toBe('function');
      expect(typeof MINERAL_ENGINES.leadhillite).toBe('function');
    });
  });
});
