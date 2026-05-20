// tests-js/chrysotile-brucite-awaruite.test.ts — Mg-matrix family (v114).
//
// Fifth commit of the Jeffrey Mine rodingite arc. Three serpentinization-
// driven minerals across three chemistry classes:
//
//   Chrysotile Mg3Si2O5(OH)4 (silicate) — fibrous serpentine asbestos;
//     Jeffrey Mine host matrix. THE asbestos of commerce.
//
//   Brucite Mg(OH)2 (oxide/hydroxide) — serpentinization byproduct;
//     hyperalkaline pH only.
//
//   Awaruite (Ni,Fe) (native) — Ni-Fe alloy; serpentinization metal
//     droplets. Type locality Awaroa NZ 1885; STRICT reducing + low-S
//     + alkaline gate.
//
// Refs: Anthony Handbook v.I + v.IIA + v.III; Wicks & Plant 1979 Can.Min.
// 17:785; O'Hanley 1996; Schramke et al. 1982 GCA 46:1581; Bird & Bassett
// 1980 GCA 44:1659; Frost 1985 Contrib.Min.Petr. 91:139.

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Chrysotile Mg3Si2O5(OH)4 (v114)', () => {
  it('canonical Jeffrey serpentinization broth fires (fibrous habit)', () => {
    const fluid = new FluidChemistry({ Mg: 300, SiO2: 200, pH: 11.0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_chrysotile()).toBeGreaterThan(0);
  });

  it('Mg = 50 blocks — below 100 threshold', () => {
    const fluid = new FluidChemistry({ Mg: 50, SiO2: 200, pH: 11.0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_chrysotile()).toBe(0);
  });

  it('pH = 7 blocks — alkaline-only (pH >= 8.5)', () => {
    const fluid = new FluidChemistry({ Mg: 300, SiO2: 200, pH: 7.0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_chrysotile()).toBe(0);
  });

  it('T = 600°C blocks — above 500 (forsterite + talc breakdown)', () => {
    const fluid = new FluidChemistry({ Mg: 300, SiO2: 200, pH: 11.0 });
    const cond = new VugConditions({ temperature: 600, fluid });
    expect(cond.supersaturation_chrysotile()).toBe(0);
  });

  it('Ca = 250 marginally suppresses (Ca-Mg-Si → diopside wins)', () => {
    const fluid_lowCa = new FluidChemistry({ Mg: 300, SiO2: 200, pH: 11.0, Ca: 0 });
    const fluid_highCa = new FluidChemistry({ Mg: 300, SiO2: 200, pH: 11.0, Ca: 250 });
    const cond_low = new VugConditions({ temperature: 300, fluid: fluid_lowCa });
    const cond_high = new VugConditions({ temperature: 300, fluid: fluid_highCa });
    expect(cond_high.supersaturation_chrysotile()).toBeLessThan(cond_low.supersaturation_chrysotile());
  });

  it('MINERAL_ENGINES.chrysotile is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.chrysotile).toBe('function');
  });
});

describe('Brucite Mg(OH)2 (v114)', () => {
  it('canonical Jeffrey serpentinization broth fires (tabular hexagonal)', () => {
    // FluidChemistry CO3 default is 150 ppm; brucite carbonatizes
    // above CO3 = 50, so explicit CO3 = 0 (serpentinization fluid is
    // typically CO2-poor since carbon is locked in carbonates outside
    // the ultramafic).
    const fluid = new FluidChemistry({ Mg: 300, pH: 11.5, CO3: 0 });
    const cond = new VugConditions({ temperature: 200, fluid });
    expect(cond.supersaturation_brucite()).toBeGreaterThan(0);
  });

  it('pH = 9.0 blocks — strict hyperalkaline (pH >= 9.5)', () => {
    const fluid = new FluidChemistry({ Mg: 300, pH: 9.0, CO3: 0 });
    const cond = new VugConditions({ temperature: 200, fluid });
    expect(cond.supersaturation_brucite()).toBe(0);
  });

  it('CO3 = 100 blocks — carbonatization gate (brucite + CO2 → magnesite)', () => {
    const fluid = new FluidChemistry({ Mg: 300, pH: 11.5, CO3: 100 });
    const cond = new VugConditions({ temperature: 200, fluid });
    expect(cond.supersaturation_brucite()).toBe(0);
  });

  it('T = 500°C blocks — above 450 ceiling', () => {
    const fluid = new FluidChemistry({ Mg: 300, pH: 11.5, CO3: 0 });
    const cond = new VugConditions({ temperature: 500, fluid });
    expect(cond.supersaturation_brucite()).toBe(0);
  });

  it('MINERAL_ENGINES.brucite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.brucite).toBe('function');
  });
});

describe('Awaruite (Ni,Fe) (v114)', () => {
  it('canonical Jeffrey serpentinization broth fires', () => {
    // STRICT: reducing (O2 < 0.3) + alkaline + low-S + Ni + Fe
    const fluid = new FluidChemistry({ Ni: 100, Fe: 40, pH: 11.0, S: 0, O2: 0.1 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_awaruite()).toBeGreaterThan(0);
  });

  it('Ni = 30 blocks — below 50 threshold', () => {
    const fluid = new FluidChemistry({ Ni: 30, Fe: 40, pH: 11.0, S: 0, O2: 0.1 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_awaruite()).toBe(0);
  });

  it('S = 20 blocks — sulfides win Ni when S > 5', () => {
    const fluid = new FluidChemistry({ Ni: 100, Fe: 40, pH: 11.0, S: 20, O2: 0.1 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_awaruite()).toBe(0);
  });

  it('O2 = 1.0 blocks — needs STRICT reducing', () => {
    const fluid = new FluidChemistry({ Ni: 100, Fe: 40, pH: 11.0, S: 0, O2: 1.0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_awaruite()).toBe(0);
  });

  it('pH = 7 blocks — alkaline-only', () => {
    const fluid = new FluidChemistry({ Ni: 100, Fe: 40, pH: 7.0, S: 0, O2: 0.1 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_awaruite()).toBe(0);
  });

  it('MINERAL_ENGINES.awaruite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.awaruite).toBe('function');
  });
});
