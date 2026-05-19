// tests-js/arsenic-state-split.test.ts — As(III) vs As(V) state-split
// helper pins (v92, 2026-05-19).
//
// Closes residual debt flagged from the v85-v90 mineral push: the
// simulator's single fluid.As pool couldn't represent oxidation state
// distinctly. The v88 pharmacolite engine carried a hard
// `if (fluid.S > 50) return 0` band-aid for exactly this reason —
// Sulphur Bank's S=400 ppm fluid would otherwise have fired
// pharmacolite incorrectly during O2-spike events.
//
// v92 fix: arsenicOxidizedFraction(fluid) returns the fraction of
// fluid.As in As(V) state. arsenateAvailablePpm returns As(V) ppm;
// arseniteAvailablePpm returns As(III) ppm. Sum equals fluid.As.
//
// Geochemistry model:
//   * Sulfide hard-suppression: when S > 50 AND O2 < 1.0, As stays
//     as As(III) (thioarsenite complexes are stable).
//   * O2-driven oxidation: ramp from 0 at O2=0.1 to 1 at O2=1.5
//     when S is depleted.
//
// What this catches:
//   * The helpers exist and return correct values across the As-state
//     phase diagram.
//   * Sum of arsenateAvailablePpm + arseniteAvailablePpm == fluid.As.
//   * Sulphur-Bank-style fluid (S=400, O2 spikes to 0.4) keeps As(V)=0
//     even when bulk O2 looks oxidizing.
//   * Supergene-style fluid (S<5, O2>1.5) gives As(V) = full As.
//   * Schneeberg-late-style fluid (S=5, O2=1.5) gives As(V) = full As.
//   * Schneeberg-pegmatite-style fluid (S=30, O2=0) gives As(III) = full As.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const arsenicOxidizedFraction: any;
declare const arsenateAvailablePpm: any;
declare const arseniteAvailablePpm: any;

describe('Arsenic oxidation-state split (v92)', () => {
  describe('arsenicOxidizedFraction returns correct values across the phase diagram', () => {
    it('PPM helpers return 0 when As is absent (even though fraction is a ratio)', () => {
      // arsenicOxidizedFraction returns 1.0 here (the ratio is
      // mathematically valid even with As=0 in fully-oxic fluid), but
      // the PPM helpers correctly return 0 since 0 * anything = 0.
      // What matters for engine consumers is the PPM, not the fraction.
      const f = new FluidChemistry({ As: 0, O2: 1.5, S: 0 });
      expect(arsenateAvailablePpm(f)).toBe(0);
      expect(arseniteAvailablePpm(f)).toBe(0);
    });

    it('returns 0 for sulfide-rich fluid at modest O2 (Sulphur Bank synproportionation)', () => {
      // Sulphur Bank initial: S=400, O2=0.4 (during synproportionation
      // spike). S > 50 AND O2 < 1.0 → As locked as As(III).
      const f = new FluidChemistry({ As: 10, S: 400, O2: 0.4 });
      expect(arsenicOxidizedFraction(f)).toBe(0);
    });

    it('returns 0 for fully reduced fluid (schneeberg pegmatite phase)', () => {
      // Schneeberg initial: As=60, S=30, O2=0.0.
      const f = new FluidChemistry({ As: 60, S: 30, O2: 0.0 });
      expect(arsenicOxidizedFraction(f)).toBe(0);
    });

    it('returns 1.0 for fully oxidized fluid with no sulfide (supergene_oxidation)', () => {
      // Supergene Tsumeb: As=25, S=0, O2=1.5.
      const f = new FluidChemistry({ As: 25, S: 0, O2: 1.5 });
      expect(arsenicOxidizedFraction(f)).toBe(1);
    });

    it('returns 1.0 for schneeberg-late chemistry (sulfide consumed)', () => {
      // Late phase: S=5 (consumed by sulfides), O2=1.5 (oxidizing pulse).
      const f = new FluidChemistry({ As: 30, S: 5, O2: 1.5 });
      expect(arsenicOxidizedFraction(f)).toBe(1);
    });

    it('ramps smoothly between O2=0.1 (anoxic floor) and O2=1.5 (oxic ceiling) with low S', () => {
      // S < 50 → no sulfide hard-block; transitions on O2 alone.
      const f01 = new FluidChemistry({ As: 10, S: 5, O2: 0.1 });
      const f08 = new FluidChemistry({ As: 10, S: 5, O2: 0.8 });
      const f15 = new FluidChemistry({ As: 10, S: 5, O2: 1.5 });
      expect(arsenicOxidizedFraction(f01)).toBe(0);     // hard floor
      expect(arsenicOxidizedFraction(f08)).toBeCloseTo(0.5, 1);  // ~midpoint
      expect(arsenicOxidizedFraction(f15)).toBe(1);     // hard ceiling
    });

    it('sulfide hard-block lifts when O2 climbs above 1.0', () => {
      // Even high S can't keep As(III) if O2 is fully oxic enough to
      // outpace thioarsenite formation.
      const f = new FluidChemistry({ As: 10, S: 100, O2: 1.5 });
      expect(arsenicOxidizedFraction(f)).toBeGreaterThan(0);
    });
  });

  describe('arsenateAvailablePpm + arseniteAvailablePpm sum invariant', () => {
    it('sum equals total fluid.As across the full phase diagram', () => {
      const cases = [
        { As: 50, S: 0, O2: 1.5 },
        { As: 50, S: 200, O2: 0.3 },
        { As: 50, S: 5, O2: 0.5 },
        { As: 50, S: 5, O2: 1.5 },
        { As: 50, S: 50, O2: 0.0 },
        { As: 100, S: 100, O2: 1.0 },
      ];
      for (const opts of cases) {
        const f = new FluidChemistry(opts);
        const sum = arsenateAvailablePpm(f) + arseniteAvailablePpm(f);
        expect(sum, `sum != As for ${JSON.stringify(opts)}`)
          .toBeCloseTo(f.As, 6);
      }
    });

    it('Sulphur Bank fluid: arsenateAvailablePpm = 0, arseniteAvailablePpm = full As', () => {
      const f = new FluidChemistry({ As: 10, S: 400, O2: 0.4 });
      expect(arsenateAvailablePpm(f)).toBe(0);
      expect(arseniteAvailablePpm(f)).toBe(10);
    });

    it('Supergene oxidation fluid: arsenateAvailablePpm = full As, arseniteAvailablePpm = 0', () => {
      const f = new FluidChemistry({ As: 25, S: 0, O2: 1.5 });
      expect(arsenateAvailablePpm(f)).toBe(25);
      expect(arseniteAvailablePpm(f)).toBe(0);
    });

    it('Schneeberg pegmatite phase: arsenateAvailablePpm = 0, arseniteAvailablePpm = full As', () => {
      const f = new FluidChemistry({ As: 60, S: 30, O2: 0.0 });
      expect(arsenateAvailablePpm(f)).toBe(0);
      expect(arseniteAvailablePpm(f)).toBe(60);
    });

    it('Schneeberg late Cu+P phase: arsenateAvailablePpm = full As', () => {
      // Cu+P event raises O2 to 1.5, late-phase S has dropped below 50.
      const f = new FluidChemistry({ As: 30, S: 5, O2: 1.5 });
      expect(arsenateAvailablePpm(f)).toBe(30);
      expect(arseniteAvailablePpm(f)).toBe(0);
    });
  });

  describe('helper integration — arsenate engines block on As(III)-dominant fluids', () => {
    // Direct verification that the principled helper replaces the v88
    // band-aid: the pharmacolite engine no longer needs an explicit
    // `if (fluid.S > 50) return 0` because arsenateAvailablePpm
    // automatically returns 0 in sulfide-rich fluids.
    declare const VugConditions: any;
    it('sulphur-bank-style fluid gives pharmacolite σ = 0', () => {
      const fluid = new FluidChemistry({
        As: 10, Ca: 80, S: 400, O2: 0.4, pH: 5.8,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pharmacolite()).toBe(0);
    });

    it('schneeberg-late-style fluid gives pharmacolite σ > 0', () => {
      // S consumed by sulfides, O2 oxidizing, Ca + As both present.
      const fluid = new FluidChemistry({
        As: 30, Ca: 100, S: 5, Cu: 5, Co: 5, Ni: 5, O2: 1.5, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_pharmacolite()).toBeGreaterThan(0);
    });
  });

  describe('helper integration — arsenide engines block on As(V)-dominant fluids', () => {
    declare const VugConditions: any;
    it('supergene-oxidation-style fluid gives arsenopyrite σ = 0 (As is As(V))', () => {
      const fluid = new FluidChemistry({
        As: 25, Fe: 20, S: 10, O2: 1.5, pH: 5.0,
      });
      const cond = new VugConditions({ temperature: 100, fluid });
      // Arsenopyrite needs As(III), but As=25 in oxidizing fluid is all As(V)
      // → arseniteAvailablePpm = 0 → engine returns 0.
      expect(cond.supersaturation_arsenopyrite()).toBe(0);
    });

    it('sulphur-bank-style fluid gives realgar σ > 0 (As stays As(III))', () => {
      const fluid = new FluidChemistry({
        As: 10, S: 400, O2: 0.4, pH: 2.0,
      });
      const cond = new VugConditions({ temperature: 75, fluid });
      // Sulphur Bank fluid: As stays as As(III) thioarsenite → realgar fires.
      expect(cond.supersaturation_realgar()).toBeGreaterThan(0);
    });
  });
});
