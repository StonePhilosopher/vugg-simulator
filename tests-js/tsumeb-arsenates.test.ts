// tests-js/tsumeb-arsenates.test.ts — Tsumeb 2nd-oxidation-zone
// arsenate suite pins (v97, 2026-05-19).
//
// Five supergene arsenates from Gebhard 1999 "Tsumeb: A Unique Mineral
// Locality" — the canonical Tsumeb monograph. All five fire from the
// same parent chemistry (oxidizing supergene at <50°C with As(V)),
// but pull apart on cation-ratio forks:
//
//   austinite     CaZn(AsO4)(OH)        Ca:Zn ~1:1, Cu < Zn, pH 6.5-8
//   legrandite    Zn2(AsO4)(OH)·H2O     Zn-rich, Ca-free, mildly acidic
//   koettigite    Zn3(AsO4)2·8H2O       Zn-majority, pH < 3, T < 35
//   duftite       PbCu(AsO4)(OH)        Pb:Cu ~1:1, pH 5.5-7.5
//   bayldonite    PbCu3(AsO4)2(OH)2     Pb:Cu ~1:3 (Cu-enriched)
//
// All use arsenateAvailablePpm (As(V)) + strongly oxidizing (O2 > 0.5).
// All gate via the cation-ratio fork — only one fires per chemistry
// slice. RNG-cascade guard via sigma < 1.0 early-out.
//
// References:
//   * Gebhard 1999 "Tsumeb: A Unique Mineral Locality"
//   * Keller 1977 MinRec 8(3); Wilson & Keller 2001 MinRec 32(3)
//   * Magalhães et al. 1988 arsenate solubility framework
//   * Anthony et al. Handbook of Mineralogy
//
// What this catches:
//   * All five engines exist and fire at appropriate conditions.
//   * Cation-ratio forks work (Cu vs Zn, Pb vs Cu, Zn-majority solid solution).
//   * Köttigite requires pH < 3; near-neutral Tsumeb first-zone fluid is blocked.
//   * Strict T cap on koettigite (8 H2O is fragile, T < 35).
//   * Oxidizing-only — all blocked under reducing conditions.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Tsumeb arsenate suite (v97)', () => {
  describe('Austinite — Ca-Zn arsenate', () => {
    it('Ca-Zn balanced fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Ca: 80, Zn: 60, As: 30, Cu: 5, Pb: 10, O2: 1.2, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_austinite()).toBeGreaterThan(0);
    });

    it('Cu-dominant fluid blocks (conichalcite wins instead)', () => {
      const fluid = new FluidChemistry({
        Ca: 80, Zn: 20, As: 30, Cu: 200, Pb: 10, O2: 1.2, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_austinite()).toBe(0);
    });

    it('High Pb blocks (duftite/bayldonite take precedence)', () => {
      const fluid = new FluidChemistry({
        Ca: 80, Zn: 60, As: 30, Cu: 5, Pb: 200, O2: 1.2, pH: 7.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_austinite()).toBe(0);
    });
  });

  describe('Legrandite — Zn-rich, Ca-free, acidic-tolerant', () => {
    it('Zn-rich Ca-free mildly acidic fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Zn: 200, As: 40, Ca: 5, Cu: 10, Pb: 5, O2: 1.2, pH: 5.5,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_legrandite()).toBeGreaterThan(0);
    });

    it('Ca > 20 blocks (austinite competes for Zn+As)', () => {
      const fluid = new FluidChemistry({
        Zn: 200, As: 40, Ca: 100, Cu: 10, Pb: 5, O2: 1.2, pH: 5.5,
      });
      const cond = new VugConditions({ temperature: 25, fluid });
      expect(cond.supersaturation_legrandite()).toBe(0);
    });
  });

  describe('Koettigite — acidic vivianite-group Zn end, sharp T cap', () => {
    it('Zn-rich cool acidic fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Zn: 100, As: 30, Co: 0, Ni: 0, O2: 1.0, pH: 2.5,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_koettigite()).toBeGreaterThan(0);
    });

    it('substantial Co substitution and type-material-scale Ni remain compatible with the Zn end member', () => {
      const fluid = new FluidChemistry({
        Zn: 100, As: 30, Co: 20, Ni: 4, O2: 1.0, pH: 2.5,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_koettigite()).toBeGreaterThan(0);
    });

    it('molar Co majority blocks the Zn end member even when ppm masses look close', () => {
      const fluid = new FluidChemistry({
        Zn: 65.38, As: 30, Co: 64.83, Ni: 0, O2: 1.0, pH: 2.5,
      });
      const cond = new VugConditions({ temperature: 20, fluid });
      expect(cond.supersaturation_koettigite()).toBe(0);
    });

    it('allows Ni at the bounded-proxy 5 mol% boundary but blocks higher Ni', () => {
      const atBoundary = new FluidChemistry({
        Zn: 65.38, As: 30, Co: 58.933 * 0.8,
        Ni: 58.693 * (1.8 / 19), O2: 1.0, pH: 2.5,
      });
      const aboveBoundary = new FluidChemistry({
        Zn: 65.38, As: 30, Co: 58.933 * 0.8,
        Ni: 58.693 * 0.1, O2: 1.0, pH: 2.5,
      });
      expect(new VugConditions({ temperature: 20, fluid: atBoundary })
        .supersaturation_koettigite()).toBeGreaterThan(0);
      expect(new VugConditions({ temperature: 20, fluid: aboveBoundary })
        .supersaturation_koettigite()).toBe(0);
    });

    it('pH 3 and near-neutral fluid are outside the documented stability field', () => {
      for (const pH of [3.0, 7.0]) {
        const fluid = new FluidChemistry({
          Zn: 100, As: 30, Co: 0, Ni: 0, O2: 1.0, pH,
        });
        const cond = new VugConditions({ temperature: 20, fluid });
        expect(cond.supersaturation_koettigite(), `pH ${pH}`).toBe(0);
      }
    });

    it('T > 35 blocks (8 H2O dehydrates)', () => {
      const fluid = new FluidChemistry({
        Zn: 100, As: 30, Co: 0, Ni: 0, O2: 1.0, pH: 2.5,
      });
      const cond = new VugConditions({ temperature: 50, fluid });
      expect(cond.supersaturation_koettigite()).toBe(0);
    });
  });

  describe('Duftite — Pb:Cu ~1:1', () => {
    it('Pb:Cu balanced fluid gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 80, As: 20, O2: 1.2, pH: 6.8,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_duftite()).toBeGreaterThan(0);
    });

    it('Cu:Pb > 2 blocks (bayldonite wins)', () => {
      const fluid = new FluidChemistry({
        Pb: 50, Cu: 250, As: 20, O2: 1.2, pH: 6.8,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_duftite()).toBe(0);
    });

    it('V > As blocks (mottramite wins, V-vs-As fork)', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 80, As: 10, V: 50, O2: 1.2, pH: 6.8,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_duftite()).toBe(0);
    });
  });

  describe('Bayldonite — Pb:Cu ~1:3 (Cu-enriched)', () => {
    it('Cu-enriched fluid (Cu:Pb > 2) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Pb: 40, Cu: 200, As: 25, O2: 1.2, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_bayldonite()).toBeGreaterThan(0);
    });

    it('Cu:Pb < 2 blocks (duftite wins)', () => {
      const fluid = new FluidChemistry({
        Pb: 100, Cu: 80, As: 25, O2: 1.2, pH: 6.0,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_bayldonite()).toBe(0);
    });
  });

  describe('All five blocked under reducing conditions (O2 < 0.5)', () => {
    it('Reducing fluid blocks all five Tsumeb arsenates', () => {
      const fluid = new FluidChemistry({
        Ca: 100, Zn: 200, Cu: 100, Pb: 100, Co: 0, Ni: 0,
        As: 50, V: 0, O2: 0.1, pH: 6.5,
      });
      const cond = new VugConditions({ temperature: 30, fluid });
      expect(cond.supersaturation_austinite()).toBe(0);
      expect(cond.supersaturation_legrandite()).toBe(0);
      expect(cond.supersaturation_koettigite()).toBe(0);
      expect(cond.supersaturation_duftite()).toBe(0);
      expect(cond.supersaturation_bayldonite()).toBe(0);
    });
  });

  describe('Engines registered in MINERAL_ENGINES', () => {
    it('all five Tsumeb arsenate engines wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.austinite).toBe('function');
      expect(typeof MINERAL_ENGINES.legrandite).toBe('function');
      expect(typeof MINERAL_ENGINES.koettigite).toBe('function');
      expect(typeof MINERAL_ENGINES.duftite).toBe('function');
      expect(typeof MINERAL_ENGINES.bayldonite).toBe('function');
    });
  });
});
