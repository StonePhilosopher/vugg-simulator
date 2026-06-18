// tests-js/zeolite-pair.test.ts — stilbite + heulandite, the Deccan Stage-II
// zeolite couple (v200, 2026-06-17).
//
// These two zeolites fill the deccan_zeolite Stage-II narrative gap: the
// step-70 event narrated "Stilbite + heulandite + calcite blades" that could
// not grow (PROPOSALS-LEDGER §A #14 / §G). They are the stilbite/heulandite
// dehydration couple — Ca-stilbite = Ca-heulandite + H2O (Kiseleva, Navrotsky,
// Belitsky & Fursenko 2001, Am. Mineral. 86:448). Stilbite is the COOLER, more-hydrated
// member (28 H2O, moderate silica, T sweet 60-110°C); heulandite the WARMER
// dehydration product (6 H2O, higher silica activity, T sweet 120-180°C).
//
// The engine discriminates on TWO axes: temperature window + silica activity.
// Both are Ca-dominant (the engine uses Ca+Na as the exchangeable budget),
// alkaline (pH 7-10.5), and redox-insensitive (no redox gate — framework
// silicates with no redox-active ion).
//
// What these tests catch:
//   - the essential-cation / Al / silica gates
//   - the T-window split (the core stilbite-vs-heulandite discriminator)
//   - the silica-activity split (heulandite needs higher SiO2)
//   - the alkaline-pH gate
//   - both grow engines wired in MINERAL_ENGINES

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

// A Deccan Stage-II-like alkaline, Ca-dominant, silica-rich fluid.
function deccanFluid(overrides: any = {}) {
  return new FluidChemistry({
    Ca: 260, Na: 40, Al: 15, SiO2: 800, pH: 8.5, CO3: 80, ...overrides,
  });
}

describe('Stilbite — cooler Deccan zeolite (v200)', () => {
  describe('gates', () => {
    it('fires in the cool Deccan window (T=90)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: deccanFluid() });
      expect(cond.supersaturation_stilbite()).toBeGreaterThan(0);
    });

    it('Ca-poor fluid blocks (essential exchangeable cation)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: deccanFluid({ Ca: 20, Na: 0 }) });
      expect(cond.supersaturation_stilbite()).toBe(0);
    });

    it('Al-poor fluid blocks (framework Al)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: deccanFluid({ Al: 1 }) });
      expect(cond.supersaturation_stilbite()).toBe(0);
    });

    it('acidic fluid blocks (needs alkaline)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: deccanFluid({ pH: 5.5 }) });
      expect(cond.supersaturation_stilbite()).toBe(0);
    });

    it('too hot blocks (above the cool member window, T=200)', () => {
      const cond = new VugConditions({ temperature: 200, fluid: deccanFluid() });
      expect(cond.supersaturation_stilbite()).toBe(0);
    });

    it('fires on moderate silica (SiO2=300, below heulandite gate)', () => {
      const cond = new VugConditions({ temperature: 90, fluid: deccanFluid({ SiO2: 300 }) });
      expect(cond.supersaturation_stilbite()).toBeGreaterThan(0);
    });
  });
});

describe('Heulandite — warmer Deccan zeolite (v200)', () => {
  describe('gates', () => {
    it('fires in the warm Deccan window (T=150)', () => {
      const cond = new VugConditions({ temperature: 150, fluid: deccanFluid() });
      expect(cond.supersaturation_heulandite()).toBeGreaterThan(0);
    });

    it('too cold blocks (below the warm member window, T=80)', () => {
      const cond = new VugConditions({ temperature: 80, fluid: deccanFluid() });
      expect(cond.supersaturation_heulandite()).toBe(0);
    });

    it('low-silica fluid blocks (needs higher silica activity than stilbite)', () => {
      // SiO2=300 clears stilbite's 250 gate but not heulandite's 400 gate.
      const cond = new VugConditions({ temperature: 150, fluid: deccanFluid({ SiO2: 300 }) });
      expect(cond.supersaturation_heulandite()).toBe(0);
    });

    it('acidic fluid blocks', () => {
      const cond = new VugConditions({ temperature: 150, fluid: deccanFluid({ pH: 5.5 }) });
      expect(cond.supersaturation_heulandite()).toBe(0);
    });
  });
});

describe('Stilbite vs heulandite — the T-window discriminator', () => {
  it('at the cool end (T=80) stilbite fires, heulandite does not', () => {
    const cond = new VugConditions({ temperature: 80, fluid: deccanFluid() });
    expect(cond.supersaturation_stilbite()).toBeGreaterThan(0);
    expect(cond.supersaturation_heulandite()).toBe(0);
  });

  it('at the warm end (T=170) heulandite fires; stilbite has cut off above 150', () => {
    const cond = new VugConditions({ temperature: 170, fluid: deccanFluid() });
    expect(cond.supersaturation_heulandite()).toBeGreaterThan(0);
    expect(cond.supersaturation_stilbite()).toBe(0);
  });

  it('in the overlap (T=130) both are viable but stilbite is past its sweet spot', () => {
    const cond = new VugConditions({ temperature: 130, fluid: deccanFluid() });
    const s = cond.supersaturation_stilbite();
    const h = cond.supersaturation_heulandite();
    expect(s).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
    // heulandite is in its sweet spot at 130; stilbite is attenuated past 110
    expect(h).toBeGreaterThan(s);
  });
});

describe('Engines registered in MINERAL_ENGINES', () => {
  it('stilbite grow engine is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.stilbite).toBe('function');
  });
  it('heulandite grow engine is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.heulandite).toBe('function');
  });
});
