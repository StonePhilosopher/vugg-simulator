// tests-js/tn457-barite-pulses.test.ts — guard test for the v118
// TN457 barite-pulses scenario (forcing-function test for
// PROPOSAL-EVENT-DRIVEN-PRECIPITATION, Rock Bot + Professor 2026-05-20,
// boss-greenlit 2026-05-21).
//
// What this scenario tests:
//   1. The engine ALREADY supports event-driven precipitation —
//      EVENT_REGISTRY + per-step zone recording + SUBSTRATE_NUCLEATION_
//      DISCOUNT + MINERAL_STOICHIOMETRY composed. This test pins that
//      composition produces the expected paragenesis (sphalerite first,
//      then barite on sphalerite substrate) and per-zone Mn variation.
//   2. Determinism: ?seed=42 produces byte-stable output (composes with
//      v117 agent-friendly URL contract).
//
// What this scenario does NOT test (deferred per gap-analysis):
//   - Coin-stack render primitive ('stacked_tablets' habit-variant)
//   - Per-zone color band rendering
//   - Mass-nucleation bypass at high sigma
//   - Epitaxy-vs-nucleation tilt during high-pulse-density windows
// Those gaps surface in the boss's visual-diff comparison against the
// real TN457 specimen photograph.

import { describe, expect, it } from 'vitest';
import { loadArchivedScenario } from './strip-helpers';

declare const SCENARIOS: any;
declare const VugSimulator: any;
declare const setSeed: (seed: number) => void;

const observationCache = new Map<string, any>();

function seed42Story(): any {
  // Load after the Vitest bundle setup has installed SCENARIOS and the current
  // model identity; loadArchivedScenario authenticates both before returning.
  return loadArchivedScenario('tn457_barite_pulses');
}

const LIVE_OBSERVATION_STEPS = 24;

function observeTN457(seed: number, steps = LIVE_OBSERVATION_STEPS): any {
  const key = `${seed}:${steps}`;
  if (observationCache.has(key)) return observationCache.get(key);
  setSeed(seed);
  const { conditions, events } = SCENARIOS.tn457_barite_pulses();
  const sim = new VugSimulator(conditions, events);
  for (let s = 0; s < steps; s++) sim.run_step();
  // Keep only the scientific observation surface. Retaining complete
  // simulator graphs across assertions is unnecessary and RAM-hostile.
  const observation = {
    crystals: sim.crystals.map((crystal: any) => ({
      mineral: crystal.mineral,
      nucleation_step: crystal.nucleation_step,
      zones: (crystal.zones || []).map((zone: any) => ({
        thickness_um: zone.thickness_um,
        trace_Mn: zone.trace_Mn,
      })),
    })),
  };
  observationCache.set(key, observation);
  return observation;
}

describe('TN457 barite pulses — v118 forcing-function test', () => {
  it('scenario is registered', () => {
    expect(typeof SCENARIOS.tn457_barite_pulses).toBe('function');
  });

  it('scenario callable returns conditions + 50 events + 110-step default', () => {
    const { conditions, events, defaultSteps } = SCENARIOS.tn457_barite_pulses();
    expect(conditions).toBeTruthy();
    expect(events.length).toBe(50);
    expect(defaultSteps).toBe(110);
    // All 50 events are tn457_mn_ba_pulse type firing at odd steps 5-103
    for (const ev of events) {
      expect(ev.step).toBeGreaterThanOrEqual(5);
      expect(ev.step).toBeLessThanOrEqual(103);
      expect(typeof ev.apply_fn).toBe('function');
    }
    // First pulse at step 5, last at step 103, spacing 2
    expect(events[0].step).toBe(5);
    expect(events[events.length - 1].step).toBe(103);
  });

  it('initial broth gates: sphalerite ON, barite OFF (waiting for pulse 1)', () => {
    const { conditions } = SCENARIOS.tn457_barite_pulses();
    // Initial Zn=180, S=200, T=120 → sphalerite should fire from step 1.
    expect(conditions.supersaturation_sphalerite()).toBeGreaterThan(0);
    // Initial Ba=2 is BELOW barite's Ba >= 5 gate; barite waits for pulse 1.
    expect(conditions.fluid.Ba).toBeLessThan(5);
    expect(conditions.supersaturation_barite()).toBe(0);
  });

  it('after pulse 1 (step 5), barite gate clears', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.tn457_barite_pulses();
    const sim = new VugSimulator(conditions, events);
    for (let s = 0; s < 6; s++) sim.run_step();  // steps 1-6 (pulse 1 at step 5)
    expect(conditions.fluid.Ba).toBeGreaterThanOrEqual(5);
    expect(conditions.supersaturation_barite()).toBeGreaterThan(0);
  });

  it('paragenesis: sphalerite nucleates before barite', () => {
    const sim = observeTN457(42);
    const sph = sim.crystals.filter((c: any) => c.mineral === 'sphalerite');
    const bar = sim.crystals.filter((c: any) => c.mineral === 'barite');
    expect(sph.length).toBeGreaterThan(0);
    expect(bar.length).toBeGreaterThan(0);
    const earliestSph = Math.min(...sph.map((c: any) => c.nucleation_step));
    const earliestBar = Math.min(...bar.map((c: any) => c.nucleation_step));
    expect(earliestSph).toBeLessThan(earliestBar);
  });

  it('barite zones record Mn variation across pulses (the pink-banding signature)', () => {
    const sim = observeTN457(42);
    const bar = sim.crystals.filter((c: any) => c.mineral === 'barite');
    expect(bar.length).toBeGreaterThan(0);
    // Find a barite crystal with multiple positive-growth zones (i.e. it
    // saw multiple pulses while alive).
    const longLivedBar = bar.find((c: any) => (c.zones || []).filter((z: any) => z.thickness_um > 0).length >= 3);
    expect(longLivedBar).toBeTruthy();
    if (!longLivedBar) return;
    const positiveZones = longLivedBar.zones.filter((z: any) => z.thickness_um > 0);
    const mnValues = positiveZones.map((z: any) => z.trace_Mn).filter((m: number) => Number.isFinite(m));
    expect(mnValues.length).toBeGreaterThanOrEqual(3);
    // Mn values across zones must VARY — that's the pink-banding signature.
    // Partition coefficient 0.0015 × per-pulse rng-driven fluid Mn variation
    // (0.3-1.5 ppm/pulse + cumulative accumulation over the run) produces
    // measurable per-zone differences. Threshold 0.01 corresponds to ~7 ppm
    // fluid-Mn spread across zones — well above noise.
    const minMn = Math.min(...mnValues);
    const maxMn = Math.max(...mnValues);
    expect(maxMn - minMn).toBeGreaterThan(0.01);
  });

  it('cumulative pulse effect: T cools, O2 oxidizes (per design)', () => {
    const story = seed42Story();
    const temperatures = story.raw_environment.T;
    const oxygen = story.raw_environment.O2;
    // 50 pulses × 0.5°C = 25°C cooling (with some run_step ambient drift)
    expect(temperatures.at(-1)).toBeLessThan(temperatures[0]);
    // 50 pulses × 0.005 = +0.25 oxidation
    expect(oxygen.at(-1)).toBeGreaterThan(oxygen[0]);
  });

  it('determinism: same seed twice → identical paragenetic sequence', () => {
    const live = observeTN457(42);
    const archived = seed42Story().nucleation_events
      .filter((event: any) => event.step <= LIVE_OBSERVATION_STEPS)
      .map((event: any) => ({ mineral: event.mineral, nucleation_step: event.step }));
    expect(live.crystals.map((crystal: any) => ({
      mineral: crystal.mineral,
      nucleation_step: crystal.nucleation_step,
    }))).toEqual(archived);
  });

  it('different seeds → different specimens (seed wires through)', () => {
    const a = observeTN457(42);
    const b = observeTN457(999);
    // At least one of: crystal count differs, paragenetic order differs,
    // or nucleation step pattern differs. (Both must differ in SOMETHING.)
    const sameCount = a.crystals.length === b.crystals.length;
    const sameSteps = sameCount && a.crystals.every((c: any, i: number) =>
      c.nucleation_step === b.crystals[i].nucleation_step && c.mineral === b.crystals[i].mineral);
    expect(sameSteps).toBe(false);
  });

  it('agent-friendly: ?seed= URL contract works via _agentHeadlessRun', () => {
    const hooks: any = (globalThis as any).__vugg_agent_test_hooks;
    expect(hooks).toBeTruthy();
    const result = hooks._agentHeadlessRun('tn457_barite_pulses', { seed: 42, steps: 10 });
    const spec = hooks._agentSpecimenJSON(result.sim);
    expect(spec.ok).toBe(true);
    expect(spec.scenario).toBe('tn457_barite_pulses');
    expect(spec.seed).toBe(42);
    expect(spec.total_steps).toBe(10);
    expect(spec.paragenetic_sequence).toContain('sphalerite');
    // Barite may or may not appear by step 10 depending on growth dynamics,
    // but if it does, it MUST come after sphalerite in the sequence.
    if (spec.paragenetic_sequence.includes('barite')) {
      const sphIdx = spec.paragenetic_sequence.indexOf('sphalerite');
      const barIdx = spec.paragenetic_sequence.indexOf('barite');
      expect(barIdx).toBeGreaterThan(sphIdx);
    }
  });
});
