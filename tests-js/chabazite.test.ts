// tests-js/chabazite.test.ts — chabazite, the late intermediate-Si amygdule
// zeolite (v203, 2026-06-17).
//
// The sixth and last zeolite of the Deccan amygdule suite (thomsonite ->
// scolecite/mesolite -> stilbite/heulandite -> chabazite). Ca2Al2Si4O12·6H2O,
// Si/Al~2 (intermediate). CATION-FLEXIBLE: extra-framework Ca > Na > K, K NOT
// required — chabazite-Ca is the basalt-amygdule default. Late, cool, perching.
//
// What these tests catch:
//   - the cation-flexible gate (fires Ca-dominant; fires WITHOUT K)
//   - the Al + intermediate-silica floor
//   - the alkaline gate
//   - the late/cool T window (fires cool; the hot early stage blocks)
//   - engine registered

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

function amygFluid(overrides: any = {}) {
  return new FluidChemistry({
    Ca: 220, Na: 80, K: 2, Al: 15, SiO2: 400, pH: 8.5, CO3: 80, ...overrides,
  });
}

describe('Chabazite — late intermediate-Si amygdule zeolite (v203)', () => {
  describe('gates', () => {
    it('fires in the Ca-dominant amygdule fluid (cool)', () => {
      const cond = new VugConditions({ temperature: 80, fluid: amygFluid() });
      expect(cond.supersaturation_chabazite()).toBeGreaterThan(0);
    });

    it('fires WITHOUT K (K is not required — chabazite-Ca)', () => {
      const cond = new VugConditions({ temperature: 80, fluid: amygFluid({ K: 0 }) });
      expect(cond.supersaturation_chabazite()).toBeGreaterThan(0);
    });

    it('Ca-poor fluid blocks', () => {
      const cond = new VugConditions({ temperature: 80, fluid: amygFluid({ Ca: 20, Na: 0 }) });
      expect(cond.supersaturation_chabazite()).toBe(0);
    });

    it('Al-poor fluid blocks', () => {
      const cond = new VugConditions({ temperature: 80, fluid: amygFluid({ Al: 1 }) });
      expect(cond.supersaturation_chabazite()).toBe(0);
    });

    it('low-silica fluid blocks (intermediate-Si floor 200)', () => {
      const cond = new VugConditions({ temperature: 80, fluid: amygFluid({ SiO2: 150 }) });
      expect(cond.supersaturation_chabazite()).toBe(0);
    });

    it('acidic fluid blocks', () => {
      const cond = new VugConditions({ temperature: 80, fluid: amygFluid({ pH: 5.5 }) });
      expect(cond.supersaturation_chabazite()).toBe(0);
    });

    it('too hot blocks (late/cool phase — T=200)', () => {
      const cond = new VugConditions({ temperature: 200, fluid: amygFluid() });
      expect(cond.supersaturation_chabazite()).toBe(0);
    });
  });

  describe('Engine registered in MINERAL_ENGINES', () => {
    it('chabazite grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.chabazite).toBe('function');
    });
  });
});
