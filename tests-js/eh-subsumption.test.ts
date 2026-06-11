// tests-js/eh-subsumption.test.ts — EVENT-SUBSUMPTION contracts (v185).
//
// schneeberg's redox was a STEP FUNCTION told through scripted event O2
// writes (O2:0.0 pegmatitic → a single-step flip to O2:1.5 at the step-85
// meteoric flood). v185 retires that swing into a DECLARED fluid.Eh
// movement (window 0→110, base −200 mV, one step op +490 at u=0.8): the
// reducing pegmatitic plateau holds, then a ~8-step sulfide-buffer-
// exhaustion swing to +290 mV centered at step 88. Events keep their
// chemistry beats; the movement is the redox sentence (the naica
// composition pattern, applied to Eh).
//
// These pin the contracts that make the subsumption honest:
//   1. THE MOVEMENT IS DECLARED — schneeberg's spec actually carries the
//      fluid.Eh movement (guards against a silent revert).
//   2. THE SHAPE — Eh holds at the reducing floor through the plateau,
//      then climbs to the oxidizing plateau across the front, and the
//      drivesFieldAt gate is true exactly inside the window.
//   3. EH-CANONICAL — inside the window O2 follows the movement's Eh
//      (engines read o2FromEh(Eh)); the scripted O2 writes are superseded.
//   4. WINDOW BOUNDARY IS GEOLOGY — the window ends at the step-110 vadose
//      exhumation; after it, air owns redox (the vadose O2 floor) and the
//      sync reverts to O2→Eh, so the movement never fights the override.
//   5. THE LINEAGES SURVIVE — the four uranyl micas (as their meta- forms)
//      + the five-element suite still grow at seed 42.
//
// The multi-seed fire-rate gate (the real judge for 1-crystal marginals)
// is the standing instrument's job: tools/eh-subsumption-observe.mjs.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const o2FromEh: any;

function mkSchneeberg(seed = 42) {
  setSeed(seed);
  const { conditions, events } = SCENARIOS.schneeberg();
  return new VugSimulator(conditions, events);
}

describe('schneeberg event-subsumption (v185 — redox as a declared movement)', () => {

  it('schneeberg declares the fluid.Eh subsumption movement', () => {
    const { conditions } = SCENARIOS.schneeberg();
    const ms = conditions._scenario && conditions._scenario.movements;
    expect(Array.isArray(ms)).toBe(true);
    const eh = ms.find((m: any) => m.field === 'fluid.Eh');
    expect(eh).toBeTruthy();
    expect(eh.startStep).toBe(0);
    expect(eh.endStep).toBe(110);             // = the step-110 vadose exhumation
    expect(eh.base).toBe(-200);               // the ehFromO2 floor at O2:0
    // deterministic — no OU texture (re-rolls 1-crystal marginals; see CATCHES 16)
    expect(eh.texture).toBeUndefined();
  });

  it('the controller drives Eh ONLY inside the phreatic window', () => {
    const sim = mkSchneeberg();
    sim.run_step();   // build the controller
    const c = sim._movements;
    expect(c.drivesFieldAt('Eh', 0)).toBe(true);
    expect(c.drivesFieldAt('Eh', 88)).toBe(true);    // the front
    expect(c.drivesFieldAt('Eh', 109)).toBe(true);   // last phreatic step
    expect(c.drivesFieldAt('Eh', 110)).toBe(false);  // vadose — air owns redox
    expect(c.drivesFieldAt('Eh', 140)).toBe(false);
  });

  it('the shape: reducing plateau → oxidizing plateau across an ~8-step front', () => {
    const sim = mkSchneeberg();
    const eh: number[] = [];
    for (let s = 0; s < 110; s++) { sim.run_step(); eh.push(sim.conditions.fluid.Eh); }
    // Plateau (pre-front, well before the step-85 flood): pinned at the floor.
    const plateau = eh.slice(40, 70);
    for (const v of plateau) expect(v).toBeCloseTo(-200, 0);
    // Oxidizing plateau (post-front, before vadose): up at ~+290.
    const oxidized = eh.slice(95, 109);
    for (const v of oxidized) expect(v).toBeGreaterThan(250);
    // The swing is centered at the meteoric arrival, not before it: step 80 is
    // still mostly reducing, step 92 is mostly oxidized (front ramp 84→92).
    expect(eh[80]).toBeLessThan(150);
    expect(eh[92]).toBeGreaterThan(150);
  });

  it('Eh-CANONICAL inside the window: O2 follows the movement, overriding the scripted writes', () => {
    const sim = mkSchneeberg();
    // Step 30: deep in the reducing plateau. The pegmatite_crystallization
    // event wrote O2:0.0; the movement holds Eh=−200, and O2 must be its
    // reverse-derivation o2FromEh(−200), NOT the stale scripted 0.0.
    for (let s = 0; s < 30; s++) sim.run_step();
    const f = sim.conditions.fluid;
    expect(f.Eh).toBeCloseTo(-200, 0);
    expect(f.O2).toBeCloseTo(o2FromEh(f.Eh), 6);
  });

  it('window boundary: after step 110 the sync reverts to O2→Eh (air owns redox)', () => {
    const sim = mkSchneeberg();
    for (let s = 0; s < 120; s++) sim.run_step();
    // Past the vadose exhumation the movement no longer drives Eh; the vadose
    // override has floored O2 oxidizing, and Eh is now the DERIVED view of it.
    expect(sim._movements.drivesFieldAt('Eh', sim.step)).toBe(false);
    const f = sim.conditions.fluid;
    expect(f.O2).toBeGreaterThan(1);            // oxidizing (air)
    // Eh follows O2 here (O2→Eh canonical), the inverse of the in-window flip.
    // ehFromO2 ∘ o2FromEh is identity over the representable domain, so the
    // round-trip identity is the cleanest check that the direction reverted.
    expect(o2FromEh(f.Eh)).toBeCloseTo(f.O2, 4);
  });

  it('the uranyl-mica lineages + five-element suite still grow (seed 42)', () => {
    const sim = mkSchneeberg();
    for (let s = 0; s < 160; s++) sim.run_step();
    const have = new Set(sim.crystals.map((c: any) => c.mineral));
    // A uranyl mica is "present" as EITHER form — the step-110 dehydration
    // renames it (torbernite→metatorbernite); which form lands is a placement
    // coin flip, orthogonal to the redox story (CATCHES 16 — gate lineages).
    const lineage = (...forms: string[]) => forms.some((f) => have.has(f));
    expect(lineage('torbernite', 'metatorbernite')).toBe(true);
    expect(lineage('zeunerite', 'metazeunerite')).toBe(true);
    expect(lineage('autunite', 'meta-autunite')).toBe(true);
    expect(have.has('uranospinite')).toBe(true);
    // The five-element vein heritage (reducing-era, untouched by the front).
    for (const m of ['uraninite', 'native_bismuth', 'native_arsenic',
      'cobaltite', 'nickeline', 'cassiterite']) {
      expect(have.has(m)).toBe(true);
    }
  });

  it('reducing-era nucleations are unmoved by the front (it rises only at the flood)', () => {
    // native_bismuth (bismuth-arsenide window, ~step 70) and naumannite
    // (selenide, ~step 67) nucleate in the reducing plateau — the canon-true
    // front (centered at 88, not 80) must leave their window untouched. This
    // is the contract that made at=88 win over at=80 in observation.
    const sim = mkSchneeberg();
    for (let s = 0; s < 110; s++) sim.run_step();
    const bi = sim.crystals.filter((c: any) => c.mineral === 'native_bismuth');
    expect(bi.length).toBeGreaterThan(0);
    for (const c of bi) expect(c.nucleation_step).toBeLessThan(85);  // before the front
  });
});
