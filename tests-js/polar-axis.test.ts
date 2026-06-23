// tests-js/polar-axis.test.ts — INTRINSIC crystallographic polarity, central-distance arc
// Phase 3 (2026-06-22; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md).
//
// The 10 polar point groups have a unique polar axis with structurally inequivalent +c/-c
// ends, so a polar crystal terminates differently top vs bottom — INTRINSIC (always present,
// not scenario-opt-in). js/45 classifyPolarAxis tags the four audited polar tenants
// (tourmaline 3m, hemimorphite mm2, wurtzite & greenockite 6mm) with crystal._polarAxis; the
// renderer (js/99i _makeHemimorphicPrism) draws a dominant +c pyramid / flat -c pinacoid —
// which also FIXES the greenockite 'hexagonal_pyramidal' token wart (it had fallen to a
// generic hex prism). PURE tagging (no rng/fluid) → byte-identical baseline (cold-ci's
// calibration test is the hard gate). Pins: the polar tenants get tagged with the right
// point group; non-polar minerals never do; quartz (class 32, enantiomorphic) is excluded.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function run(scenarioName: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

const POLAR_PG: Record<string, string> = { tourmaline: '3m', hemimorphite: 'mm2', wurtzite: '6mm', greenockite: '6mm' };

describe('intrinsic polar-axis tag (central-distance arc Phase 3)', () => {
  it('tags greenockite + wurtzite in mvt with the correct point group; non-polar minerals untagged', () => {
    const sim = run('mvt');
    expect(sim).toBeTruthy();
    const polar = sim.crystals.filter((c: any) => POLAR_PG[c.mineral]);
    expect(polar.length).toBeGreaterThan(0);           // mvt grows greenockite + wurtzite
    for (const c of polar) {
      expect(c._polarAxis).toBeTruthy();
      expect(c._polarAxis.pointGroup).toBe(POLAR_PG[c.mineral]);
    }
    // a NON-polar mineral that grows here (sphalerite/galena/calcite) is never tagged
    const nonPolar = sim.crystals.filter((c: any) => !POLAR_PG[c.mineral]);
    expect(nonPolar.length).toBeGreaterThan(0);
    for (const c of nonPolar) expect(c._polarAxis).toBeUndefined();
  });

  it('tags tourmaline (3m) in a pegmatite — the iconic polar mineral', () => {
    const sim = run('gem_pegmatite');
    expect(sim).toBeTruthy();
    const tur = sim.crystals.filter((c: any) => c.mineral === 'tourmaline');
    expect(tur.length).toBeGreaterThan(0);
    for (const c of tur) {
      expect(c._polarAxis).toBeTruthy();
      expect(c._polarAxis.pointGroup).toBe('3m');
    }
  });

  it('quartz is NOT tagged polar (class 32, enantiomorphic — the audit excluded it)', () => {
    const sim = run('grimsel_alpine_cleft');                 // a quartz-rich scenario
    expect(sim).toBeTruthy();
    const qz = sim.crystals.filter((c: any) => c.mineral === 'quartz');
    for (const c of qz) expect(c._polarAxis).toBeUndefined();
  });
});
