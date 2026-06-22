// tests-js/selenite-hourglass.test.ts — the VISIBLE hourglass selenite of the Great
// Salt Plains (crystal-face-realism arc 2026-06-22). Selenite was already in the
// catalogue; this adds its iconic clay/iron sector hourglass as a RENDER classification.
//
// grow_selenite (js/60) already tags a growth zone inclusion_type='hourglass (sand
// inclusions)' when growth is fast; classifySectorZoning (js/45) _seleniteHourglassParams
// reads those zones (SIM-neutral — no chemistry) and tags _sectorZoned kind
// 'gypsum_hourglass' with an intensity / flooded / steps; js/99i _makeHourglassSeleniteBlade
// renders the amber→chocolate sandglass on a tapering chisel/stepped blade.
//
// The defining geology gate: the hourglass is a COOL (<45°C), near-surface, sediment-laden
// phenomenon. Naica's hot (~54°C), clean, slow geothermal pool grows water-CLEAR giant
// crystals — it must NOT be tagged, or its iconic clarity would be wrongly painted brown.
//
// Pins: hourglass fires + is tagged in a cool sediment-laden scenario; a sediment-flooded
// playa produces the solid-brown flooded variant; Naica selenite stays CLEAR (the gate);
// the params are well-formed (intensity in range, steps ≥ 0).

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

const hourglass = (sim: any) =>
  sim.crystals.filter((c: any) => c.mineral === 'selenite' && !c.dissolved
    && c._sectorZoned && c._sectorZoned.kind === 'gypsum_hourglass');

describe('hourglass selenite (Great Salt Plains clay/Fe sector zoning)', () => {
  it('a cool sediment-laden scenario grows visible-hourglass selenite, tagged + well-formed', () => {
    const sim = run('supergene_oxidation', 42);
    expect(sim).toBeTruthy();
    const hg = hourglass(sim);
    expect(hg.length).toBeGreaterThan(0);
    for (const c of hg) {
      expect(c._sectorZoned.intensity).toBeGreaterThan(0);
      expect(c._sectorZoned.intensity).toBeLessThanOrEqual(1);
      expect(c._sectorZoned.steps).toBeGreaterThanOrEqual(0);
    }
  });

  it('an iron-rich oxidation setting floods the blade to solid brown (the overgrown variant)', () => {
    // supergene_oxidation: abundant iron from sulfide oxidation saturates the stain →
    // intensity maxes → the hourglass is buried in solid brown (flooded).
    const sim = run('supergene_oxidation', 42);
    const flooded = hourglass(sim).filter((c: any) => c._sectorZoned.flooded);
    expect(flooded.length).toBeGreaterThan(0);
  });

  it('Naica selenite stays CLEAR — the hot clean pool is below no inclusion gate (defer-to-geology)', () => {
    const sim = run('naica_geothermal', 42);
    const sel = sim.crystals.filter((c: any) => c.mineral === 'selenite' && !c.dissolved);
    expect(sel.length).toBeGreaterThan(0);            // Naica does grow selenite…
    expect(hourglass(sim).length).toBe(0);            // …but none is tagged hourglass (stays water-clear)
  });

  it('great_salt_plains is the showcase — pulsed wet/dry growth steps the iron-brown hourglass', () => {
    const sim = run('great_salt_plains', 42);
    const hg = hourglass(sim);
    expect(hg.length).toBeGreaterThan(0);
    // The wet/dry cycling grows the blade in gap-separated bursts → stepped-growth ziggurat.
    expect(Math.max(...hg.map((c: any) => c._sectorZoned.steps))).toBeGreaterThanOrEqual(2);
    // Red-bed iron stains it a real brown (not the faint-amber low-iron end).
    expect(Math.max(...hg.map((c: any) => c._sectorZoned.intensity))).toBeGreaterThan(0.4);
  });
});
