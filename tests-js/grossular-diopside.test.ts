// tests-js/grossular-diopside.test.ts — paired Ca-Al-Mg calc-silicates
// (v112, 2026-05-20).
//
// Third commit of the Jeffrey Mine rodingite arc. Paired commit per
// vugg-add-mineral skill grouped-commit rule — both rodingite + skarn
// calc-silicates, both early-stage in the prograde sequence:
//
//   Grossular Ca3Al2(SiO4)3 — cubic Ca-Al garnet endmember
//     Varieties via trace dispatch: chromian green (Cr>1), hessonite
//     (Mn+Fe combo per Manning 1967), leuco-hessonite (Fe alone)
//
//   Diopside CaMgSi2O6 — monoclinic Ca-Mg clinopyroxene
//     Varieties: chrome-diopside (Cr>0.5, gem grade per Manning 1968),
//     grey-green-brown (Fe>20), violan (Mn rare Italian variety)
//
// Refs: Anthony Handbook v.IA + v.IIB; Manning 1967 + 1968; Cameron
// & Papike 1981 RIMG 7; Manning & Bird 1990 J.Petrol. 31:1 (rodingite
// clinopyroxenes); Bernardini 1981 MR 12(5):277.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Grossular Ca3Al2(SiO4)3 (v112)', () => {
  describe('supersaturation gate', () => {
    it('canonical Jeffrey rodingite broth gives sigma > 0', () => {
      const fluid = new FluidChemistry({ Ca: 200, Al: 30, SiO2: 300, pH: 10.5 });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_grossular()).toBeGreaterThan(0);
    });

    it('canonical skarn broth (Crestmore CA chromian) gives sigma > 0', () => {
      const fluid = new FluidChemistry({ Ca: 300, Al: 50, SiO2: 500, pH: 9.0, Cr: 5 });
      const cond = new VugConditions({ temperature: 450, fluid });
      expect(cond.supersaturation_grossular()).toBeGreaterThan(0);
    });

    it('Al = 0 blocks — grossular is Ca-Al garnet', () => {
      const fluid = new FluidChemistry({ Ca: 200, Al: 0, SiO2: 300, pH: 10.5 });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_grossular()).toBe(0);
    });

    it('pH = 6 blocks — alkaline-only (pH >= 7)', () => {
      const fluid = new FluidChemistry({ Ca: 200, Al: 30, SiO2: 300, pH: 6.0 });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_grossular()).toBe(0);
    });

    it('T = 700°C blocks — above 600 ceiling', () => {
      const fluid = new FluidChemistry({ Ca: 200, Al: 30, SiO2: 300, pH: 10.5 });
      const cond = new VugConditions({ temperature: 700, fluid });
      expect(cond.supersaturation_grossular()).toBe(0);
    });
  });

  describe('hessonite + chromian color routes (no gate change)', () => {
    it('Cr = 2 ppm doesn\'t block — chromian green dispatch', () => {
      const fluid = new FluidChemistry({ Ca: 200, Al: 30, SiO2: 300, pH: 10.5, Cr: 2 });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_grossular()).toBeGreaterThan(0);
    });

    it('Mn = 10 + Fe = 50 doesn\'t block — hessonite dispatch', () => {
      const fluid = new FluidChemistry({ Ca: 200, Al: 30, SiO2: 300, pH: 10.5, Mn: 10, Fe: 50 });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_grossular()).toBeGreaterThan(0);
    });
  });

  describe('Engine registered', () => {
    it('grossular grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.grossular).toBe('function');
    });
  });
});

describe('Diopside CaMgSi2O6 (v112)', () => {
  describe('supersaturation gate', () => {
    it('canonical Jeffrey rodingite broth gives sigma > 0', () => {
      const fluid = new FluidChemistry({ Ca: 200, Mg: 80, SiO2: 300, pH: 10.5 });
      const cond = new VugConditions({ temperature: 320, fluid });
      expect(cond.supersaturation_diopside()).toBeGreaterThan(0);
    });

    it('canonical skarn broth gives sigma > 0', () => {
      const fluid = new FluidChemistry({ Ca: 300, Mg: 120, SiO2: 500, pH: 9.0 });
      const cond = new VugConditions({ temperature: 420, fluid });
      expect(cond.supersaturation_diopside()).toBeGreaterThan(0);
    });

    it('Mg = 0 blocks — diopside is Ca-Mg pyroxene', () => {
      const fluid = new FluidChemistry({ Ca: 200, Mg: 0, SiO2: 300, pH: 10.5 });
      const cond = new VugConditions({ temperature: 320, fluid });
      expect(cond.supersaturation_diopside()).toBe(0);
    });

    it('pH = 6 blocks — alkaline-only', () => {
      const fluid = new FluidChemistry({ Ca: 200, Mg: 80, SiO2: 300, pH: 6.0 });
      const cond = new VugConditions({ temperature: 320, fluid });
      expect(cond.supersaturation_diopside()).toBe(0);
    });

    it('T = 700°C blocks — above 600 ceiling', () => {
      const fluid = new FluidChemistry({ Ca: 200, Mg: 80, SiO2: 300, pH: 10.5 });
      const cond = new VugConditions({ temperature: 700, fluid });
      expect(cond.supersaturation_diopside()).toBe(0);
    });
  });

  describe('chrome-diopside dispatch (no gate change)', () => {
    it('Cr = 2 ppm doesn\'t block — emerald-green gem dispatch', () => {
      const fluid = new FluidChemistry({ Ca: 200, Mg: 80, SiO2: 300, pH: 10.5, Cr: 2 });
      const cond = new VugConditions({ temperature: 320, fluid });
      expect(cond.supersaturation_diopside()).toBeGreaterThan(0);
    });
  });

  describe('Engine registered', () => {
    it('diopside grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.diopside).toBe('function');
    });
  });
});
