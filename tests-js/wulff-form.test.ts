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
declare const wulffWulfenitePbMoBias: any;
declare const WULFENITE_PBMO: any;

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
const mkSimC = (flag: boolean, crystals: any[]) => ({ conditions: { wall: { wulff_calcite: flag } }, crystals });
const mkSimW = (flag: boolean, crystals: any[]) => ({ conditions: { wall: { wulff_wulfenite: flag } }, crystals });
const mkSimB = (flag: boolean, crystals: any[]) => ({ conditions: { wall: { wulff_barite: flag } }, crystals });
const mkSimG = (flag: boolean, crystals: any[]) => ({ conditions: { wall: { wulff_galena: flag } }, crystals });
const mkSimT = (flag: boolean, crystals: any[]) => ({ conditions: { wall: { wulff_titanite: flag } }, crystals });
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
      // octahedron-DOMINANT with small {100} truncations — the band [0.38,0.46], re-placed at
      // earned g (rung 4a.8; the old [0.32,0.52] low half collapsed to a PERFECT octahedron at g=1)
      expect(c._wulffForm.biasC).toBeGreaterThanOrEqual(0.38);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(0.46);
      expect(c._wulffForm.growthFrac).toBeGreaterThanOrEqual(0.15);
      expect(c._wulffForm.growthFrac).toBeLessThanOrEqual(1.0);
      // rung 4a.8 — growthFrac is LIVE, not frozen at the ~30µm tag step: a fully-grown crystal
      // (≥250µm) must render fully developed (the census hero: 1095µm, frozen g was 0.15)
      if ((c.total_growth_um || 0) >= 250) expect(c._wulffForm.growthFrac).toBe(1.0);
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

  it('unit — octahedral habit → octahedral bias band (<1, [0.38,0.46]); cubic habit → cube band (>1)', () => {
    const oct = mkCrystal({ habit: 'octahedral_REE', crystal_id: 5 });
    const cube = mkCrystal({ habit: 'cubic', crystal_id: 5 });
    classifyWulffForm(mkSim(true, [oct]));
    classifyWulffForm(mkSim(true, [cube]));
    expect(oct._wulffForm.octahedral).toBe(true);
    expect(oct._wulffForm.biasC).toBeGreaterThanOrEqual(0.38);
    expect(oct._wulffForm.biasC).toBeLessThanOrEqual(0.46);
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

// rung 4a.2 — the calcite tenant (the first NON-cubic Wulff tenant). Same opt-in/byte-identity
// contract as fluorite; the {104} rhombohedron↔{21-31} scalenohedron habit knob is the new piece.
describe('Wulff form tag — calcite tenant (rung 4a.2)', () => {
  it('DORMANT — marble grows scalenohedral calcite but did NOT opt in → tags nothing', () => {
    const sim = run('marble_contact_metamorphism');
    expect(sim).toBeTruthy();
    expect(sim.crystals.some((c: any) => c.mineral === 'calcite')).toBe(true);   // it DOES grow calcite
    expect(sim.crystals.filter((c: any) => c.mineral === 'calcite' && c._wulffForm).length).toBe(0);
  });

  it('mvt (wall.wulff_calcite) tags its scalenohedral calcite as a dogtooth, biasC in the scaleno band', () => {
    const sim = run('mvt');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'calcite');
    expect(tagged.length).toBeGreaterThan(0);
    for (const c of tagged) {
      expect(c.habit.indexOf('scaleno')).toBeGreaterThanOrEqual(0);
      expect(c._wulffForm.scaleno).toBe(true);
      // dogtooth band [0.15,0.26] (eye-checked: sharp scalenohedron termination, not a stubby block)
      expect(c._wulffForm.biasC).toBeGreaterThanOrEqual(0.15);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(0.26);
      expect(_makeWulffGeom(wulffFaceSetForMineral('calcite', c._wulffForm.growthFrac, 0, c._wulffForm.biasC))).toBeTruthy();
    }
  });

  it('mvt tenant scoping — calcite is tagged (4a.2); since 4a.5 galena is too, but fluorite/sphalerite/barite are NOT', () => {
    // mvt opts in BOTH wulff_calcite (4a.2) and wulff_galena (4a.5) → a two-tenant druse. The scope
    // check: calcite fires, and every tagged crystal is one of {calcite, galena} — its fluorite,
    // sphalerite and barite (none opted in) stay dormant.
    const sim = run('mvt');
    const tagged = wulffed(sim);
    expect(tagged.some((c: any) => c.mineral === 'calcite')).toBe(true);
    for (const c of tagged) expect(['calcite', 'galena']).toContain(c.mineral);
  });

  it('unit — scalenohedral habit → scaleno band (<1, dogtooth); rhombohedral → nailhead band (>1)', () => {
    const sca = mkCrystal({ mineral: 'calcite', habit: 'scalenohedral', crystal_id: 5 });
    const rho = mkCrystal({ mineral: 'calcite', habit: 'rhombohedral', crystal_id: 5 });
    classifyWulffForm(mkSimC(true, [sca]));
    classifyWulffForm(mkSimC(true, [rho]));
    expect(sca._wulffForm.scaleno).toBe(true);
    expect(sca._wulffForm.biasC).toBeLessThan(0.30);     // scalenohedron comes in (biasC<1)
    expect(rho._wulffForm.scaleno).toBe(false);
    expect(rho._wulffForm.biasC).toBeGreaterThan(1.0);   // rhombohedron dominates (nailhead)
  });

  it('unit — the wulff_calcite flag is independent of wulff_fluorite (a calcite crystal needs the calcite flag)', () => {
    const cal = mkCrystal({ mineral: 'calcite', habit: 'scalenohedral', crystal_id: 7 });
    classifyWulffForm(mkSim(true, [cal]));                // only wulff_fluorite on
    expect(cal._wulffForm).toBeUndefined();              // calcite stays dormant under the fluorite flag
    classifyWulffForm(mkSimC(true, [cal]));              // now wulff_calcite on
    expect(cal._wulffForm).toBeTruthy();
  });
});

// rung 4a.3 — the wulfenite tenant (the THIRD crystal system, tetragonal 4/m). grow_wulfenite
// hardcodes habit='tabular' (no habit split for the classifier to read). rung 4a.7 (2026-07-01)
// retired the per-crystal hash for this tenant: biasC is now the EARNED Pb:Mo lever — B(⟨r⟩) from
// the crystal's growth-weighted molar Pb:Mo integral (js/45 WULFENITE_PBMO; Sci. Rep. 14 (2024),
// DOI 10.1038/s41598-024-60043-4 — Mo-rich r<1 → {001} tabular, Pb-rich r>1 → {101} bipyramid).
// supergene_oxidation is the ONLY scenario that grows wulfenite (so it carries the opt-in);
// dormancy is pinned by the flag-off + cross-flag unit tests rather than a grows-but-not-opted scenario.
describe('Wulff form tag — wulfenite tenant (rung 4a.3 + 4a.7)', () => {
  it('supergene_oxidation tags its tabular wulfenite; biasC IS the earned Pb:Mo integral (4a.7), not the hash', () => {
    const sim = run('supergene_oxidation');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'wulfenite');
    expect(tagged.length).toBeGreaterThan(0);            // the honey plate — now a THICK Tsumeb tablet
    for (const c of tagged) {
      expect(c._wulffForm.tabular).toBe(true);
      // the growth integral exists and covers (essentially) the whole growth history
      expect(c._wulffPbMo).toBeTruthy();
      expect(c._wulffPbMo.G).toBeGreaterThan(c.total_growth_um * 0.95);
      // seed-42 water story: core r=1.852 (pre-pulse) → rim r=1.158 → integrates to ≈1.25
      // (wulfenite-pbmo probe 2026-07-01; cross-seed CV 0.8%, so the window is generous)
      const rInt = c._wulffPbMo.rG / c._wulffPbMo.G;
      expect(rInt).toBeGreaterThan(1.15);
      expect(rInt).toBeLessThan(1.35);
      // biasC IS B(⟨r⟩) — the lever exactly, no hash residue…
      expect(c._wulffForm.biasC).toBeCloseTo(wulffWulfenitePbMoBias(rInt), 10);
      // …landing near the Tsumeb pin (stout tablet), OUTSIDE the retired hash band [1.4,2.8]
      expect(c._wulffForm.biasC).toBeGreaterThan(0.9);
      expect(c._wulffForm.biasC).toBeLessThan(1.15);
      // and growthFrac is UN-frozen: a >10mm hero is fully developed, not stuck at tag-step g≈0.21
      expect(c._wulffForm.growthFrac).toBe(1.0);
      expect(_makeWulffGeom(wulffFaceSetForMineral('wulfenite', c._wulffForm.growthFrac, 0, c._wulffForm.biasC))).toBeTruthy();
    }
  });

  it('supergene_oxidation tenant scoping — only wulfenite is Wulff-tagged, though many other species grow', () => {
    const sim = run('supergene_oxidation');
    // the scenario grows a rich oxidation assemblage (smithsonite, mimetite, malachite, …); none of
    // those — nor calcite/fluorite, the OTHER Wulff-registered minerals — may be tagged under the
    // wulfenite-only flag. The size assert makes the scope check non-vacuous (a real multi-mineral run).
    const species = new Set(sim.crystals.filter((c: any) => !c.dissolved).map((c: any) => c.mineral));
    expect(species.size).toBeGreaterThan(3);
    for (const c of wulffed(sim)) expect(c.mineral).toBe('wulfenite');
  });

  it('unit — tabular wulfenite with no growth history → the Tsumeb fallback pin (hash-free); flag-off / twinned / speck are skipped', () => {
    const tab = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', crystal_id: 5 });
    classifyWulffForm(mkSimW(true, [tab]));
    expect(tab._wulffForm.tabular).toBe(true);
    // no zones → no integral → B(R_TSUMEB) = the Tsumeb pin, deterministic for EVERY crystal_id
    expect(tab._wulffForm.biasC).toBeCloseTo(WULFENITE_PBMO.BIAS_TSUMEB, 10);

    const off = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', crystal_id: 5 });
    classifyWulffForm(mkSimW(false, [off]));
    expect(off._wulffForm).toBeUndefined();              // opt-in gate

    // a twinned wulfenite keeps its OWN geometry (the {001} tabular-on-tabular twin), and a sub-30µm
    // speck has no body to read a form on — neither may be Wulff-tagged (mirrors the fluorite skips).
    const twin = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', twinned: true, crystal_id: 5 });
    const speck = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', total_growth_um: 10, crystal_id: 5 });
    classifyWulffForm(mkSimW(true, [twin, speck]));
    expect(twin._wulffForm).toBeUndefined();             // the twin owns its geometry
    expect(speck._wulffForm).toBeUndefined();            // need a body to read a form on
  });

  it('unit — the wulff_wulfenite flag is independent of the fluorite/calcite flags', () => {
    const wulf = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', crystal_id: 7 });
    classifyWulffForm(mkSim(true, [wulf]));              // only wulff_fluorite on
    expect(wulf._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimC(true, [wulf]));             // only wulff_calcite on
    expect(wulf._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimW(true, [wulf]));             // now wulff_wulfenite on
    expect(wulf._wulffForm).toBeTruthy();
    expect(wulf._wulffForm.tabular).toBe(true);
  });
});

// rung 4a.7 — the Pb:Mo HABIT LEVER law + live growth integral (the first EARNED form; the
// id-hash retired for the wulfenite tenant). B(r) = BIAS_TSUMEB·(R_TSUMEB/r) clamped [0.55,2.8]:
// direction from Sci. Rep. 14 (2024) DOI 10.1038/s41598-024-60043-4 (Pb-rich → {101} bipyramid,
// Mo-rich → {001} thin plate), magnitudes sim-scale calibrated (g=1.0 kernel sweep 2026-07-01).
describe('wulfenite Pb:Mo habit lever (rung 4a.7)', () => {
  it('B(r) law — both calibration pins, the paper direction (monotone decreasing), both clamps', () => {
    expect(wulffWulfenitePbMoBias(1.25)).toBeCloseTo(1.0, 10);   // pin 1: Tsumeb integrated ⟨r⟩ → the stout tablet
    expect(wulffWulfenitePbMoBias(0.5)).toBeCloseTo(2.5, 10);    // pin 2: Mo-rich water → the thin plate (aspect ~6)
    expect(wulffWulfenitePbMoBias(0.8)).toBeGreaterThan(wulffWulfenitePbMoBias(1.0));   // Pb-richer → blockier, always
    expect(wulffWulfenitePbMoBias(1.0)).toBeGreaterThan(wulffWulfenitePbMoBias(1.5));
    expect(wulffWulfenitePbMoBias(0.05)).toBe(WULFENITE_PBMO.MAX);   // extreme Mo-rich clamps at the thin end
    expect(wulffWulfenitePbMoBias(50)).toBe(WULFENITE_PBMO.MIN);     // extreme Pb-rich floors while still 'tabular' — the bipyramid flip is Depth-B
  });

  it('the molar ratio of the seed-42 broth (Pb 60 / Mo 15 ppm) is 1.852 — the probe core-water value', () => {
    const r = (60 / WULFENITE_PBMO.M_PB) / (15 / WULFENITE_PBMO.M_MO);
    expect(r).toBeCloseTo(1.852, 3);
  });

  it('live integral — a two-water history integrates growth-weighted; biasC + growthFrac update in place after tag', () => {
    const r1 = (60 / WULFENITE_PBMO.M_PB) / (15 / WULFENITE_PBMO.M_MO);    // Pb-rich core water, 1.852
    const r2 = (100 / WULFENITE_PBMO.M_PB) / (40 / WULFENITE_PBMO.M_MO);   // near-balanced rim water, 1.158
    const c = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', crystal_id: 5, total_growth_um: 40,
      zones: [{ step: 3, thickness_um: 40 }] });
    const water = (Pb: number, Mo: number, step: number) =>
      ({ step, conditions: { wall: { wulff_wulfenite: true }, fluid: { Pb, Mo } }, crystals: [c] });
    classifyWulffForm(water(60, 15, 3));                 // grows 40µm in the core water, tags this step
    expect(c._wulffPbMo.G).toBe(40);
    expect(c._wulffForm.biasC).toBeCloseTo(wulffWulfenitePbMoBias(r1), 10);   // tag reads the integral so far
    c.zones.push({ step: 9, thickness_um: 60 });         // then 60µm in the post-pulse water
    c.total_growth_um = 100;
    classifyWulffForm(water(100, 40, 9));
    expect(c._wulffPbMo.G).toBe(100);
    const rInt = c._wulffPbMo.rG / c._wulffPbMo.G;
    expect(rInt).toBeCloseTo((r1 * 40 + r2 * 60) / 100, 10);                  // the growth-weighted mean
    expect(c._wulffForm.biasC).toBeCloseTo(wulffWulfenitePbMoBias(rInt), 10); // LIVE update — not frozen at tag
    expect(c._wulffForm.growthFrac).toBeCloseTo(100 / 250, 10);               // g un-froze too (was locked at tag-time)
  });

  it('the integral skips dissolution steps and non-growth steps (thickness ≤ 0 or a stale zone)', () => {
    const c = mkCrystal({ mineral: 'wulfenite', habit: 'tabular', crystal_id: 5, total_growth_um: 40,
      zones: [{ step: 3, thickness_um: 40 }] });
    const water = (Pb: number, Mo: number, step: number) =>
      ({ step, conditions: { wall: { wulff_wulfenite: true }, fluid: { Pb, Mo } }, crystals: [c] });
    classifyWulffForm(water(60, 15, 3));
    expect(c._wulffPbMo.G).toBe(40);
    c.zones.push({ step: 7, thickness_um: -3 });         // acid dissolution zone — must NOT enter
    classifyWulffForm(water(60, 15, 7));
    expect(c._wulffPbMo.G).toBe(40);
    classifyWulffForm(water(60, 15, 12));                // no zone this step (stale last zone) — must NOT enter
    expect(c._wulffPbMo.G).toBe(40);
  });
});

// rung 4a.4 — the barite tenant (the FOURTH crystal system, orthorhombic mmm). barite's habit is
// σ-driven; ONLY tabular + bladed (token 'tablet') become the Wulff RECTANGULAR plate, so the
// classifier reads the habit string: BLADED (the Cumberland/Wittichen divergent vein blade) gets a
// thinner band [1.9,3.0] than flat TABULAR [1.3,2.2]. wittichen is the ONLY scenario that opts barite
// in; its late-stage (wittichen_meteoric_sulfate) barite grows bladed. The a≠b rectangle is a kernel
// property (wulff-geometry.test.ts), not a classifier one.
describe('Wulff form tag — barite tenant (rung 4a.4)', () => {
  it('wittichen (wall.wulff_barite) tags its bladed vein barite, biasC in the bladed band', () => {
    const sim = run('wittichen');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'barite');
    expect(tagged.length).toBeGreaterThan(0);            // the late-oxidation bladed barite
    for (const c of tagged) {
      expect(c._wulffForm.tabular).toBe(true);           // tabular-family plate (signals the diameter scale)
      // bladed band [1.9,3.0] (aspect ≈ 4.5–6.9 — a thin divergent blade; from the orthorhombic sweep)
      expect(c._wulffForm.biasC).toBeGreaterThanOrEqual(1.9);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(3.0);
      expect(_makeWulffGeom(wulffFaceSetForMineral('barite', c._wulffForm.growthFrac, 0, c._wulffForm.biasC))).toBeTruthy();
    }
  });

  it('wittichen tenant scoping — only barite is Wulff-tagged, though calcite (a registered tenant) also grows there', () => {
    const sim = run('wittichen');
    // the five-element vein grows a rich assemblage (skutterudite, nickeline, native bismuth/silver,
    // proustite, CALCITE, aragonite, …); calcite is itself a Wulff-registered mineral, so under the
    // barite-only flag it must STAY untagged — a strong, non-vacuous scope check.
    const species = new Set(sim.crystals.filter((c: any) => !c.dissolved).map((c: any) => c.mineral));
    expect(species.size).toBeGreaterThan(3);
    expect(sim.crystals.some((c: any) => c.mineral === 'calcite')).toBe(true);   // the foil is present
    for (const c of wulffed(sim)) expect(c.mineral).toBe('barite');
  });

  // NOTE: the bands OVERLAP in [1.9,2.2] by design (a thin tabular and a thick blade can land at similar
  // thickness); the invariant is the PER-CRYSTAL ordering — at a fixed crystal_id (same golden-ratio
  // jitter) bladed always lands thinner than tabular. That's what the final assert pins.
  it('unit — bladed barite → bladed band [1.9,3.0]; tabular → tabular band [1.3,2.2]; at a fixed id, bladed is thinner', () => {
    const bla = mkCrystal({ mineral: 'barite', habit: 'bladed', crystal_id: 5 });
    const tab = mkCrystal({ mineral: 'barite', habit: 'tabular', crystal_id: 5 });
    classifyWulffForm(mkSimB(true, [bla]));
    classifyWulffForm(mkSimB(true, [tab]));
    expect(bla._wulffForm.bladed).toBe(true);
    expect(bla._wulffForm.tabular).toBe(true);
    expect(bla._wulffForm.biasC).toBeGreaterThanOrEqual(1.9);
    expect(bla._wulffForm.biasC).toBeLessThanOrEqual(3.0);
    expect(tab._wulffForm.bladed).toBe(false);
    expect(tab._wulffForm.tabular).toBe(true);
    expect(tab._wulffForm.biasC).toBeGreaterThanOrEqual(1.3);
    expect(tab._wulffForm.biasC).toBeLessThanOrEqual(2.2);
    expect(bla._wulffForm.biasC).toBeGreaterThan(tab._wulffForm.biasC);   // bladed is thinner (higher biasC)
  });

  it('unit — flag-off / twinned (cockscomb) / speck barite are skipped', () => {
    const off = mkCrystal({ mineral: 'barite', habit: 'bladed', crystal_id: 5 });
    classifyWulffForm(mkSimB(false, [off]));
    expect(off._wulffForm).toBeUndefined();              // opt-in gate

    // cockscomb barite is a CYCLIC TWIN (it owns its own crested geometry) and a sub-30µm speck has no
    // body to read a form on — neither may be Wulff-tagged.
    const twin = mkCrystal({ mineral: 'barite', habit: 'cockscomb', twinned: true, crystal_id: 5 });
    const speck = mkCrystal({ mineral: 'barite', habit: 'bladed', total_growth_um: 10, crystal_id: 5 });
    classifyWulffForm(mkSimB(true, [twin, speck]));
    expect(twin._wulffForm).toBeUndefined();             // the cyclic twin owns its geometry
    expect(speck._wulffForm).toBeUndefined();            // need a body to read a form on
  });

  it('unit — the wulff_barite flag is independent of the fluorite/calcite/wulfenite flags', () => {
    const bar = mkCrystal({ mineral: 'barite', habit: 'bladed', crystal_id: 7 });
    classifyWulffForm(mkSim(true, [bar]));               // only wulff_fluorite on
    expect(bar._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimC(true, [bar]));              // only wulff_calcite on
    expect(bar._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimW(true, [bar]));              // only wulff_wulfenite on
    expect(bar._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimB(true, [bar]));              // now wulff_barite on
    expect(bar._wulffForm).toBeTruthy();
    expect(bar._wulffForm.bladed).toBe(true);
  });
});

// rung 4a.5 — the galena tenant (the SECOND cubic tenant, a fleet-out — no new kernel). grow_galena
// hardcodes habit='cubic', so the classifier gives it a cube-DOMINANT band that keeps the {111}
// corner truncations visible (NOT a perfect cube = no-op). mvt opts BOTH calcite (4a.2) AND galena
// in → a two-tenant Wulff druse (golden dogtooth calcite + lead-grey truncated cubes), the canonical
// MVT specimen.
describe('Wulff form tag — galena tenant (rung 4a.5, cubic fleet-out)', () => {
  it('mvt (wall.wulff_galena) tags its cube galena, biasC in the truncated-cube band, octahedral false', () => {
    const sim = run('mvt');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'galena');
    expect(tagged.length).toBeGreaterThan(0);            // the lead-grey cubes
    for (const c of tagged) {
      expect(c._wulffForm.octahedral).toBe(false);       // galena never goes octahedron-dominant
      // band [0.88,1.02] — cube with visible {111} corner truncations (NOT a perfect-cube no-op);
      // re-placed at earned g (rung 4a.8: the old [1.0,1.15] hi edge cut corners at depth 0.03
      // at g=1.0 — a near-perfect cube)
      expect(c._wulffForm.biasC).toBeGreaterThanOrEqual(0.88);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(1.02);
      expect(_makeWulffGeom(wulffFaceSetForMineral('galena', c._wulffForm.growthFrac, 0, c._wulffForm.biasC))).toBeTruthy();
      // rung 4a.8 — the mvt cubes are fully grown (census: 4571-5156µm) → live g, not the tag-step ~0.7
      if ((c.total_growth_um || 0) >= 250) expect(c._wulffForm.growthFrac).toBe(1.0);
    }
  });

  it('mvt is a TWO-tenant druse — exactly calcite + galena are tagged (sphalerite/fluorite/barite are NOT)', () => {
    const sim = run('mvt');
    const tagged = wulffed(sim);
    const species = new Set(tagged.map((c: any) => c.mineral));
    expect(species.has('galena')).toBe(true);            // the new tenant
    expect(species.has('calcite')).toBe(true);           // the existing 4a.2 tenant still fires
    for (const c of tagged) expect(['calcite', 'galena']).toContain(c.mineral);   // and NOTHING else
  });

  it('unit — cubic galena → cube band [0.88,1.02], octahedral always false; flag-off / twinned (spinel) / speck skip', () => {
    const cube = mkCrystal({ mineral: 'galena', habit: 'cubic', crystal_id: 5 });
    classifyWulffForm(mkSimG(true, [cube]));
    expect(cube._wulffForm.octahedral).toBe(false);
    expect(cube._wulffForm.biasC).toBeGreaterThanOrEqual(0.88);
    expect(cube._wulffForm.biasC).toBeLessThanOrEqual(1.02);

    const off = mkCrystal({ mineral: 'galena', habit: 'cubic', crystal_id: 5 });
    classifyWulffForm(mkSimG(false, [off]));
    expect(off._wulffForm).toBeUndefined();              // opt-in gate

    // a spinel-law-twinned galena owns its own twin geometry, and a sub-30µm speck has no body —
    // neither may be Wulff-tagged.
    const twin = mkCrystal({ mineral: 'galena', habit: 'cubic', twinned: true, crystal_id: 5 });
    const speck = mkCrystal({ mineral: 'galena', habit: 'cubic', total_growth_um: 10, crystal_id: 5 });
    classifyWulffForm(mkSimG(true, [twin, speck]));
    expect(twin._wulffForm).toBeUndefined();
    expect(speck._wulffForm).toBeUndefined();
  });

  it('unit — the wulff_galena flag is independent of the fluorite/calcite/wulfenite/barite flags', () => {
    const gal = mkCrystal({ mineral: 'galena', habit: 'cubic', crystal_id: 7 });
    classifyWulffForm(mkSim(true, [gal]));               // only wulff_fluorite on
    expect(gal._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimC(true, [gal]));              // only wulff_calcite on
    expect(gal._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimB(true, [gal]));              // only wulff_barite on
    expect(gal._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimG(true, [gal]));              // now wulff_galena on
    expect(gal._wulffForm).toBeTruthy();
    expect(gal._wulffForm.octahedral).toBe(false);
  });
});

// rung 4a.6 — the titanite tenant (the FIFTH crystal system, monoclinic 2/m). grimsel_alpine_cleft grows
// wedge titanite late on the smoky quartz (the alpine-cleft suite). All titanite habits (sphenoid_wedge /
// prismatic / flattened_tabular) opt into the one monoclinic WEDGE body; the band [1.3,2.3] sets how
// flattened-on-{100} the wedge is, and the β-lean ({100}∧{001}=66.19°) is in the FACES, invariant of
// biasC. grimsel's seed-42 titanite grows flattened_tabular on the cooling tail (token 'tablet') — its
// LIVE growthFrac (rung 4a.8: 0.15 young → 1.0 grown) MUST build a real wedge at every point on that
// path (these pins guard against the hex-prism fallback).
describe('Wulff form tag — titanite tenant (rung 4a.6, monoclinic)', () => {
  it('grimsel_alpine_cleft (wall.wulff_titanite) tags its wedge titanite, biasC in band + wedge flag, and builds a real solid at its live growthFrac', () => {
    const sim = run('grimsel_alpine_cleft');
    expect(sim).toBeTruthy();
    const tagged = wulffed(sim).filter((c: any) => c.mineral === 'titanite');
    expect(tagged.length).toBeGreaterThan(0);            // the alpine-cleft wedges survive to the final frame
    for (const c of tagged) {
      expect(c._wulffForm.wedge).toBe(true);
      expect(c._wulffForm.biasC).toBeGreaterThanOrEqual(1.3);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(2.3);
      // the render contract: the tag must build a non-degenerate wedge at ITS OWN live growthFrac —
      // else the renderer silently falls back to the old hex prism (the no-op trap).
      expect(_makeWulffGeom(wulffFaceSetForMineral('titanite', c._wulffForm.growthFrac, 0, c._wulffForm.biasC))).toBeTruthy();
      // rung 4a.8 — grimsel's wedges are fully grown (census: 610-945µm) → live g=1.0, not the frozen 0.15
      if ((c.total_growth_um || 0) >= 250) expect(c._wulffForm.growthFrac).toBe(1.0);
    }
  });

  it('grimsel tenant scoping — only titanite is Wulff-tagged, though fluorite + calcite (registered tenants) also grow there', () => {
    // grimsel sets ONLY wulff_titanite; its fluorite and calcite are registered Wulff tenants too, but with
    // their flags OFF they must STAY untagged — a strong, non-vacuous scope check.
    const sim = run('grimsel_alpine_cleft');
    const tagged = wulffed(sim);
    expect(tagged.length).toBeGreaterThan(0);
    for (const c of tagged) expect(c.mineral).toBe('titanite');
  });

  it('unit — titanite → wedge band [1.3,2.3] + wedge flag; octahedral/scaleno/tabular/bladed all false', () => {
    const ti = mkCrystal({ mineral: 'titanite', habit: 'sphenoid_wedge', crystal_id: 5 });
    classifyWulffForm(mkSimT(true, [ti]));
    expect(ti._wulffForm.wedge).toBe(true);
    expect(ti._wulffForm.biasC).toBeGreaterThanOrEqual(1.3);
    expect(ti._wulffForm.biasC).toBeLessThanOrEqual(2.3);
    expect(ti._wulffForm.octahedral).toBe(false);
    expect(ti._wulffForm.scaleno).toBe(false);
    expect(ti._wulffForm.tabular).toBe(false);
    expect(ti._wulffForm.bladed).toBe(false);
  });

  it('unit — flag-off / twinned / speck titanite are skipped', () => {
    const off = mkCrystal({ mineral: 'titanite', habit: 'sphenoid_wedge', crystal_id: 5 });
    classifyWulffForm(mkSimT(false, [off]));
    expect(off._wulffForm).toBeUndefined();              // opt-in gate

    const twin = mkCrystal({ mineral: 'titanite', habit: 'sphenoid_wedge', twinned: true, crystal_id: 5 });
    const speck = mkCrystal({ mineral: 'titanite', habit: 'sphenoid_wedge', total_growth_um: 10, crystal_id: 5 });
    classifyWulffForm(mkSimT(true, [twin, speck]));
    expect(twin._wulffForm).toBeUndefined();
    expect(speck._wulffForm).toBeUndefined();
  });

  it('unit — the wulff_titanite flag is independent of the fluorite/barite flags', () => {
    const ti = mkCrystal({ mineral: 'titanite', habit: 'sphenoid_wedge', crystal_id: 7 });
    classifyWulffForm(mkSim(true, [ti]));                // only wulff_fluorite on
    expect(ti._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimB(true, [ti]));              // only wulff_barite on
    expect(ti._wulffForm).toBeUndefined();
    classifyWulffForm(mkSimT(true, [ti]));              // now wulff_titanite on
    expect(ti._wulffForm).toBeTruthy();
    expect(ti._wulffForm.wedge).toBe(true);
  });
});

// rung 4a.8 — the frozen-g retirement, FLEET-WIDE (2026-07-02). The 4a.7 wulfenite pattern
// generalized: growthFrac re-derives from the CURRENT growth scalar on every classify pass, so a
// crystal's rendered body matures as it grows instead of freezing at its ~30µm tag-step form
// (frozen-g census: fluorite hero rendered g=0.15 with 1095µm earned; titanite 0.15 vs 1.0;
// barite 0.15 vs 0.64; galena ~0.7 vs 1.0). biasC stays TAG-FIXED for the hash tenants (only
// wulfenite's is live — the 4a.7 Pb:Mo integral); growthFrac is the only live field here.
describe('Wulff growthFrac is live, fleet-wide (rung 4a.8)', () => {
  it('a tagged crystal that keeps growing re-derives growthFrac on the next pass; biasC stays tag-fixed', () => {
    const gal = mkCrystal({ mineral: 'galena', habit: 'cubic', crystal_id: 5, total_growth_um: 50 });
    classifyWulffForm(mkSimG(true, [gal]));              // tags at 50µm → g = 0.2
    expect(gal._wulffForm.growthFrac).toBeCloseTo(50 / 250, 10);
    const biasAtTag = gal._wulffForm.biasC;
    gal.total_growth_um = 180;                           // grows on
    classifyWulffForm(mkSimG(true, [gal]));
    expect(gal._wulffForm.growthFrac).toBeCloseTo(180 / 250, 10);   // LIVE — the freeze is retired
    gal.total_growth_um = 400;                           // past the 250µm envelope
    classifyWulffForm(mkSimG(true, [gal]));
    expect(gal._wulffForm.growthFrac).toBe(1.0);         // clamps at fully-developed
    expect(gal._wulffForm.biasC).toBe(biasAtTag);        // the hash bias does NOT wander
  });

  it('the live re-derivation floors at 0.15 and never exceeds 1.0 (the kernel envelope)', () => {
    const ti = mkCrystal({ mineral: 'titanite', habit: 'sphenoid_wedge', crystal_id: 9, total_growth_um: 31 });
    classifyWulffForm(mkSimT(true, [ti]));               // tags just past the 30µm gate
    expect(ti._wulffForm.growthFrac).toBe(0.15);         // 31/250 = 0.124 → floored
    ti.total_growth_um = 32;
    classifyWulffForm(mkSimT(true, [ti]));
    expect(ti._wulffForm.growthFrac).toBe(0.15);         // still under the floor — no jitter
  });

  it('every tenant is covered — a grown fluorite/calcite/barite tag also reads live g', () => {
    for (const [mk, over] of [
      [mkSim,  { mineral: 'fluorite', habit: 'octahedral_REE' }],
      [mkSimC, { mineral: 'calcite', habit: 'scalenohedral' }],
      [mkSimB, { mineral: 'barite', habit: 'bladed' }],
    ] as any[]) {
      const c = mkCrystal(Object.assign({ crystal_id: 5, total_growth_um: 60 }, over));
      classifyWulffForm(mk(true, [c]));
      expect(c._wulffForm.growthFrac).toBeCloseTo(60 / 250, 10);
      c.total_growth_um = 300;
      classifyWulffForm(mk(true, [c]));
      expect(c._wulffForm.growthFrac).toBe(1.0);         // matured
    }
  });
});
