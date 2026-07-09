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

function run(scenarioName: string, seed = 42, stepsOverride?: number) {
  setSeed(seed);
  const scen = SCENARIOS[scenarioName];
  if (!scen) return null;
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  const steps = stepsOverride ?? defaultSteps ?? 200;
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

  it('an iron-rich oxidation setting stains the blade hard (well above the amber end)', () => {
    // supergene_oxidation: iron from sulfide oxidation drives the stain intensity
    // high. RE-TRUED at SIM 221 (O4b): the old pin required the FLOODED variant at
    // seed 42, but flooding here was always a coin flip on how the run's Fe pulses
    // overlap the blades' growth (v221 sweep: 5/12 seeds flood at 0.95, the rest
    // land 0.63–0.73) — the pre-O4b seed-42 flood was weather from the phantom-
    // enclosure RNG stream, not a property of the setting. The genre claim this
    // test keeps: supergene iron stains HARD. The flooded VARIANT keeps its own
    // showcase pins below on great_salt_plains' red-mud flood (step 265), which
    // reaches it by mechanism, not luck.
    const sim = run('supergene_oxidation', 42);
    const hg = hourglass(sim);
    expect(hg.length).toBeGreaterThan(0);
    expect(Math.max(...hg.map((c: any) => c._sectorZoned.intensity))).toBeGreaterThan(0.55);
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

  // OPEN-SYSTEM evaporite plain + flooded variant (SIM 214, boss directive: a salt plain
  // is an open surface, not a sealed pocket that fills and closes). wall.open_system makes
  // the basin never seal, so selenite keeps growing through the cycles instead of packing
  // the vug and halting; the red-mud gsp_flood (step 265, PAST the 250 baseline) then
  // overgrows the still-growing blades to solid brown — only reachable because the plain
  // stayed open. The canonical 250-step run stays the AMBER stepped hourglass.
  it('open salt plain: canonical 250-step run is the AMBER stepped hourglass (not flooded)', () => {
    const sim = run('great_salt_plains', 42);   // defaultSteps = 250
    const hg = hourglass(sim);
    expect(hg.length).toBeGreaterThan(0);
    expect(hg.some((c: any) => c._sectorZoned.flooded)).toBe(false);   // amber, not flooded at 250
    // Open system: the blades grow through every cycle (never sealed) → richer stepping.
    expect(Math.max(...hg.map((c: any) => c._sectorZoned.steps))).toBeGreaterThanOrEqual(3);
  });

  it('open salt plain: an extended run reaches the RED-MUD FLOOD → blades overgrow to solid brown', () => {
    const sim = run('great_salt_plains', 42, 330);   // past the gsp_flood at step 265
    const hg = hourglass(sim);
    expect(hg.length).toBeGreaterThan(0);
    expect(hg.some((c: any) => c._sectorZoned.flooded)).toBe(true);    // flooded variant
    expect(Math.max(...hg.map((c: any) => c._sectorZoned.intensity))).toBeGreaterThan(0.9);
  });
});
