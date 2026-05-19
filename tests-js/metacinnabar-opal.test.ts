// tests-js/metacinnabar-opal.test.ts — Sulphur Bank-style hot-spring
// minerals (v101, 2026-05-19).
//
// Two minerals from the boss's Sulphur Bank research gap:
//   metacinnabar β-HgS  — black cubic polymorph of cinnabar
//   opal SiO2·nH2O      — amorphous silica mineraloid, hot-spring sinter
//
// References:
//   * Potter & Barnes (1978) Econ. Geol. 73:282 — HgS polymorphism
//   * White & Roberson (1962) GSA SP 73 — Sulphur Bank
//   * Jones & Segnit (1971) J. Geol. Soc. Aust. 18:57 — opal A/CT/C
//   * Fournier (1977) Geothermics 5:41 — silica solubility

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

describe('Metacinnabar β-HgS — black cubic polymorph (v101)', () => {
  it('Sulphur Bank-style Hg + S acidic-sulfide low-T fluid gives σ > 0', () => {
    const fluid = new FluidChemistry({
      Hg: 5, S: 200, O2: 0.2, pH: 3.5,
    });
    const cond = new VugConditions({ temperature: 75, fluid });
    expect(cond.supersaturation_metacinnabar()).toBeGreaterThan(0);
  });

  it('T > 200 blocks (cinnabar is the high-T polymorph)', () => {
    const fluid = new FluidChemistry({
      Hg: 5, S: 200, O2: 0.2, pH: 3.5,
    });
    const cond = new VugConditions({ temperature: 250, fluid });
    expect(cond.supersaturation_metacinnabar()).toBe(0);
  });

  it('O2 > 0.8 blocks (metacinnabar is the more O₂-reactive polymorph)', () => {
    const fluid = new FluidChemistry({
      Hg: 5, S: 200, O2: 1.2, pH: 3.5,
    });
    const cond = new VugConditions({ temperature: 75, fluid });
    expect(cond.supersaturation_metacinnabar()).toBe(0);
  });

  it('Alkaline pH > 6.5 blocks (Hg(HS)2 complexes keep Hg mobile)', () => {
    const fluid = new FluidChemistry({
      Hg: 5, S: 200, O2: 0.2, pH: 8.0,
    });
    const cond = new VugConditions({ temperature: 75, fluid });
    expect(cond.supersaturation_metacinnabar()).toBe(0);
  });
});

describe('Opal SiO2·nH2O — hot-spring sinter mineraloid (v101)', () => {
  it('Hot-spring sinter style (T 60, SiO2 350, alkaline) gives σ > 0', () => {
    const fluid = new FluidChemistry({
      SiO2: 350, O2: 0.5, pH: 8.0,
    });
    const cond = new VugConditions({ temperature: 60, fluid });
    expect(cond.supersaturation_opal()).toBeGreaterThan(0);
  });

  it('Low SiO2 (< 200) blocks (below amorphous silica saturation per Fournier 1977)', () => {
    const fluid = new FluidChemistry({
      SiO2: 150, O2: 0.5, pH: 8.0,
    });
    const cond = new VugConditions({ temperature: 60, fluid });
    expect(cond.supersaturation_opal()).toBe(0);
  });

  it('T > 100 blocks (opal recrystallizes to chalcedony/quartz)', () => {
    const fluid = new FluidChemistry({
      SiO2: 350, O2: 0.5, pH: 8.0,
    });
    const cond = new VugConditions({ temperature: 150, fluid });
    expect(cond.supersaturation_opal()).toBe(0);
  });

  it('Acidic pH < 6.5 blocks (silica stays dissolved at low pH)', () => {
    const fluid = new FluidChemistry({
      SiO2: 350, O2: 0.5, pH: 4.5,
    });
    const cond = new VugConditions({ temperature: 60, fluid });
    expect(cond.supersaturation_opal()).toBe(0);
  });

  it('Very high pH > 10 blocks (silica solubility rises sharply, stays dissolved as H3SiO4⁻)', () => {
    const fluid = new FluidChemistry({
      SiO2: 350, O2: 0.5, pH: 11.0,
    });
    const cond = new VugConditions({ temperature: 60, fluid });
    expect(cond.supersaturation_opal()).toBe(0);
  });

  it('Redox-tolerant — both reducing and oxidizing fluids fire opal', () => {
    const fluidRed = new FluidChemistry({
      SiO2: 350, O2: 0.05, pH: 8.0,
    });
    const fluidOx = new FluidChemistry({
      SiO2: 350, O2: 1.5, pH: 8.0,
    });
    const condRed = new VugConditions({ temperature: 60, fluid: fluidRed });
    const condOx = new VugConditions({ temperature: 60, fluid: fluidOx });
    expect(condRed.supersaturation_opal()).toBeGreaterThan(0);
    expect(condOx.supersaturation_opal()).toBeGreaterThan(0);
  });
});

describe('Engines registered in MINERAL_ENGINES', () => {
  it('metacinnabar + opal grow engines are wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.metacinnabar).toBe('function');
    expect(typeof MINERAL_ENGINES.opal).toBe('function');
  });
});
