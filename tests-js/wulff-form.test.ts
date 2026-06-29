// tests-js/wulff-form.test.ts — CENTRAL-DISTANCE (Wulff) FORM, Phase 4 rung 4a.1
// (2026-06-28; proposals/PROPOSAL-DIRECTIONAL-GROWTH-2026-06-22.md §1.1 + §2.3,
//  proposals/DESIGN-WULFF-PHASE-4-2026-06-28.md; kernel js/46 + fixture wulff-geometry.test.ts).
//
// The arc's DESTINATION: a crystal's external shape as the true convex polyhedron of its growing
// form faces, not a fixed primitive. js/45 classifyWulffForm tags fluorite with the {100}/{111}
// central-distance bias (crystal._wulffForm = { biasC, growthFrac, octahedral }); the renderer
// (js/99i) builds the polyhedron via the kernel (js/46 wulffFaceSetForMineral → _makeWulffGeom).
//
// The end-member (cube vs octahedron) is the PERSISTED habit grow_fluorite set from fluid.Y
// (>1 ppm REE → 'octahedral_REE' family; else 'cubic' family — Bosze & Rakovan 2002); the tag
// only sets the truncation degree. GATED on wall.wulff_fluorite — only sunnyside opts in, every
// other scenario dormant → byte-identical (cold-ci's calibration baseline is the hard byte-
// identity gate; _wulffForm never touches counts/sizes/chemistry, the token stays cube/octahedron
// so the size scale is unchanged, and biasC is a golden-ratio hash of crystal_id, NO rng). Pins:
//   (1) dormancy — elmwood (grows fluorite, did NOT opt in) tags nothing;
//   (2) the tag is absent (undefined) on untagged crystals (no serialized output widens);
//   (3) sunnyside (real opt-in) tags its Stage VI REE-fluorite octahedral, biasC in the oct range;
//   (4) tag is fluorite-SCOPED — no other mineral in the opted scenario is tagged;
//   (5) the tagged params build a real solid through the kernel (the render contract);
//   (6) determinism — two identical runs give byte-identical biasC (no rng);
//   (7) unit: the octahedral / cubic habit branches map to the right bias band;
//   (8) unit: non-fluorite, speck (<30 µm), twinned, and flag-off are all skipped.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const classifyWulffForm: any;
declare const wulffFaceSetForMineral: any;
declare const _makeWulffGeom: any;

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

const wulffed = (sim: any) => sim.crystals.filter((c: any) => c._wulffForm && !c.dissolved);

// minimal sim-shaped object for direct classifier unit tests
const mkSim = (flag: boolean, crystals: any[]) => ({ conditions: { wall: { wulff_fluorite: flag } }, crystals });
const mkCrystal = (over: any) => Object.assign({ mineral: 'fluorite', habit: 'octahedral_REE', total_growth_um: 200, crystal_id: 5, dissolved: false }, over);

describe('Wulff form tag (central-distance arc Phase 4 rung 4a.1)', () => {
  it('DORMANT for scenarios that did not opt in — elmwood grows fluorite but tags nothing', () => {
    const sim = run('elmwood');                          // stepped-cube fluorite showcase, no wulff flag
    expect(sim).toBeTruthy();
    expect(sim.crystals.some((c: any) => c.mineral === 'fluorite')).toBe(true);   // it DOES grow fluorite
    expect(wulffed(sim).length).toBe(0);                 // …but none is Wulff-tagged
  });

  it('the tag is ABSENT (undefined) on untagged crystals — no serialized output widens', () => {
    const sim = run('elmwood');
    expect(sim).toBeTruthy();
    for (const c of sim.crystals) expect(c._wulffForm).toBeUndefined();
  });

  it('sunnyside (wall.wulff_fluorite) tags its Stage VI REE-fluorite octahedral, biasC in the oct band', () => {
    const sim = run('sunnyside_american_tunnel');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'fluorite');
    expect(tagged.length).toBeGreaterThan(0);            // the octahedral REE-fluorite
    for (const c of tagged) {
      expect(c.habit.indexOf('octahedral')).toBeGreaterThanOrEqual(0);
      expect(c._wulffForm.octahedral).toBe(true);
      // octahedron-DOMINANT with small {100} truncations — the swept + eye-checked band [0.32, 0.52]
      expect(c._wulffForm.biasC).toBeGreaterThanOrEqual(0.32);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(0.52);
      expect(c._wulffForm.growthFrac).toBeGreaterThanOrEqual(0.15);
      expect(c._wulffForm.growthFrac).toBeLessThanOrEqual(1.0);
    }
  });

  it('tag is FLUORITE-scoped — no non-fluorite crystal in the opted scenario is Wulff-tagged', () => {
    const sim = run('sunnyside_american_tunnel');
    expect(sim).toBeTruthy();
    for (const c of wulffed(sim)) expect(c.mineral).toBe('fluorite');
  });

  it('the tagged params build a real solid through the kernel (the render contract)', () => {
    const sim = run('sunnyside_american_tunnel');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'fluorite');
    expect(tagged.length).toBeGreaterThan(0);
    for (const c of tagged) {
      const faces = wulffFaceSetForMineral('fluorite', c._wulffForm.growthFrac, 0, c._wulffForm.biasC);
      expect(_makeWulffGeom(faces)).toBeTruthy();         // a degenerate clamp here would null-fallback in the renderer
    }
  });

  it('determinism — two identical runs produce byte-identical biasC (no rng)', () => {
    const a = run('sunnyside_american_tunnel');
    const b = run('sunnyside_american_tunnel');
    const fa = wulffed(a).map((c: any) => `${c.crystal_id}:${c._wulffForm.biasC}`).sort();
    const fb = wulffed(b).map((c: any) => `${c.crystal_id}:${c._wulffForm.biasC}`).sort();
    expect(fa.length).toBeGreaterThan(0);
    expect(fa).toEqual(fb);
  });

  it('unit — octahedral habit → octahedral bias band (<1, [0.32,0.52]); cubic habit → cube band (>1)', () => {
    const oct = mkCrystal({ habit: 'octahedral_REE', crystal_id: 5 });
    const cube = mkCrystal({ habit: 'cubic', crystal_id: 5 });
    classifyWulffForm(mkSim(true, [oct]));
    classifyWulffForm(mkSim(true, [cube]));
    expect(oct._wulffForm.octahedral).toBe(true);
    expect(oct._wulffForm.biasC).toBeGreaterThanOrEqual(0.32);
    expect(oct._wulffForm.biasC).toBeLessThanOrEqual(0.52);
    expect(cube._wulffForm.octahedral).toBe(false);
    expect(cube._wulffForm.biasC).toBeGreaterThan(1.0);   // biasC>1 slows {100} → cube
    // the σ-graded renames still read as octahedral
    const stepped = mkCrystal({ habit: 'stepped_octahedral_REE', crystal_id: 9 });
    classifyWulffForm(mkSim(true, [stepped]));
    expect(stepped._wulffForm.octahedral).toBe(true);
  });

  it('unit — flag-off, non-fluorite, speck (<30 µm), and twinned are all skipped', () => {
    const offFlag = mkCrystal({});
    classifyWulffForm(mkSim(false, [offFlag]));
    expect(offFlag._wulffForm).toBeUndefined();           // opt-in gate

    const notFluorite = mkCrystal({ mineral: 'galena' });
    const speck = mkCrystal({ total_growth_um: 10 });
    const twin = mkCrystal({ twinned: true, twin_law: 'penetration' });
    classifyWulffForm(mkSim(true, [notFluorite, speck, twin]));
    expect(notFluorite._wulffForm).toBeUndefined();       // tenant is fluorite only
    expect(speck._wulffForm).toBeUndefined();             // need a body to read a form on
    expect(twin._wulffForm).toBeUndefined();              // the penetration twin owns its own geometry
  });
});
