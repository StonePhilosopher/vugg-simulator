// tests-js/epidote.test.ts — epidote Ca2(Al,Fe3+)3(SiO4)(Si2O7)O(OH) (v196, 2026-06-15).
//
// Epidote is the Fe3+ endmember of the clinozoisite-epidote sorosilicate series
// and the first alpine-cleft Fe3+ silicate in the catalog. Its defining
// geochemical control is REDOX: it requires ferric iron, so an oxidizing fluid
// near the hematite-magnetite buffer. Under reducing conditions Fe partitions
// into magnetite + actinolite (Fe2+) and clinozoisite forms instead (Holdaway
// 1972 CMP 37:307; Liou 1973 J.Petrol 14:381; Armbruster et al. 2006 EJM
// 18:551). These tests pin that oxidizing gate as the discriminator, plus the
// Ca/Al/Fe/Si + T + pH gates and engine registration.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

// An oxidized alpine-cleft fluid (Tormiq-type): Ca-Al-Fe-Si, near-neutral,
// O2 oxidizing. CO3 forced low so the default 150 doesn't perturb the test.
function cleftFluid(over: any = {}) {
  return new FluidChemistry({ Ca: 500, Al: 8, Fe: 20, SiO2: 200, O2: 1.5, pH: 7.5, CO3: 5, ...over });
}

describe('Epidote — Fe3+ alpine-cleft sorosilicate (v196)', () => {
  describe('the oxidizing Fe3+ gate (the discriminator)', () => {
    it('oxidized Ca-Al-Fe-Si fluid at cleft T gives sigma > 0', () => {
      const cond = new VugConditions({ temperature: 320, fluid: cleftFluid() });
      expect(cond.supersaturation_epidote()).toBeGreaterThan(0);
    });

    it('REDUCING fluid (low O2) blocks epidote — Fe stays ferrous → clinozoisite/magnetite', () => {
      const cond = new VugConditions({ temperature: 320, fluid: cleftFluid({ O2: 0.1 }) });
      expect(cond.supersaturation_epidote()).toBe(0);
    });

    it('more oxidizing fluid gives stronger sigma than barely-oxidizing', () => {
      const lo = new VugConditions({ temperature: 320, fluid: cleftFluid({ O2: 0.6 }) });
      const hi = new VugConditions({ temperature: 320, fluid: cleftFluid({ O2: 2.0 }) });
      expect(hi.supersaturation_epidote()).toBeGreaterThan(lo.supersaturation_epidote());
    });
  });

  describe('compositional + environmental gates', () => {
    it('no Al blocks (epidote is an Al-rich silicate)', () => {
      const cond = new VugConditions({ temperature: 320, fluid: cleftFluid({ Al: 0 }) });
      expect(cond.supersaturation_epidote()).toBe(0);
    });

    it('no Fe blocks (the M3 cation)', () => {
      const cond = new VugConditions({ temperature: 320, fluid: cleftFluid({ Fe: 0 }) });
      expect(cond.supersaturation_epidote()).toBe(0);
    });

    it('too cold (< 200 C) blocks', () => {
      const cond = new VugConditions({ temperature: 150, fluid: cleftFluid() });
      expect(cond.supersaturation_epidote()).toBe(0);
    });

    it('too hot (> 450 C) blocks', () => {
      const cond = new VugConditions({ temperature: 500, fluid: cleftFluid() });
      expect(cond.supersaturation_epidote()).toBe(0);
    });

    it('strongly acidic fluid (pH < 6.5) blocks', () => {
      const cond = new VugConditions({ temperature: 320, fluid: cleftFluid({ pH: 4.0 }) });
      expect(cond.supersaturation_epidote()).toBe(0);
    });
  });

  describe('Engine registered in MINERAL_ENGINES', () => {
    it('epidote grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.epidote).toBe('function');
    });
  });
});
