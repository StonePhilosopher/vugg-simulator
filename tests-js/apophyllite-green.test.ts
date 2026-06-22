// tests-js/apophyllite-green.test.ts — the green Poona apophyllite V⁴⁺ colour
// variety + termination colour-zoning render (crystal-face realism arc 2026-06-21).
//
// Apophyllite was already in the catalogue; this adds its prized Pune/Poona GREEN.
// The green is a V⁴⁺ chromophore (Rossman 1974) — DICHROIC + growth/colour-zoned
// toward the {101} pyramidal terminations, NOT a Dowty protosite sector partition.
// grow_apophyllite (js/59) reads fluid.V > 0.5 as a COLOUR DISPATCHER (never a gate),
// setting crystal._apophylliteGreen; classifySectorZoning (js/45) then tags it
// _sectorZoned kind 'apophyllite_green'; js/99i _makeApophyllitePrism renders it.
//
// deccan_zeolite carries V=3 (basalt-weathering groundwater). The colour dispatch
// must be ASSEMBLAGE-NEUTRAL: deccan has no Pb/Cu/U, so no V-mineral can fire — the V
// only paints apophyllite green.
//
// Pins: apophyllite fires + grows in deccan; it is tagged green (flag + sector kind);
// the V trace fires NO V-mineral (colour-only, not a new species); a V-free scenario
// carries no apophyllite_green tag (the colour dispatch is conditional on V).

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

describe('green Poona apophyllite (V⁴⁺ colour-zoning)', () => {
  it('apophyllite fires in deccan_zeolite and grows a real body', () => {
    const sim = run('deccan_zeolite', 42);
    expect(sim).toBeTruthy();
    const apo = sim.crystals.filter((c: any) => c.mineral === 'apophyllite' && !c.dissolved);
    expect(apo.length).toBeGreaterThan(0);
    expect(Math.max(...apo.map((c: any) => c.total_growth_um))).toBeGreaterThan(50);
  });

  it('the V⁴⁺ trace paints apophyllite green and tags the termination-colour render', () => {
    const sim = run('deccan_zeolite', 42);
    expect(sim.conditions.fluid.V).toBeGreaterThan(0.5);
    const apo = sim.crystals.filter((c: any) => c.mineral === 'apophyllite' && !c.dissolved);
    const green = apo.filter((c: any) => c._apophylliteGreen);
    expect(green.length).toBeGreaterThan(0);
    const tagged = apo.filter((c: any) => c._sectorZoned && c._sectorZoned.kind === 'apophyllite_green');
    expect(tagged.length).toBeGreaterThan(0);
  });

  it('the V trace is colour-only — no V-mineral nucleates in deccan (assemblage unchanged)', () => {
    const sim = run('deccan_zeolite', 42);
    const vMinerals = ['vanadinite', 'mottramite', 'descloizite', 'carnotite', 'clinobisvanite', 'tyuyamunite'];
    const vCount = sim.crystals.filter((c: any) => vMinerals.indexOf(c.mineral) >= 0).length;
    expect(vCount).toBe(0);
  });

  it('a V-free scenario carries no apophyllite_green tag (colour dispatch is conditional on V)', () => {
    const sim = run('grimsel_alpine_cleft', 42);
    const tagged = sim.crystals.filter((c: any) => c._sectorZoned && c._sectorZoned.kind === 'apophyllite_green');
    expect(tagged.length).toBe(0);
  });
});
