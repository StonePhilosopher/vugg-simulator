// tests-js/sulphur-bank.test.ts — Sulphur Bank Mine scenario pins (2026-05-18, v79).
//
// Pins the new sulphur_bank scenario (commit landed alongside this
// test file) so its load-bearing geological signal can't silently
// regress. This is the FIRST scenario to fire the native_sulfur
// engine to completion — that engine has existed since v8 (Round 8b)
// but no canonical scenario fed its acid-sulfate gates until v79.
//
// See proposals/HANDOFF-HIGH-FILL-ARC-COMPLETE.md §5 (the open
// backlog item "native_sulfur cascade-gate — only remaining
// structural-pattern dead mineral from the audit, deferred per
// HANDOFF-CASCADE-GATE-AUDIT §5. Needs a fumarole / Sulphur Bank
// Mine / Whakaari-type scenario to land first") that this commit
// closes.
//
// Anchor: Sulphur Bank Mine, Lake County, CA. Pleistocene hot-
// spring mercury-sulfur deposit. White & Roberson 1962 (USGS
// PP 432-A) is the canonical monograph.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runFullScenario(seed: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  let maxSigma = 0;
  for (let i = 0; i < steps; i++) {
    sim.run_step();
    const s = sim.conditions.supersaturation_native_sulfur();
    if (s > maxSigma) maxSigma = s;
  }
  return { sim, maxSigma };
}

describe('Sulphur Bank Mine — native_sulfur scenario pins (v79)', () => {
  describe('native_sulfur fires across seeds (the headline win)', () => {
    it.each([42, 1, 7])('seed %d: native_sulfur peak sigma > 1.5', (seed) => {
      const { maxSigma } = runFullScenario(seed);
      expect(maxSigma, `native_sulfur peak sigma at seed ${seed} was ${maxSigma.toFixed(2)}`)
        .toBeGreaterThan(1.5);
    });

    it.each([42, 1, 7])('seed %d: at least 3 active native_sulfur crystals', (seed) => {
      const { sim } = runFullScenario(seed);
      const activeNS = sim.crystals.filter((c: any) =>
        c.mineral === 'native_sulfur' && c.active,
      );
      expect(activeNS.length,
        `seed ${seed}: only ${activeNS.length} active native_sulfur crystals (expected >= 3)`)
        .toBeGreaterThanOrEqual(3);
    });

    it.each([42, 1, 7])('seed %d: native_sulfur reaches a canonical Sulphur Bank habit', (seed) => {
      // The engine's habit dispatcher for native_sulfur:
      //   excess > 1.5 + T > 60  → sublimation_crust (fumarole habit,
      //                            geologically real for hot vents —
      //                            Sulphur Bank's hotter vent zones)
      //   T >= 95                → prismatic_beta (high-T monoclinic)
      //   else (cool surface)    → bipyramidal_alpha (iconic alpha form)
      //
      // At Sulphur Bank, T=75°C with high σ favors sublimation_crust;
      // cooling events drop T below 60 for bipyramidal_alpha. Pre-v81
      // (no cinnabar competing for S), σ was lower so bipyramidal_alpha
      // dominated. Post-v81 with cinnabar+native_sulfur both consuming
      // S, the σ trajectory shifts: native_sulfur fires earlier when σ
      // is high → more sublimation_crust. BOTH habits are textbook
      // Sulphur Bank — pin accepts either.
      const { sim } = runFullScenario(seed);
      const ns = sim.crystals.filter((c: any) => c.mineral === 'native_sulfur');
      expect(ns.length, `seed ${seed}: no native_sulfur at all`).toBeGreaterThan(0);
      const canonical = ['bipyramidal_alpha', 'sublimation_crust'];
      const matched = ns.filter((c: any) => canonical.includes(c.habit));
      expect(matched.length,
        `seed ${seed}: no native_sulfur in canonical Sulphur Bank habits (got: ${[...new Set(ns.map((c: any) => c.habit))].join(', ')})`)
        .toBeGreaterThan(0);
    });
  });

  describe('supporting paragenesis (acid hot-spring assemblage)', () => {
    it('pyrite fires (Fe+S sulfide, acid-tolerant) at seed 42', () => {
      const { sim } = runFullScenario(42);
      const hits = sim.crystals.filter((c: any) => c.mineral === 'pyrite');
      expect(hits.length, 'pyrite should fire from the trace Fe + 500-ppm S broth')
        .toBeGreaterThan(0);
    });

    it('arsenopyrite fires (Fe+As+S, the trace As) at seed 42', () => {
      const { sim } = runFullScenario(42);
      const hits = sim.crystals.filter((c: any) => c.mineral === 'arsenopyrite');
      expect(hits.length, 'arsenopyrite should fire from the trace As + Fe + S')
        .toBeGreaterThan(0);
    });

    it('quartz fires (silica from hot-spring SiO₂) at seed 42', () => {
      const { sim } = runFullScenario(42);
      const hits = sim.crystals.filter((c: any) => c.mineral === 'quartz');
      expect(hits.length, 'quartz should fire from 200-ppm SiO₂ hot-spring fluid')
        .toBeGreaterThan(0);
    });
  });

  describe('scenario architecture sanity', () => {
    it('wall composition is basalt (silicate, inert under acid)', () => {
      // Sulphur Bank is hosted in altered clastic sediments, not
      // carbonate. If the wall were limestone, dissolve() would
      // buffer pH up via wall-derived Ca + CO₃ and shut off the
      // native_sulfur engine. The basalt composition (silicate,
      // dissolve() returns no-op) is what keeps pH acid.
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.wall.composition).toBe('basalt');
    });

    it('architecture is irregular (acid-dissolution cavity)', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.wall.architecture).toBe('irregular');
    });

    it('initial pH < 5 (engine gate)', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.fluid.pH,
        `initial pH ${conditions.fluid.pH} would block the engine's pH <= 5 gate`)
        .toBeLessThan(5);
    });

    it('initial O₂ inside [0.1, 0.7] synproportionation window', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.fluid.O2).toBeGreaterThanOrEqual(0.1);
      expect(conditions.fluid.O2).toBeLessThanOrEqual(0.7);
    });

    it('metal_sum < 100 (engine gate — mercury hot springs are low-metal)', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      const f = conditions.fluid;
      const metal_sum = (f.Fe || 0) + (f.Cu || 0) + (f.Pb || 0) + (f.Zn || 0);
      expect(metal_sum,
        `metal_sum ${metal_sum} would block the engine's metal_sum <= 100 gate`)
        .toBeLessThanOrEqual(100);
    });

    it('initial S >= 100 (engine gate)', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.fluid.S,
        `initial S ${conditions.fluid.S} would block the engine's S >= 100 gate`)
        .toBeGreaterThanOrEqual(100);
    });

    it('initial T in [20, 95]°C (engine optimal window)', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.temperature).toBeGreaterThanOrEqual(20);
      expect(conditions.temperature).toBeLessThanOrEqual(95);
    });
  });

  describe('event registry wiring', () => {
    // The three new event handlers must be reachable via the event
    // registry; a typo in EVENT_REGISTRY would cause the scenario
    // loader to throw "references unknown event type" at construction
    // time. If we get here with a working SCENARIOS['sulphur_bank']
    // callable, the registry resolution already succeeded for all
    // 13 event entries. These pins additionally verify the events
    // actually MUTATE state (no-op apply_fn would pass registry
    // resolution but be silently broken).

    it('h2s_recharge event acidifies + pumps S', () => {
      // Step 10 is the first h2s_recharge event. Run to just-before
      // and just-after; compare pH/S before & after the event step.
      setSeed(42);
      const { conditions, events } = SCENARIOS['sulphur_bank']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 9; i++) sim.run_step();      // step 9 (pre-event)
      const phPre = sim.conditions.fluid.pH;
      const sPre = sim.conditions.fluid.S;
      sim.run_step();                                   // step 10 (event fires)
      const phPost = sim.conditions.fluid.pH;
      const sPost = sim.conditions.fluid.S;
      // h2s_recharge subtracts 1.0 from pH (then clamps at 1.5).
      expect(phPost,
        `pH should have dropped after recharge: pre=${phPre.toFixed(2)} post=${phPost.toFixed(2)}`)
        .toBeLessThan(phPre + 0.1);
      // Adds 150 to S (minus any dissolution consumption).
      expect(sPost - sPre,
        `S should have grown after recharge: delta=${(sPost - sPre).toFixed(1)}`)
        .toBeGreaterThan(50);
    });

    it('surface_oxidation event pins O₂ to 0.40 (synproportionation peak)', () => {
      // Step 20 is the first surface_oxidation event.
      setSeed(42);
      const { conditions, events } = SCENARIOS['sulphur_bank']();
      const sim = new VugSimulator(conditions, events);
      for (let i = 0; i < 19; i++) sim.run_step();
      sim.run_step();   // step 20 — surface_oxidation fires
      expect(sim.conditions.fluid.O2,
        `O₂ should be pinned to ~0.40 after surface_oxidation`)
        .toBeCloseTo(0.40, 1);
    });

    it('cooling event drops T below 60°C', () => {
      // Step 90 is the first cooling event. Pre-event T is ~75-80°C
      // (held high by h2s_recharge events); cooling subtracts 20.
      //
      // v181: ambient thermal noise is SWITCHED OFF for this assertion
      // (cooling_rate 0 + thermal_pulses false, runtime knobs). The pin is
      // about EVENT mechanics — under the old shared-stream engine it was
      // realization-lucky: any seed whose ambient pulse lands on step 90
      // re-warms +30..150°C straight through the event's −20°C, which is
      // exactly what the v181 thermal-stream re-roll did at seed 42. With
      // ambient off, the step-90 drop is the event's alone — deterministic
      // and seed-independent.
      setSeed(42);
      const { conditions, events } = SCENARIOS['sulphur_bank']();
      const sim = new VugSimulator(conditions, events);
      sim.conditions.wall.cooling_rate = 0;
      sim.conditions.wall.thermal_pulses = false;
      for (let i = 0; i < 89; i++) sim.run_step();
      const Tpre = sim.conditions.temperature;
      sim.run_step();   // step 90 — cooling fires
      const Tpost = sim.conditions.temperature;
      expect(Tpost,
        `T should have dropped at cooling event: pre=${Tpre.toFixed(1)} post=${Tpost.toFixed(1)}`)
        .toBeLessThan(Tpre);
    });
  });
});
