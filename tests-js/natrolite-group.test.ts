// tests-js/natrolite-group.test.ts — scolecite + mesolite, the fibrous
// natrolite-group zeolites (v201, 2026-06-17).
//
// The companion pair to v200's stilbite/heulandite: the LOW-Si fibrous Ca-(Na)
// zeolites that form earlier in the Deccan amygdule paragenesis. They close the
// PROPOSALS-LEDGER §G fibrous-zeolite gap (the deccan step-70 text named them as
// unmodelled).
//
// The core mechanic is the Na/Ca FORK of the natrolite Na<->Ca coupled-
// substitution series:
//   - scolecite = Ca ENDMEMBER  → fires when Na/(Na+Ca) <= 0.5
//   - mesolite  = ordered Na-Ca intermediate → fires only in the MIXED band
//                 0.2 <= Na/(Na+Ca) <= 0.8, and needs BOTH Na and Ca present
//   - natrolite = Na endmember (not wired)
//
// Both are low-Si (floor 150, below stilbite's 250), alkaline, redox-insensitive.
//
// What these tests catch:
//   - the essential-cation / Al / silica gates
//   - the Na/Ca fork (the core scolecite-vs-mesolite discriminator)
//   - mesolite's both-cations requirement (Na-only or Ca-only must NOT fire it)
//   - the low silica floor (fires below stilbite's 250)
//   - both grow engines wired in MINERAL_ENGINES

import { describe, expect, it } from 'vitest';

declare const FluidChemistry: any;
declare const VugConditions: any;

// A Deccan-like alkaline, Ca-rich, silica-bearing fluid; Na is the fork knob.
function zeoFluid(overrides: any = {}) {
  return new FluidChemistry({
    Ca: 200, Na: 0, Al: 15, SiO2: 400, pH: 8.5, CO3: 80, ...overrides,
  });
}

describe('Scolecite — Ca-endmember fibrous zeolite (v201)', () => {
  it('fires in Ca-dominant alkaline fluid (Na low)', () => {
    const cond = new VugConditions({ temperature: 95, fluid: zeoFluid({ Na: 20 }) });
    expect(cond.supersaturation_scolecite()).toBeGreaterThan(0);
  });

  it('Ca-poor fluid blocks', () => {
    const cond = new VugConditions({ temperature: 95, fluid: zeoFluid({ Ca: 20, Na: 0 }) });
    expect(cond.supersaturation_scolecite()).toBe(0);
  });

  it('Na-dominant fluid blocks (Na/(Na+Ca) > 0.5 → mesolite/natrolite territory)', () => {
    const cond = new VugConditions({ temperature: 95, fluid: zeoFluid({ Ca: 100, Na: 200 }) });
    expect(cond.supersaturation_scolecite()).toBe(0);
  });

  it('acidic fluid blocks', () => {
    const cond = new VugConditions({ temperature: 95, fluid: zeoFluid({ Na: 20, pH: 5.5 }) });
    expect(cond.supersaturation_scolecite()).toBe(0);
  });

  it('fires at low silica (SiO2=200, the low-Si floor — below stilbite gate)', () => {
    const cond = new VugConditions({ temperature: 95, fluid: zeoFluid({ Na: 20, SiO2: 200 }) });
    expect(cond.supersaturation_scolecite()).toBeGreaterThan(0);
  });
});

describe('Mesolite — ordered Na-Ca intermediate (v201)', () => {
  it('fires in the mixed Na-Ca band (Na/(Na+Ca) ~0.4)', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 150, Na: 100 }) });
    expect(cond.supersaturation_mesolite()).toBeGreaterThan(0);
  });

  it('Na-only fluid blocks (needs Ca too)', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 0, Na: 200 }) });
    expect(cond.supersaturation_mesolite()).toBe(0);
  });

  it('Ca-only fluid blocks (needs Na too)', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 200, Na: 0 }) });
    expect(cond.supersaturation_mesolite()).toBe(0);
  });

  it('Ca-dominant (Na/(Na+Ca) < 0.2) blocks → scolecite territory', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 300, Na: 40 }) });
    expect(cond.supersaturation_mesolite()).toBe(0);
  });
});

describe('Natrolite-group Na/Ca fork — the discriminator', () => {
  it('Ca-dominant (ratio 0.13): scolecite fires, mesolite does not', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 200, Na: 30 }) });
    expect(cond.supersaturation_scolecite()).toBeGreaterThan(0);
    expect(cond.supersaturation_mesolite()).toBe(0);
  });

  it('mixed (ratio ~0.4): BOTH fire (they co-deposit)', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 150, Na: 100 }) });
    expect(cond.supersaturation_scolecite()).toBeGreaterThan(0);
    expect(cond.supersaturation_mesolite()).toBeGreaterThan(0);
  });

  it('Na-dominant (ratio 0.67): mesolite fires, scolecite does not', () => {
    const cond = new VugConditions({ temperature: 90, fluid: zeoFluid({ Ca: 100, Na: 200 }) });
    expect(cond.supersaturation_mesolite()).toBeGreaterThan(0);
    expect(cond.supersaturation_scolecite()).toBe(0);
  });
});

describe('Engines registered in MINERAL_ENGINES', () => {
  it('scolecite grow engine is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.scolecite).toBe('function');
  });
  it('mesolite grow engine is wired', () => {
    const MINERAL_ENGINES = (globalThis as any).MINERAL_ENGINES;
    expect(typeof MINERAL_ENGINES.mesolite).toBe('function');
  });
});
