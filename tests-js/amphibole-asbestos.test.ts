// tests-js/amphibole-asbestos.test.ts — commercial asbestos quintet
// (tremolite + actinolite + anthophyllite + amosite + crocidolite) +
// tiger's eye chalcedony pseudomorph (v116, 2026-05-20).
//
// Closes the asbestiform-family gap the Jeffrey rodingite arc was
// missing. Five amphibole-asbestos minerals (new amphibole chemistry
// class) + tiger's eye (silicate-class, chalcedony pseudomorph after
// crocidolite).
//
// Refs: Hawthorne et al. 2012 Am.Min. 97:2031 (IMA amphibole
// nomenclature); WHO IARC Monograph 100C (2012); Frank et al. 2002
// (crocidolite carcinogenicity); Heaney & Fisher 2003 Am.Min. 88:1
// (tiger's eye mechanism).

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Tremolite Ca2Mg5Si8O22(OH)2 (v116)', () => {
  it('canonical Jeffrey skarn/rodingite broth fires', () => {
    const fluid = new FluidChemistry({ Ca: 200, Mg: 200, SiO2: 400, pH: 9.5 });
    const cond = new VugConditions({ temperature: 450, fluid });
    expect(cond.supersaturation_tremolite()).toBeGreaterThan(0);
  });

  it('Mg = 30 blocks — Mg-dominant calcic amphibole gate', () => {
    const fluid = new FluidChemistry({ Ca: 200, Mg: 30, SiO2: 400, pH: 9.5 });
    const cond = new VugConditions({ temperature: 450, fluid });
    expect(cond.supersaturation_tremolite()).toBe(0);
  });

  it('Fe = 100 blocks — routes toward actinolite', () => {
    const fluid = new FluidChemistry({ Ca: 200, Mg: 200, Fe: 100, SiO2: 400, pH: 9.5 });
    const cond = new VugConditions({ temperature: 450, fluid });
    expect(cond.supersaturation_tremolite()).toBe(0);
  });

  it('MINERAL_ENGINES.tremolite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.tremolite).toBe('function');
  });
});

describe('Actinolite Ca2(Mg,Fe)5Si8O22(OH)2 (v116)', () => {
  it('canonical greenschist broth fires', () => {
    const fluid = new FluidChemistry({ Ca: 180, Mg: 80, Fe: 50, SiO2: 400, pH: 8.5 });
    const cond = new VugConditions({ temperature: 400, fluid });
    expect(cond.supersaturation_actinolite()).toBeGreaterThan(0);
  });

  it('Fe = 0 blocks — Fe-bearing intermediate gate', () => {
    const fluid = new FluidChemistry({ Ca: 180, Mg: 80, Fe: 0, SiO2: 400, pH: 8.5 });
    const cond = new VugConditions({ temperature: 400, fluid });
    expect(cond.supersaturation_actinolite()).toBe(0);
  });

  it('Cr = 2 doesn\'t block — smaragdite dispatch (not a gate)', () => {
    const fluid = new FluidChemistry({ Ca: 180, Mg: 80, Fe: 50, SiO2: 400, pH: 8.5, Cr: 2 });
    const cond = new VugConditions({ temperature: 400, fluid });
    expect(cond.supersaturation_actinolite()).toBeGreaterThan(0);
  });

  it('MINERAL_ENGINES.actinolite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.actinolite).toBe('function');
  });
});

describe('Anthophyllite (Mg,Fe)7Si8O22(OH)2 (v116)', () => {
  it('canonical ultramafic broth fires', () => {
    const fluid = new FluidChemistry({ Mg: 250, Fe: 80, SiO2: 400, pH: 9.5, Ca: 0 });
    const cond = new VugConditions({ temperature: 450, fluid });
    expect(cond.supersaturation_anthophyllite()).toBeGreaterThan(0);
  });

  it('Ca = 100 blocks — calcic amphibole wins instead', () => {
    const fluid = new FluidChemistry({ Mg: 250, Fe: 80, SiO2: 400, pH: 9.5, Ca: 100 });
    const cond = new VugConditions({ temperature: 450, fluid });
    expect(cond.supersaturation_anthophyllite()).toBe(0);
  });

  it('MINERAL_ENGINES.anthophyllite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.anthophyllite).toBe('function');
  });
});

describe('Amosite Fe-cummingtonite-grunerite asbestos (v116)', () => {
  it('canonical Penge-SA BIF broth fires (Fe-dominant)', () => {
    const fluid = new FluidChemistry({ Fe: 200, Mg: 50, SiO2: 400, pH: 8.5, Ca: 0 });
    const cond = new VugConditions({ temperature: 400, fluid });
    expect(cond.supersaturation_amosite()).toBeGreaterThan(0);
  });

  it('Fe = 50 blocks — needs Fe-dominance (Fe >= 100)', () => {
    const fluid = new FluidChemistry({ Fe: 50, Mg: 30, SiO2: 400, pH: 8.5, Ca: 0 });
    const cond = new VugConditions({ temperature: 400, fluid });
    expect(cond.supersaturation_amosite()).toBe(0);
  });

  it('Mg >> Fe blocks — anthophyllite wins instead', () => {
    const fluid = new FluidChemistry({ Fe: 100, Mg: 200, SiO2: 400, pH: 8.5, Ca: 0 });
    const cond = new VugConditions({ temperature: 400, fluid });
    expect(cond.supersaturation_amosite()).toBe(0);
  });

  it('MINERAL_ENGINES.amosite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.amosite).toBe('function');
  });
});

describe('Crocidolite Na2Fe2+3Fe3+2Si8O22(OH)2 (v116)', () => {
  it('canonical Wittenoom BIF broth fires', () => {
    const fluid = new FluidChemistry({ Na: 80, Fe: 200, SiO2: 300, pH: 9.0, Ca: 0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_crocidolite()).toBeGreaterThan(0);
  });

  it('Na = 0 blocks — sodic amphibole diagnostic', () => {
    const fluid = new FluidChemistry({ Na: 0, Fe: 200, SiO2: 300, pH: 9.0, Ca: 0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_crocidolite()).toBe(0);
  });

  it('Ca = 100 blocks — calcic amphibole wins instead', () => {
    const fluid = new FluidChemistry({ Na: 80, Fe: 200, SiO2: 300, pH: 9.0, Ca: 100 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_crocidolite()).toBe(0);
  });

  it('MINERAL_ENGINES.crocidolite is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.crocidolite).toBe('function');
  });
});

describe('Tiger\'s eye — chalcedony pseudomorph after crocidolite (v116)', () => {
  it('canonical supergene oxidation broth fires', () => {
    // High SiO2 + Fe + STRICT oxidizing + surface T
    const fluid = new FluidChemistry({ SiO2: 400, Fe: 80, O2: 0.7, pH: 7.0 });
    const cond = new VugConditions({ temperature: 50, fluid });
    expect(cond.supersaturation_tigers_eye()).toBeGreaterThan(0);
  });

  it('O2 = 0.1 blocks — needs STRICT oxidizing (Fe2+ → Fe3+)', () => {
    const fluid = new FluidChemistry({ SiO2: 400, Fe: 80, O2: 0.1, pH: 7.0 });
    const cond = new VugConditions({ temperature: 50, fluid });
    expect(cond.supersaturation_tigers_eye()).toBe(0);
  });

  it('T = 300°C blocks — supergene surface only (< 200)', () => {
    const fluid = new FluidChemistry({ SiO2: 400, Fe: 80, O2: 0.7, pH: 7.0 });
    const cond = new VugConditions({ temperature: 300, fluid });
    expect(cond.supersaturation_tigers_eye()).toBe(0);
  });

  it('Fe = 10 blocks — needs Fe for chatoyant chromophore (Fe >= 30)', () => {
    const fluid = new FluidChemistry({ SiO2: 400, Fe: 10, O2: 0.7, pH: 7.0 });
    const cond = new VugConditions({ temperature: 50, fluid });
    expect(cond.supersaturation_tigers_eye()).toBe(0);
  });

  it('MINERAL_ENGINES.tigers_eye is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.tigers_eye).toBe('function');
  });
});
