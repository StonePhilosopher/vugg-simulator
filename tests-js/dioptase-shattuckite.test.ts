// tests-js/dioptase-shattuckite.test.ts — Cu-silicate pair pins
// (v93, 2026-05-19).
//
// Closes a glaring catalog gap. Dioptase is THE Tsumeb world reference
// — type locality Altyn-Tyube, Kazakhstan (Hauy 1797); world-class
// gemmy emerald-green crystals from the Tsumeb 2nd oxidation zone.
// Shattuckite is named after the Shattuck mine, Bisbee, Arizona
// (Schaller 1915 J. Wash. Acad. Sci. 5:7) — having Bisbee in the sim
// without shattuckite was geologically untenable.
//
// Both fire in the same chemical regime — Cu + SiO2 oxidizing supergene
// with carbonate locally exhausted — but discriminate on:
//   * pH + Cu:Si stoichiometry: dioptase pH 6.5-8 (1:1 Cu/Si),
//     shattuckite pH 7.5-9 (5:4 Cu/Si — higher Cu activity needed)
//   * CO3 gate sharpness: dioptase CO3 < 50, shattuckite CO3 < 30
//   * Substrate preference: dioptase nucleates on calcite/dolomite,
//     shattuckite REPLACES malachite (the Bisbee signature reaction:
//     5 Cu2(CO3)(OH)2 + 8 SiO2 → 2 Cu5(SiO3)4(OH)2 + 5 CO2 + 3 H2O,
//     Evans & Mrose 1977 Am. Min. 62:491).
//
// References (research dossier 2026-05-19):
//   * Hauy R.J. (1797) — dioptase type description.
//   * Schaller W.T. (1915) — shattuckite type description.
//   * Ribbe/Gibbs/Hamil 1977 (Am. Min. 62:807) — dioptase structure.
//   * Evans & Mrose 1977 (Am. Min. 62:491) — shattuckite/plancheite
//     crystal chemistry + the malachite-replacement reaction.
//   * Keller P. (1977) MinRec 8(3) — Tsumeb shattuckite-plancheite-
//     dioptase paragenetic sequence.
//
// What this catches:
//   * Both engines exist and fire at appropriate conditions.
//   * The CO3 gate works: high CO3 routes Cu to malachite/azurite,
//     not to Cu-silicates.
//   * The pH discriminator works: dioptase fires at pH 7, shattuckite
//     doesn't; shattuckite fires at pH 8.5, dioptase weakly fires too.
//   * Tsumeb supergene fluid produces dioptase σ > 0.
//   * Bisbee supergene fluid produces shattuckite σ > 0 (when CO3
//     is low — late-stage carbonate-exhausted vug).
//   * High Cl suppresses dioptase (CuCl complexes).
//   * Low O2 (anoxic) blocks both (Cu must be Cu²⁺).

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Dioptase + shattuckite Cu-silicate pair (v93)', () => {
  describe('Dioptase fires under Tsumeb 2nd-oxidation-zone conditions', () => {
    it('Tsumeb supergene fluid gives dioptase σ > 0', () => {
      // Tsumeb 2nd oxidation zone: Cu present, SiO2 present, CO3
      // locally exhausted (prior malachite/azurite has consumed it),
      // pH near 7, T moderate, oxidizing.
      const fluid = new FluidChemistry({
        Cu: 20, SiO2: 40, CO3: 10, Cl: 100,
        O2: 1.2, pH: 7.2,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      expect(cond.supersaturation_dioptase()).toBeGreaterThan(0);
    });

    it('high CO3 (uncoexhausted carbonate) blocks dioptase', () => {
      // CO3 > 50 ppm — malachite/azurite still active, Cu-silicate
      // window not yet open.
      const fluid = new FluidChemistry({
        Cu: 20, SiO2: 40, CO3: 150, Cl: 100,
        O2: 1.2, pH: 7.2,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      expect(cond.supersaturation_dioptase()).toBe(0);
    });

    it('high Cl (CuCl complex mobilization) blocks dioptase', () => {
      // Cl > 5000 ppm: Cu stays in solution as CuCl2-, doesn't precipitate.
      const fluid = new FluidChemistry({
        Cu: 20, SiO2: 40, CO3: 10, Cl: 6000,
        O2: 1.2, pH: 7.2,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      expect(cond.supersaturation_dioptase()).toBe(0);
    });

    it('anoxic fluid (Cu not Cu²⁺) blocks dioptase', () => {
      const fluid = new FluidChemistry({
        Cu: 20, SiO2: 40, CO3: 10, Cl: 100,
        O2: 0.2, pH: 7.2,  // O2 < 1.0
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      expect(cond.supersaturation_dioptase()).toBe(0);
    });

    it('extreme pH outside 6.5-8.5 blocks dioptase', () => {
      const acid = new FluidChemistry({
        Cu: 20, SiO2: 40, CO3: 10, Cl: 100, O2: 1.2, pH: 5.5,
      });
      const cond_acid = new VugConditions({ temperature: 50, fluid: acid });
      expect(cond_acid.supersaturation_dioptase()).toBe(0);

      const alk = new FluidChemistry({
        Cu: 20, SiO2: 40, CO3: 10, Cl: 100, O2: 1.2, pH: 9.5,
      });
      const cond_alk = new VugConditions({ temperature: 50, fluid: alk });
      expect(cond_alk.supersaturation_dioptase()).toBe(0);
    });
  });

  describe('Shattuckite fires under Bisbee replacement conditions', () => {
    it('Bisbee carbonate-exhausted vug gives shattuckite σ > 0', () => {
      // Bisbee late supergene: high Cu, sustained SiO2, CO3 near zero
      // (malachite/azurite have fully consumed it), pH alkaline
      // (carbonate-buffered limestone host).
      const fluid = new FluidChemistry({
        Cu: 30, SiO2: 50, CO3: 5, Cl: 100, SO4: 50,
        O2: 1.0, pH: 8.2,
      });
      const cond = new VugConditions({ temperature: 40, fluid });
      expect(cond.supersaturation_shattuckite()).toBeGreaterThan(0);
    });

    it('lower-pH dioptase regime gives shattuckite σ = 0 (pH discriminator)', () => {
      // pH 7.0 — squarely in dioptase territory, below shattuckite's
      // 7.5-9.5 window. The pH discriminator is the fork mechanism.
      const fluid = new FluidChemistry({
        Cu: 30, SiO2: 50, CO3: 5, Cl: 100, SO4: 50,
        O2: 1.0, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 40, fluid });
      expect(cond.supersaturation_shattuckite()).toBe(0);
    });

    it('high S in oxidizing fluid (brochantite/antlerite competition) blocks shattuckite', () => {
      // S > 500 in oxidizing fluid = sulfate-rich; brochantite/antlerite
      // win the Cu budget over shattuckite.
      const fluid = new FluidChemistry({
        Cu: 30, SiO2: 50, CO3: 5, Cl: 100, S: 800,
        O2: 1.0, pH: 8.2,
      });
      const cond = new VugConditions({ temperature: 40, fluid });
      expect(cond.supersaturation_shattuckite()).toBe(0);
    });

    it('tighter CO3 gate than dioptase (CO3=25 blocks shattuckite, allows dioptase)', () => {
      // CO3 = 25: above shattuckite's 30 cutoff if we cross it slightly,
      // dioptase still passes. Use CO3 = 35 to exceed shattuckite's gate.
      const fluid = new FluidChemistry({
        Cu: 30, SiO2: 50, CO3: 35, Cl: 100, SO4: 50,
        O2: 1.0, pH: 7.8,  // dioptase-permissive
      });
      const cond = new VugConditions({ temperature: 40, fluid });
      // Shattuckite: CO3 > 30 → blocked
      expect(cond.supersaturation_shattuckite()).toBe(0);
      // Dioptase: CO3 35 < 50 → permitted (but smoothly attenuated)
      expect(cond.supersaturation_dioptase()).toBeGreaterThan(0);
    });
  });

  describe('pH discriminator between dioptase and shattuckite', () => {
    it('pH 7.2 favors dioptase, suppresses shattuckite', () => {
      const fluid = new FluidChemistry({
        Cu: 25, SiO2: 45, CO3: 10, Cl: 100, SO4: 50,
        O2: 1.2, pH: 7.2,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      const dio = cond.supersaturation_dioptase();
      const sha = cond.supersaturation_shattuckite();
      expect(dio).toBeGreaterThan(0);
      expect(sha).toBe(0);  // pH 7.2 below shattuckite's 7.5 floor
    });

    it('pH 8.2 favors shattuckite, dioptase still fires', () => {
      const fluid = new FluidChemistry({
        Cu: 25, SiO2: 45, CO3: 10, Cl: 100, SO4: 50,
        O2: 1.2, pH: 8.2,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      const dio = cond.supersaturation_dioptase();
      const sha = cond.supersaturation_shattuckite();
      expect(sha).toBeGreaterThan(0);
      expect(dio).toBeGreaterThan(0);
      // At pH 8.2, shattuckite is at its sweet-spot (8.0-8.5)
      // while dioptase is past its sweet-spot (7.0-7.5)
    });
  });

  describe('Engines registered in MINERAL_ENGINES', () => {
    it('dioptase grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.dioptase).toBe('function');
    });
    it('shattuckite grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.shattuckite).toBe('function');
    });
  });
});
