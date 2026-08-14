// tests-js/zn-supergene.test.ts — Zn supergene triad pins
// (v98, 2026-05-19).
//
// Three Zn supergene minerals from the nonsulfide Zn deposit
// paragenesis (Tsumeb / Skorpion Namibia / Franklin-Sterling NJ /
// Iglesiente Sardinia). Discriminators per Hitzman et al. 2003 +
// Boni & Mondillo 2015:
//
//   hemimorphite Zn4Si2O7(OH)2·H2O  <50°C  pH 5.5-8  CO3 < SiO2
//   willemite    Zn2SiO4              50-200° supergene OR 500-600 primary
//   hydrozincite Zn5(CO3)2(OH)6      <30°C  pH 7-9   SiO2 < 50, low Cu
//
// References:
//   * Hitzman M.W. et al. (2003) "Nonsulfide zinc deposits."
//     Econ. Geol. 98:685-714.
//   * Boni M. & Mondillo N. (2015) "The 'Calamines' and the
//     'others'." Ore Geol. Rev. 67:208-233.
//   * Frondel C. (1972) on Franklin troostite.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Zn supergene triad — hemimorphite + willemite + hydrozincite (v98)', () => {
  describe('Hemimorphite — Zn silicate, supergene low-T', () => {
    it('Tsumeb-style Zn + SiO2 supergene fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Zn: 50, SiO2: 300, CO3: 30, O2: 1.0, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_hemimorphite()).toBeGreaterThan(0);
    });

    it('CO3 > SiO2 blocks (smithsonite wins)', () => {
      const fluid = new FluidChemistry({
        Zn: 50, SiO2: 300, CO3: 400, O2: 1.0, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_hemimorphite()).toBe(0);
    });

    it('T > 50 blocks (dehydrates to willemite)', () => {
      const fluid = new FluidChemistry({
        Zn: 50, SiO2: 300, CO3: 30, O2: 1.0, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 80, fluid });
      expect(cond.supersaturation_hemimorphite()).toBe(0);
    });
  });

  describe('Willemite — bimodal: supergene OR primary metamorphic', () => {
    it('Skorpion-style supergene (80°C, Zn-rich, SiO2 moderate) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Zn: 200, SiO2: 200, O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 100, fluid });
      expect(cond.supersaturation_willemite()).toBeGreaterThan(0);
    });

    it('Franklin-style primary metamorphic (550°C) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        // O2 0.6 (was 0.5, exactly at the rung-4a floor): the Franklin
        // willemite+franklinite+zincite assemblage is an OXIDIZED one, so it
        // sits comfortably above the 0.5 floor (SIM 230). Headroom decouples
        // "Franklin forms" from "0.5 is the exact floor".
        Zn: 200, SiO2: 200, Mn: 50, O2: 0.6, pH: 7.5,
      });
      const cond = new VugConditions({ temperature: 550, fluid });
      expect(cond.supersaturation_willemite()).toBeGreaterThan(0);
    });

    it('T < 50 blocks willemite (hemimorphite or smithsonite take supergene niche)', () => {
      const fluid = new FluidChemistry({
        Zn: 200, SiO2: 200, O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_willemite()).toBe(0);
    });
  });

  describe('Hydrozincite — latest+coolest Zn supergene', () => {
    it('Iglesiente cave-floor style (Zn + CO3, alkaline, cool, low Si/Cu) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Zn: 20, CO3: 250, SiO2: 20, Cu: 1, O2: 1.0, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_hydrozincite()).toBeGreaterThan(0);
    });

    it('SiO2 > 50 blocks (hemimorphite wins)', () => {
      const fluid = new FluidChemistry({
        Zn: 20, CO3: 250, SiO2: 200, Cu: 1, O2: 1.0, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_hydrozincite()).toBe(0);
    });

    it('Cu-rich blocks (aurichalcite wins)', () => {
      const fluid = new FluidChemistry({
        Zn: 20, CO3: 250, SiO2: 20, Cu: 50, O2: 1.0, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_hydrozincite()).toBe(0);
    });

    it('T > 30 blocks (8 H2O dehydrates... wait, hydrozincite has 6 OH not 8 H2O — but still T-sensitive)', () => {
      const fluid = new FluidChemistry({
        Zn: 20, CO3: 250, SiO2: 20, Cu: 1, O2: 1.0, pH: 8.0,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      expect(cond.supersaturation_hydrozincite()).toBe(0);
    });

    it('acidic pH < 7 blocks (smithsonite wins)', () => {
      const fluid = new FluidChemistry({
        Zn: 20, CO3: 250, SiO2: 20, Cu: 1, O2: 1.0, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_hydrozincite()).toBe(0);
    });
  });

  describe('Reducing conditions block all three', () => {
    it('O2 < 0.3 blocks the whole triad', () => {
      const fluid = new FluidChemistry({
        Zn: 200, SiO2: 200, CO3: 250, O2: 0.1, pH: 7.5,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_hemimorphite()).toBe(0);
      expect(cond.supersaturation_willemite()).toBe(0);
      expect(cond.supersaturation_hydrozincite()).toBe(0);
    });
  });

  describe('Engines registered in MINERAL_ENGINES', () => {
    it('all three Zn supergene engines wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.hemimorphite).toBe('function');
      expect(typeof MINERAL_ENGINES.willemite).toBe('function');
      expect(typeof MINERAL_ENGINES.hydrozincite).toBe('function');
    });
  });
});
