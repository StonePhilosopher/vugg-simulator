// tests-js/smoke.test.ts — verify the harness wires up correctly.
// If these fail, no other test will run reliably either.

import { describe, expect, it } from 'vitest';
import { scenarioNames } from './helpers';

declare const SIM_VERSION: any;
declare const MODEL_DIGEST: any;
declare const MINERAL_SPEC: any;
declare const MINERAL_ENGINES: any;
declare const PARAMORPH_TRANSITIONS: any;
declare const DEHYDRATION_TRANSITIONS: any;
declare const LIGHT_TRANSITIONS: any;
declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const FluidChemistry: any;

describe('smoke — bundle loaded', () => {
  it('SIM_VERSION is a positive integer', () => {
    expect(typeof SIM_VERSION).toBe('number');
    expect(Number.isInteger(SIM_VERSION)).toBe(true);
    expect(SIM_VERSION).toBeGreaterThan(0);
  });

  it('scientific model identity is explicit and load-bearing', () => {
    expect(typeof MODEL_DIGEST).toBe('string');
    expect(MODEL_DIGEST).toContain('CaCO3:Hacker05');
    expect(MODEL_DIGEST).toContain('Prock:Pattison92');
    expect(MODEL_DIGEST).toContain('sphalerite-Ge:Belissont');
  });

  it('VugSimulator + FluidChemistry classes available', () => {
    expect(typeof VugSimulator).toBe('function');
    expect(typeof FluidChemistry).toBe('function');
  });

  it('MINERAL_SPEC has at least 80 minerals', () => {
    expect(MINERAL_SPEC).toBeTruthy();
    expect(typeof MINERAL_SPEC).toBe('object');
    const keys = Object.keys(MINERAL_SPEC);
    // Sanity floor — current shipping count is ~97; if this drops
    // below 80 something has gone catastrophically wrong with the
    // spec load (fetch mock broken, file moved, etc.).
    expect(keys.length).toBeGreaterThan(80);
  });

  it('every mineral in MINERAL_SPEC has a formation path (hard requirement)', () => {
    // A spec entry needs either a primary nucleation/growth engine or an
    // explicit transformation path. Transformation-only products such as
    // pararealgar and the meta-autunite trio must not receive fictional
    // primary engines merely to satisfy a registry-parity assertion. The
    // reverse direction (engines without spec) is a known longstanding
    // drift around the evaporite minerals (borax / halite / mirabilite
    // / thenardite / tincalconite have engines but no spec entry yet)
    // and is logged below as informational, not asserted.
    const specMinerals = new Set(Object.keys(MINERAL_SPEC));
    const engineMinerals = new Set(Object.keys(MINERAL_ENGINES));
    const transitionProducts = new Set<string>();
    for (const table of [PARAMORPH_TRANSITIONS, DEHYDRATION_TRANSITIONS, LIGHT_TRANSITIONS]) {
      for (const transition of Object.values(table || {}) as any[]) {
        if (Array.isArray(transition) && transition[0]) transitionProducts.add(transition[0]);
      }
    }
    const specsWithoutFormationPath: string[] = [];
    for (const m of specMinerals) {
      if (!engineMinerals.has(m) && !transitionProducts.has(m)) specsWithoutFormationPath.push(m);
    }
    expect(specsWithoutFormationPath.sort()).toEqual([]);
  });

  it('engines without spec entries — informational, listed for visibility', () => {
    const specMinerals = new Set(Object.keys(MINERAL_SPEC));
    const enginesWithoutSpec: string[] = [];
    for (const m of Object.keys(MINERAL_ENGINES)) {
      if (!specMinerals.has(m)) enginesWithoutSpec.push(m);
    }
    enginesWithoutSpec.sort();
    if (enginesWithoutSpec.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `[smoke] ${enginesWithoutSpec.length} engines lack a MINERAL_SPEC entry: ${enginesWithoutSpec.join(', ')} — these minerals run via the engine table but won't render in the library / collection UI until the spec lands.`,
      );
    }
    // Not asserted — drift is real and known. If a future cleanup
    // pass closes it, change this to expect([]) to lock the parity.
    expect(true).toBe(true);
  });

  it('SCENARIOS populated from data/scenarios.json5', () => {
    expect(SCENARIOS).toBeTruthy();
    const names = scenarioNames();
    // The shipping default is 20 scenarios; assert >= 10 so a single
    // entry rename or staging change doesn't immediately fail.
    expect(names.length).toBeGreaterThan(10);
    // A few canonical names must always be present.
    expect(names).toContain('cooling');
    expect(names).toContain('mvt');
    expect(names).toContain('porphyry');
  });
});
