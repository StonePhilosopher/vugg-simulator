// tests-js/recessive-floor-removal.test.ts — the Cu:Zn series pairs carry no
// recessive-side trace floor (recipe review R1, fix-ladder rung 1d).
//
// Round 9c (Apr 2026) gave adamite, descloizite and olivenite a 0.5 ppm floor
// on the MINOR cation "so the Cu:Zn ratio is meaningful". A crystal that
// carries trace Cu does not need 0.5 ppm Cu in its fluid, and each pair's
// cation-fraction selector already routes the series. mottramite's Zn floor
// went on 2026-06-16 (js/38 NOTE); rung 1d removed the other three.
//
// Each case pairs the pure end-member fluid (fires — it returned 0 while the
// floor stood) with controls that the dominant-side floor and the fraction
// selector still block.

import { describe, expect, it } from 'vitest';

declare const VugConditions: any;
declare const FluidChemistry: any;

const at30 = (fluid: Record<string, number>) =>
  new VugConditions({ temperature: 30, fluid: new FluidChemistry(fluid) });

describe('Cu:Zn series pairs — no recessive-side trace floor', () => {
  it('olivenite fires from a Zn-free fluid; its Cu floor and Cu fraction still gate', () => {
    expect(at30({ Cu: 400, Zn: 0, As: 25, O2: 1.5, pH: 6.5 }).supersaturation_olivenite()).toBeGreaterThan(0);
    expect(at30({ Cu: 40, Zn: 0, As: 25, O2: 1.5, pH: 6.5 }).supersaturation_olivenite()).toBe(0);    // Cu < 50
    expect(at30({ Cu: 60, Zn: 80, As: 25, O2: 1.5, pH: 6.5 }).supersaturation_olivenite()).toBe(0);   // Cu fraction < 0.5
  });

  it('adamite fires from a Cu-free fluid; its Zn floor and Zn fraction still gate', () => {
    expect(at30({ Zn: 200, Cu: 0, As: 25, O2: 1.5, pH: 6.5 }).supersaturation_adamite()).toBeGreaterThan(0);
    expect(at30({ Zn: 5, Cu: 0, As: 25, O2: 1.5, pH: 6.5 }).supersaturation_adamite()).toBe(0);       // Zn < 10
    expect(at30({ Zn: 50, Cu: 80, As: 25, O2: 1.5, pH: 6.5 }).supersaturation_adamite()).toBe(0);     // Zn fraction < 0.5
  });

  it('descloizite fires from a Cu-free fluid; its Zn floor and Zn fraction still gate', () => {
    expect(at30({ Pb: 90, Zn: 80, Cu: 0, V: 8, O2: 1.2, pH: 5.5 }).supersaturation_descloizite()).toBeGreaterThan(0);
    expect(at30({ Pb: 90, Zn: 40, Cu: 0, V: 8, O2: 1.2, pH: 5.5 }).supersaturation_descloizite()).toBe(0);   // Zn < 50
    expect(at30({ Pb: 90, Zn: 60, Cu: 80, V: 8, O2: 1.2, pH: 5.5 }).supersaturation_descloizite()).toBe(0);  // Zn fraction < 0.5
  });

  it('mottramite (the 2026-06-16 precedent) fires from a Zn-free fluid', () => {
    expect(at30({ Pb: 90, Cu: 80, Zn: 0, V: 8, O2: 1.2, pH: 5.5 }).supersaturation_mottramite()).toBeGreaterThan(0);
    expect(at30({ Pb: 90, Cu: 60, Zn: 80, V: 8, O2: 1.2, pH: 5.5 }).supersaturation_mottramite()).toBe(0);   // Cu fraction < 0.5
  });
});
