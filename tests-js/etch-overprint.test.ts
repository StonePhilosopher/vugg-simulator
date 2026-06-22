// tests-js/etch-overprint.test.ts — the POST-GROWTH ETCH overprint (crystal-face-realism
// arc §2, 2026-06-22). Etching (rounded edges/corners, frosted faces — the dissolved/
// etched habit) is imposed on a FINISHED crystal by a later UNDERSATURATED fluid, the
// same post-growth-overprint shape as the deformation/bent mechanic — NOT a passive read
// of accidental resorption (the etch-pit-probe census proved the engine's dissolution is
// binary: survive ~intact or fully dissolve + drop from the scene, so there is no
// substantially-etched-survivor population to read).
//
// A scenario event carries an `etch` directive {amount,minerals,style}; apply_events
// (js/85d) records it on sim._etchEvents WITH the step it fired; classifyEtch (js/45)
// tags surviving crystals that had ALREADY grown by that step with crystal._etch; js/99i
// _makeEtchedCube rounds the cube + frosts the material. PURE tagging (no fluid/T change)
// → byte-identical fleet (the v208 deformation precedent).
//
// Pins: reactivated_fluorite_vein's breach (step 118) etches the gen-1 fluorite + galena;
// the tag is well-formed (amount in range, atStep = 118); crystals that grew AFTER the
// breach (gen-2) are NOT etched; a scenario with no etch directive tags nothing (no-op).

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

const etched = (sim: any) =>
  sim.crystals.filter((c: any) => c._etch && !c.dissolved);

const firstGrowthStep = (c: any) => {
  for (const z of (c.zones || [])) { if ((z.thickness_um || 0) > 0) return z.step; }
  return null;
};

describe('post-growth etch overprint (reactivated fluorite vein)', () => {
  it('the breach etches gen-1 fluorite + galena cubes — tagged + well-formed', () => {
    const sim = run('reactivated_fluorite_vein', 42);
    expect(sim).toBeTruthy();
    const hit = etched(sim);
    expect(hit.length).toBeGreaterThan(0);
    const minerals = new Set(hit.map((c: any) => c.mineral));
    expect(minerals.has('fluorite')).toBe(true);   // the iconic etched-vein mineral
    for (const c of hit) {
      expect(c._etch.atStep).toBe(118);             // the breach event step
      expect(c._etch.amount).toBeGreaterThan(0);
      expect(c._etch.amount).toBeLessThanOrEqual(1);
    }
  });

  it('only crystals that grew BEFORE the breach are etched (gen-2 is spared)', () => {
    const sim = run('reactivated_fluorite_vein', 42);
    for (const c of etched(sim)) {
      const fs = firstGrowthStep(c);
      expect(fs).not.toBeNull();
      expect(fs).toBeLessThan(118);                 // existed to be corroded
    }
    // any crystal that first grew at/after the breach must NOT be etched
    const lateGrown = sim.crystals.filter((c: any) => {
      const fs = firstGrowthStep(c);
      return fs != null && fs >= 118;
    });
    for (const c of lateGrown) expect(!!c._etch).toBe(false);
  });

  it('a scenario with no etch directive tags nothing (no-op → byte-identical fleet)', () => {
    const sim = run('mvt', 42);                     // an mvt-analog vein, no etch directive
    expect(sim).toBeTruthy();
    expect(etched(sim).length).toBe(0);
    expect(sim._etchEvents == null || sim._etchEvents.length === 0).toBe(true);
  });
});
