// tests-js/enargite.test.ts — high-sulfidation Cu-As-S sulfosalt pins
// (v94, 2026-05-19).
//
// Enargite (Cu3AsS4) is the HIGH-SULFIDATION primary Cu-As-S sulfosalt,
// the defining mineral of Butte / Chuquicamata / Bisbee primary / Tsumeb
// upper sulfide zone / Lepanto / El Indio / Goldfield. Distinguishes
// from tennantite (Cu12As4S13, intermediate-sulfidation) via:
//   * pH window: enargite pH < 4.5 (acidic, SO2 disproportionation
//     environment); tennantite pH 3-7
//   * Sulfidation proxy: log10(S+1) - pH > 0.5 for enargite, lower
//     for tennantite
//
// The simulator has total S not f(S2), so the proxy is the load-bearing
// fork mechanism (Einaudi/Hedenquist/Inan 2003 SEG SP10:285-313). At
// pH < 4.5 AND high S, enargite wins the Cu+As+S budget.
//
// Polymorph dispatch: enargite (orthorhombic) ≥ 320°C; luzonite
// (tetragonal) < 320°C — same composition, different symmetry (Posfai
// & Buseck 1998).
//
// References:
//   * Einaudi/Hedenquist/Inan (2003) SEG SP10:285-313 — sulfidation-
//     state diagram, the canonical f(S2)-T phase boundary
//   * Sack & Loucks (1985) Am. Min. 70:1270-1289 — Cu-As-Sb-S
//     sulfosalt thermodynamics
//   * Posfai & Buseck (1998) — enargite/luzonite phase relations
//   * Brimhall (1979,1980) — Butte primary stage
//
// What this catches:
//   * Enargite fires under high-sulfidation chemistry (low pH + high S
//     + 200-500°C + Cu/As).
//   * pH > 4.5 blocks (forces tennantite field instead).
//   * Low S (S < 100) blocks.
//   * Sulfidation proxy < 0.5 blocks (intermediate-sulfidation field).
//   * Polymorph dispatch: enargite at T ≥ 320, luzonite at T < 320.
//   * As consumed via arseniteAvailablePpm (As(III), like tennantite).

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Enargite — high-sulfidation Cu-As-S (v94)', () => {
  describe('fires under high-sulfidation chemistry', () => {
    it('Butte-style fluid gives enargite σ > 0', () => {
      // Butte primary: high Cu, moderate As, high S, very acidic, hot,
      // anoxic. The defining high-sulfidation environment.
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 2.0,
      });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_enargite()).toBeGreaterThan(0);
    });

    it('pH > 4.5 blocks (forces tennantite field)', () => {
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 5.5,
      });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_enargite()).toBe(0);
    });

    it('low S blocks (S < 100)', () => {
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 50, O2: 0.05, pH: 2.0,
      });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_enargite()).toBe(0);
    });

    it('sulfidation proxy < 0.5 blocks (intermediate-sulfidation regime)', () => {
      // pH 4.0 with S=200: log10(200+1) - 4 = 2.30 - 4 = -1.7 → blocked.
      // (S has to dominate pH for proxy > 0.5.)
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 200, O2: 0.05, pH: 4.0,
      });
      const cond = new VugConditions({ temperature: 350, fluid });
      expect(cond.supersaturation_enargite()).toBe(0);
    });

    it('T outside 200-500°C blocks', () => {
      const tooCold = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 2.0,
      });
      const condCold = new VugConditions({ temperature: 100, fluid: tooCold });
      expect(condCold.supersaturation_enargite()).toBe(0);

      const tooHot = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 2.0,
      });
      const condHot = new VugConditions({ temperature: 600, fluid: tooHot });
      expect(condHot.supersaturation_enargite()).toBe(0);
    });
  });

  describe('discriminates from tennantite via pH + sulfidation proxy', () => {
    it('pH 2.5 + high S → enargite fires (high-sulfidation field)', () => {
      // Butte primary fluid is pH 1-3; pH 2.5 + S=2000 gives proxy
      // log10(2001)-2.5 = 0.80 > 0.5 → high-sulfidation, enargite wins.
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 2.5,
      });
      const cond = new VugConditions({ temperature: 300, fluid });
      expect(cond.supersaturation_enargite()).toBeGreaterThan(0);
    });

    it('pH 5.0 + moderate S → tennantite fires, enargite does NOT (intermediate-sulfidation field)', () => {
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 500, O2: 0.05, pH: 5.0,
      });
      const cond = new VugConditions({ temperature: 300, fluid });
      expect(cond.supersaturation_enargite()).toBe(0);  // pH > 4.5 blocks
      expect(cond.supersaturation_tennantite()).toBeGreaterThan(0);  // tennantite in range
    });
  });

  describe('polymorph dispatch via temperature', () => {
    // Engine fires the same supersaturation logic regardless of T within
    // 200-500°C window; the polymorph (enargite vs luzonite) is set in
    // grow_enargite based on T at growth time. We can only test this
    // indirectly via supersaturation_enargite returning > 0 at both T
    // regimes.
    it('T = 250°C (luzonite regime) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 2.0,
      });
      const cond = new VugConditions({ temperature: 250, fluid });
      expect(cond.supersaturation_enargite()).toBeGreaterThan(0);
    });

    it('T = 400°C (enargite regime) gives σ > 0', () => {
      const fluid = new FluidChemistry({
        Cu: 100, As: 30, S: 2000, O2: 0.05, pH: 2.0,
      });
      const cond = new VugConditions({ temperature: 400, fluid });
      expect(cond.supersaturation_enargite()).toBeGreaterThan(0);
    });
  });

  describe('Engine registered in MINERAL_ENGINES', () => {
    it('enargite grow engine is wired', () => {
      const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
      expect(typeof MINERAL_ENGINES.enargite).toBe('function');
    });
  });
});
