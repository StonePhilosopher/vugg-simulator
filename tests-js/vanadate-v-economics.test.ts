// tests-js/vanadate-v-economics.test.ts — v193 Caldbeck V-suite arc.
//
// THE CORRECTION (task #55, the twice-deferred roughten_gill mottramite
// arc): mottramite + descloizite were a dead-species pair fleet-wide
// while their V-gate sat at 10 — 5× vanadinite's 2 — backwards against
// the deposits (the descloizite group ARE the abundant supergene V ores;
// Boni et al. 2007 Econ Geol 102:441). Two engine bugs + one missing
// scenario mechanic, each pinned here:
//
//   1. vanadinite's MISSING redox gate (was cloned from pyromorphite,
//      a PO4 phase with no redox requirement; V⁵⁺ vanadate needs O2).
//   2. descloizite-group V-economics (V_min 10→4, v_f /20→/8 — brought
//      to vanadinite-comparable V economy, not privileged).
//   3. roughten_gill supergene V-leach delivers mottramite at seed 42
//      WITHOUT disturbing the primary suite (event-timed after lockup).

import { describe, expect, it } from 'vitest';

declare const VugConditions: any;
declare const FluidChemistry: any;
declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runScenario(name: string, seed = 42) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = defaultSteps ?? 200;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}
const alive = (sim: any, m: string) =>
  sim.crystals.filter((c: any) => c.mineral === m && !c.dissolved && c.total_growth_um > 0).length;

describe('v193 — vanadinite redox gate (the missing V⁵⁺ oxidation requirement)', () => {
  it('blocks under reducing conditions (O2 < 0.5) even with full Pb+V+Cl', () => {
    // Pre-v193 this fired: vanadinite was the one Pb-vanadate with no
    // redox gate, so it nucleated at O2 0.20 (the roughten_gill reducing
    // window, steps 30-70). V⁵⁺ isn't mobile in reducing fluid.
    const fluid = new FluidChemistry({ Pb: 60, V: 20, Cl: 20, O2: 0.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 40, fluid });
    expect(cond.supersaturation_vanadinite()).toBe(0);
  });

  it('fires under oxidizing conditions (O2 ≥ 0.5)', () => {
    const fluid = new FluidChemistry({ Pb: 60, V: 20, Cl: 20, O2: 1.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 40, fluid });
    expect(cond.supersaturation_vanadinite()).toBeGreaterThan(0);
  });
});

describe('v193 — descloizite-group V-economics (gate 10→4, v_f /20→/8)', () => {
  it('mottramite fires at modest V (was blocked below the old V≥10 gate)', () => {
    // V=6 (roughten_gill broth level) — under the OLD gate (V_min 10)
    // this returned 0; the group needed 5× vanadinite. Now σ > 0.
    const fluid = new FluidChemistry({ Pb: 90, Cu: 75, Zn: 50, V: 6, O2: 1.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 30, fluid });
    expect(cond.supersaturation_mottramite()).toBeGreaterThan(0);
  });

  it('descloizite fires at modest V too (same V-economics correction)', () => {
    const fluid = new FluidChemistry({ Pb: 90, Zn: 90, Cu: 5, V: 6, O2: 1.2, pH: 5.5 });
    const cond = new VugConditions({ temperature: 30, fluid });
    expect(cond.supersaturation_descloizite()).toBeGreaterThan(0);
  });

  it('the Cu/Zn cation fork still routes: Cu-dominant → mottramite, Zn-dominant → descloizite', () => {
    // The V-economics correction did NOT touch the distinctive routing.
    const cuRich = new VugConditions({ temperature: 30,
      fluid: new FluidChemistry({ Pb: 90, Cu: 80, Zn: 10, V: 8, O2: 1.2, pH: 5.5 }) });
    expect(cuRich.supersaturation_mottramite()).toBeGreaterThan(0);
    expect(cuRich.supersaturation_descloizite()).toBe(0);  // Zn-fraction < 0.5

    const znRich = new VugConditions({ temperature: 30,
      fluid: new FluidChemistry({ Pb: 90, Cu: 10, Zn: 80, V: 8, O2: 1.2, pH: 5.5 }) });
    expect(znRich.supersaturation_descloizite()).toBeGreaterThan(0);
    expect(znRich.supersaturation_mottramite()).toBe(0);   // Cu-fraction < 0.5
  });

  it('the redox gate applies to the descloizite group as well (reducing → 0)', () => {
    const reducing = new VugConditions({ temperature: 30,
      fluid: new FluidChemistry({ Pb: 90, Cu: 75, Zn: 50, V: 14, O2: 0.2, pH: 5.5 }) });
    expect(reducing.supersaturation_mottramite()).toBe(0);
  });
});

describe('v193 — roughten_gill delivers mottramite without disturbing the primary suite', () => {
  let sim: any;
  function ensure() { if (!sim) sim = runScenario('roughten_gill'); }

  it('mottramite fires at seed 42 (the arc goal — the Caldbeck V suite)', () => {
    ensure();
    // The supergene V-leach (step-70 oxidation event, V 6→14) + the engine
    // V-economics correction deliver the Brae Fell rice-grain mottramite.
    expect(alive(sim, 'mottramite')).toBeGreaterThan(0);
  });

  it('vanadinite still fires (re-timed to the oxidizing window, not lost)', () => {
    ensure();
    expect(alive(sim, 'vanadinite')).toBeGreaterThan(0);
  });

  it('the primary suite is INTACT — the V-leach fires after the step-25 lockup', () => {
    ensure();
    // The v109/v180 failures bumped INITIAL-broth V (from step 0) and
    // halved sphalerite by re-rolling the primary RNG. The v193 leach is
    // event-timed at step 70, after primaries lock — galena unchanged,
    // sphalerite not suppressed.
    expect(alive(sim, 'galena')).toBeGreaterThan(0);
    expect(alive(sim, 'sphalerite')).toBeGreaterThan(0);
  });
});

describe('v193 — mottramite reaches its type-abundance locality (Tsumeb free win)', () => {
  it('mottramite fires at supergene_oxidation (Boni 2007: abundant around Cu-sulfide bodies)', () => {
    const sim = runScenario('supergene_oxidation');
    expect(alive(sim, 'mottramite')).toBeGreaterThan(0);
  });
});
