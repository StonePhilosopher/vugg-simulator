// tests-js/thomsonite.test.ts — thomsonite, the earliest amygdule zeolite
// (v202, 2026-06-17).
//
// The most-aluminous (Si/Al~1) and earliest of the basalt-amygdule zeolites,
// completing the Deccan early-zeolite suite (thomsonite → scolecite/mesolite →
// stilbite/heulandite). NaCa2Al5Si5O20·6H2O — Ca-dominant, Na-essential-minor.
//
// The discriminator from the higher-Si natrolite group is a SOFT low-silica
// preference (NOT Na/Ca — both are Na-Ca). So these tests check the cation gates
// + the silica behaviour rather than a hard silica ceiling.
//
// What these tests catch:
//   - essential cations (Ca dominant, Na essential-minor) + Al + silica floor
//   - the Ca-dominant gate (strongly Na-dominant fluid blocks)
//   - the low silica floor (fires at low SiO2 where the most-aluminous zeolite is favored)
//   - the soft low-silica preference (stronger sigma at low SiO2 than flooded)
//   - both engine registered

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

function amygFluid(overrides: any = {}) {
  return new FluidChemistry({
    Ca: 200, Na: 60, Al: 15, SiO2: 250, pH: 8.5, CO3: 80, ...overrides,
  });
}

describe('Thomsonite — earliest amygdule zeolite (v202)', () => {
  describe('gates', () => {
    it('fires in Ca-dominant Na-bearing alkaline fluid', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid() });
      expect(cond.supersaturation_thomsonite()).toBeGreaterThan(0);
    });

    it('Ca-poor fluid blocks', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid({ Ca: 20 }) });
      expect(cond.supersaturation_thomsonite()).toBe(0);
    });

    it('Na-absent fluid blocks (Na is essential — NaCa2)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid({ Na: 0 }) });
      expect(cond.supersaturation_thomsonite()).toBe(0);
    });

    it('strongly Na-dominant fluid blocks (Na/(Na+Ca) > 0.6)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid({ Ca: 60, Na: 200 }) });
      expect(cond.supersaturation_thomsonite()).toBe(0);
    });

    it('Al-poor fluid blocks (most-aluminous zeolite)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid({ Al: 1 }) });
      expect(cond.supersaturation_thomsonite()).toBe(0);
    });

    it('acidic fluid blocks', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid({ pH: 5.5 }) });
      expect(cond.supersaturation_thomsonite()).toBe(0);
    });

    it('fires at low silica (SiO2=150, the low floor)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: amygFluid({ SiO2: 150 }) });
      expect(cond.supersaturation_thomsonite()).toBeGreaterThan(0);
    });
  });

  describe('soft low-silica preference (the discriminator)', () => {
    it('sigma is stronger at low silica than at flooded silica (same Al)', () => {
      const lowSi = new VugConditions({ temperature: 90, fluid: amygFluid({ SiO2: 200 }) });
      const floodSi = new VugConditions({ temperature: 90, fluid: amygFluid({ SiO2: 1200 }) });
      // Both may fire (no hard ceiling), but low-silica is favored.
      expect(lowSi.supersaturation_thomsonite()).toBeGreaterThan(floodSi.supersaturation_thomsonite());
    });
  });

  describe('Engine registered in MINERAL_ENGINES', () => {
    it('thomsonite grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.thomsonite).toBe('function');
    });
  });
});
