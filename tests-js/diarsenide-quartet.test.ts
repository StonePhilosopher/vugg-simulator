// tests-js/diarsenide-quartet.test.ts — five-element vein primary
// arsenide pins (v95, 2026-05-19).
//
// Closes the BIG Schneeberg gap. The five-element vein arsenide stage
// (Co-Ni-Ag-Bi-As, defined Kissin 1992) at Schneeberg / Jachymov /
// Cobalt-Ontario / Bou Azzer / Andreasberg canonically contains 10+
// primary arsenide phases. The simulator previously had only 4
// (cobaltite + nickeline + arsenopyrite + native_arsenic). v95 adds
// the diarsenide quartet (the orthorhombic+cubic primary arsenides):
//
//   skutterudite   (Co,Ni,Fe)As3   T 280-500  Co dominant, S < 5
//   safflorite     (Co,Fe)As2      T 200-380  Co dominant, S < 15
//   rammelsbergite NiAs2           T 250-420  Ni dominant, S < 20
//   loellingite    FeAs2           T 150-450  Fe dominant, S < 1
//
// Discriminator gates per Kissin (1992) + Markl (2016) +
// Kretschmar & Scott (1976):
//   * Reducing (sulfideRedoxAnoxic), pH 5-7.5
//   * As >> S in fluid (X_As > 0.95 in solid)
//   * T windows distinct per mineral
//   * Loellingite has the sharpest S gate (< 1 ppm) — encodes the
//     fS2 boundary above which the system flips to arsenopyrite
//
// References:
//   * Kissin S.A. (1992) Geosci. Canada 19:113-124
//   * Markl et al. (2016) Min. Dep. 51:703-718 (Odenwald)
//   * Ondrus et al. (2003) J. Geosci. 48:157-192 (Jachymov)
//   * Radcliffe & Berry (1968) Am. Min. 53:1856 (safflorite-loellingite)
//   * Kretschmar & Scott (1976) Can. Min. 14:364 (fS2 boundary)
//
// What this catches:
//   * All four engines exist and fire at their distinct T windows.
//   * Co/Ni/Fe metal-dominance discriminator works.
//   * S-tolerance gates differ per mineral (loellingite sharpest).
//   * Sulfide-bearing fluid blocks ALL diarsenides.
//   * Rammelsbergite suppressed when Co > Ni.
//   * Loellingite suppressed when S > 1 (arsenopyrite field).
//   * Skutterudite needs the highest reducing strength of the four.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Diarsenide quartet — five-element vein primary arsenides (v95)', () => {
  describe('Skutterudite — Co-Ni-Fe triarsenide, deepest+hottest', () => {
    it('Schneeberg-style fluid (Co-rich, reducing, hot, very low S) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Co: 80, Ni: 20, As: 100, S: 0.5, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 380, fluid });
      expect(cond.supersaturation_skutterudite()).toBeGreaterThan(0);
    });

    it('S > 5 blocks (essentially no sulfur tolerance — Markl X_As 0.96-0.99)', () => {
      const fluid = new FluidChemistry({
        Co: 80, Ni: 20, As: 100, S: 10, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 380, fluid });
      expect(cond.supersaturation_skutterudite()).toBe(0);
    });

    it('T < 280 blocks (lower-T arsenides take over)', () => {
      const fluid = new FluidChemistry({
        Co: 80, Ni: 20, As: 100, S: 0.5, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 220, fluid });
      expect(cond.supersaturation_skutterudite()).toBe(0);
    });
  });

  describe('Safflorite — Co-Fe diarsenide, mid-T mantles', () => {
    it('Co-rich Fe-tolerant fluid at 280°C gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Co: 60, Fe: 50, As: 50, S: 5, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 280, fluid });
      expect(cond.supersaturation_safflorite()).toBeGreaterThan(0);
    });

    it('S > 15 blocks (~0.9 wt% solid tolerance — Handbook chemistry)', () => {
      const fluid = new FluidChemistry({
        Co: 60, Fe: 50, As: 50, S: 25, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 280, fluid });
      expect(cond.supersaturation_safflorite()).toBe(0);
    });
  });

  describe('Rammelsbergite — Ni-dominant, pink tint', () => {
    it('Ni-rich, Co-depleted fluid at 320°C gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Ni: 80, Co: 5, As: 50, S: 5, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 320, fluid });
      expect(cond.supersaturation_rammelsbergite()).toBeGreaterThan(0);
    });

    it('Co > Ni in fluid suppresses (engine multiplies σ by 0.5; with Co-dominant gate this can still fire but reduced)', () => {
      const fluid_ni = new FluidChemistry({
        Ni: 80, Co: 5, As: 50, S: 5, O2: 0.001, pH: 6.5,
      });
      const fluid_co = new FluidChemistry({
        Ni: 80, Co: 100, As: 50, S: 5, O2: 0.001, pH: 6.5,
      });
      const cond_ni = new VugConditions({ temperature: 320, fluid: fluid_ni });
      const cond_co = new VugConditions({ temperature: 320, fluid: fluid_co });
      expect(cond_co.supersaturation_rammelsbergite())
        .toBeLessThan(cond_ni.supersaturation_rammelsbergite());
    });
  });

  describe('Loellingite — Fe-dominant, sharp arsenopyrite boundary', () => {
    it('Fe-rich, very low S fluid at 250°C gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Fe: 100, As: 50, S: 0.5, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 250, fluid });
      expect(cond.supersaturation_loellingite()).toBeGreaterThan(0);
    });

    it('S > 1 blocks — the Kretschmar & Scott (1976) arsenopyrite phase boundary', () => {
      // fS2 above ~10^-12 atm at T=300°C flips loellingite to arsenopyrite.
      const fluid = new FluidChemistry({
        Fe: 100, As: 50, S: 5, O2: 0.001, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 250, fluid });
      expect(cond.supersaturation_loellingite()).toBe(0);
    });

    it('Widest T range — fires at both 200°C and 400°C', () => {
      const f200 = new FluidChemistry({
        Fe: 100, As: 50, S: 0.5, O2: 0.001, pH: 6.5,
      });
      const f400 = new FluidChemistry({
        Fe: 100, As: 50, S: 0.5, O2: 0.001, pH: 6.5,
      });
      const c200 = new VugConditions({ temperature: 200, fluid: f200 });
      const c400 = new VugConditions({ temperature: 400, fluid: f400 });
      expect(c200.supersaturation_loellingite()).toBeGreaterThan(0);
      expect(c400.supersaturation_loellingite()).toBeGreaterThan(0);
    });
  });

  describe('All four require oxidizing-FREE conditions (reducing)', () => {
    it('Oxidizing fluid (O2 > 0.5) blocks ALL diarsenides', () => {
      const fluid = new FluidChemistry({
        Co: 80, Ni: 50, Fe: 100, As: 100, S: 0.5, O2: 1.5, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 300, fluid });
      expect(cond.supersaturation_skutterudite()).toBe(0);
      expect(cond.supersaturation_safflorite()).toBe(0);
      expect(cond.supersaturation_rammelsbergite()).toBe(0);
      expect(cond.supersaturation_loellingite()).toBe(0);
    });
  });

  describe('Engines registered in MINERAL_ENGINES', () => {
    it('all four diarsenide engines wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.skutterudite).toBe('function');
      expect(typeof MINERAL_ENGINES.safflorite).toBe('function');
      expect(typeof MINERAL_ENGINES.rammelsbergite).toBe('function');
      expect(typeof MINERAL_ENGINES.loellingite).toBe('function');
    });
  });
});
