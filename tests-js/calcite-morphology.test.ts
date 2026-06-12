// tests-js/calcite-morphology.test.ts — calcite-morphology arc contracts.
//
// Phase 0/1 (2026-06-11): the growth-regime classifier lives in the engine
// (js/52 classifyCalciteMorphologyStep), tags every calcite zone at END of
// run_step from the POST-STEP σ, and the tags feed the strip chip + zone
// modal. Master doc: proposals/HANDOFF-CALCITE-MORPHOLOGY-2026-06-11.md;
// science oracle: proposals/RESEARCH-calcite-morphology-2026-06-11.md.
//
// The contracts pinned here:
//   1. SUNAGAWA ORDER (17th catch — external peer review): rising σ walks
//      smooth → stepped → hopper → dendritic, never out of order, and the
//      calibrated thresholds hold (spar<2 | mild<8 | STEPPED<50 |
//      hopper<200 | dendrite≥200 on SURFACE σ).
//   2. BOUNDARY-LAYER DAMPING (Wolthers 2022): surface σ → bulk σ at size
//      0, decays toward 1 as the crystal grows (SIZE_HALF_UM=80).
//   3. POST-STEP BASIS (18th catch — instrument-caught): zone tags equal a
//      recompute from the post-step σ, NOT the in-step σ. The in-step
//      basis misbanded the whole dripstone family dendritic (thin-film σ
//      spikes the crystal itself consumes within the step).
//   4. THE VALIDATED FLEET PICTURE survives: stalactite_demo is stepped-
//      dominant, mvt smooth-spar-dominant, and dendritic is never a
//      dominant band at seed 42 (zero stable dendrites — geologically
//      honest; the reviewer's prediction, confirmed by the corrected map).
//   5. THE INSTRUMENTS: per-zone tags carry regime/form/surf_sigma; the
//      calcite_morph strip chip reads the Sunagawa ordinal at the
//      crystal's anchor and null in empty rock.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const calciteMorphRegime: any;
declare const calciteSurfaceSigma: any;
declare const CALCITE_MORPH_REGIMES: any;
declare const CALCITE_MORPH_TH: any;
declare const _HELIX_CHEM_PARAMS: any;
declare const calciteTerraceBands: any;
declare const calciteMorphForm: any;

function runScenario(name: string, seed = 42, steps?: number) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS[name]();
  const sim = new VugSimulator(conditions, events);
  const n = steps ?? defaultSteps ?? 100;
  for (let i = 0; i < n; i++) sim.run_step();
  return sim;
}

function regimeMass(sim: any): Record<string, number> {
  const mass: Record<string, number> = {};
  for (const c of sim.crystals) {
    if (!c || c.mineral !== 'calcite' || c.dissolved) continue;
    for (const z of c.zones || []) {
      if (!z.morph_regime || z.thickness_um <= 0) continue;
      mass[z.morph_regime] = (mass[z.morph_regime] || 0) + z.thickness_um;
    }
  }
  return mass;
}

describe('calcite morphology classifier (Phase 0)', () => {

  it('walks the Sunagawa order as σ rises — never out of order', () => {
    expect(CALCITE_MORPH_REGIMES).toEqual([
      'spiral_smooth', 'stepped_mild', 'stepped_macro', 'hopper_skeletal', 'dendritic',
    ]);
    // A rising σ sweep maps to a non-decreasing regime ordinal (§6.1 of
    // the research doc — the dark-observe σ-ramp test).
    let lastIdx = -1;
    for (let sigma = 1.05; sigma < 600; sigma *= 1.18) {
      const idx = CALCITE_MORPH_REGIMES.indexOf(calciteMorphRegime(sigma));
      expect(idx).toBeGreaterThanOrEqual(lastIdx);
      lastIdx = idx;
    }
    expect(lastIdx).toBe(4);  // the sweep reaches dendritic at the top
  });

  it('calibrated thresholds hold at the band boundaries', () => {
    expect(calciteMorphRegime(1.9)).toBe('spiral_smooth');
    expect(calciteMorphRegime(2.1)).toBe('stepped_mild');
    expect(calciteMorphRegime(7.9)).toBe('stepped_mild');
    expect(calciteMorphRegime(8.1)).toBe('stepped_macro');
    expect(calciteMorphRegime(49)).toBe('stepped_macro');
    expect(calciteMorphRegime(51)).toBe('hopper_skeletal');
    expect(calciteMorphRegime(199)).toBe('hopper_skeletal');
    expect(calciteMorphRegime(201)).toBe('dendritic');
  });

  it('boundary-layer damping: surfσ = bulkσ at size 0, decays with size, SATURATES at the δ ceiling', () => {
    expect(calciteSurfaceSigma(100, 0)).toBeCloseTo(100, 6);
    // At SIZE_HALF_UM the excess halves: 1 + 99/2
    expect(calciteSurfaceSigma(100, CALCITE_MORPH_TH.SIZE_HALF_UM)).toBeCloseTo(50.5, 6);
    // Phase 5: the boundary layer is BOUNDED (Wolthers's own model uses
    // a fixed δ — it saturates at the hydrodynamic scale, it does not
    // track crystal size forever). Above SIZE_DAMP_CAP_UM the damping
    // factor freezes: a 16 mm giant damps exactly like a 2 mm crystal.
    // This is what lets a cabinet-scale Elmwood calcite step at sane
    // chemistry — the uncapped proxy divided its σ-excess by ~240.
    const cap = CALCITE_MORPH_TH.SIZE_DAMP_CAP_UM;
    expect(calciteSurfaceSigma(100, 16000)).toBeCloseTo(calciteSurfaceSigma(100, cap), 9);
    expect(calciteSurfaceSigma(100, 16000)).toBeGreaterThan(2.0);   // no longer glass at ω=100
    expect(calciteSurfaceSigma(100, 16000)).toBeLessThan(8.0);      // but not macro either
    // Monotone in size
    let last = Infinity;
    for (const um of [0, 40, 80, 200, 800, 4000, 40000]) {
      const s = calciteSurfaceSigma(60, um);
      expect(s).toBeLessThanOrEqual(last);
      last = s;
    }
  });

  it('18th catch: tags are written from the POST-STEP σ (the calibrated basis)', () => {
    setSeed(42);
    const { conditions, events } = SCENARIOS.stalactite_demo();
    const sim = new VugSimulator(conditions, events);
    let checked = 0;
    for (let i = 0; i < 60; i++) {
      sim.run_step();
      let sigmaPost: number;
      try { sigmaPost = sim.conditions.supersaturation_calcite(); } catch (_e) { continue; }
      if (!isFinite(sigmaPost) || sigmaPost < 1.0) continue;
      // Phase 4: the Mg bunching term rides the recompute too (post-step
      // Mg:Ca, same basis as σ).
      const mg = (sim.conditions.fluid.Mg || 0) / Math.max(1e-6, sim.conditions.fluid.Ca || 0);
      const mgBunch = 1 + CALCITE_MORPH_TH.MG_BUNCH * Math.min(mg, 1);
      for (const c of sim.crystals) {
        if (!c || c.mineral !== 'calcite' || c.dissolved || !c.zones.length) continue;
        const z = c.zones[c.zones.length - 1];
        if (z.step !== sim.step || z.thickness_um <= 0) continue;
        const sizeBefore = Math.max(0, c.total_growth_um - z.thickness_um);
        const expected = calciteMorphRegime(calciteSurfaceSigma(sigmaPost, sizeBefore) * mgBunch);
        expect(z.morph_regime).toBe(expected);
        expect(c._morphology.regime).toBe(expected);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);  // the contract actually exercised
  });

  it('the validated fleet picture: stalactite stepped-dominant, mvt smooth-spar, no stable dendrite', () => {
    const stal = regimeMass(runScenario('stalactite_demo'));
    const stalTotal = Object.values(stal).reduce((s, x) => s + x, 0);
    expect(stalTotal).toBeGreaterThan(0);
    const stepped = (stal.stepped_macro || 0) + (stal.stepped_mild || 0);
    expect(stepped / stalTotal).toBeGreaterThan(0.5);
    expect((stal.dendritic || 0) / stalTotal).toBeLessThan(0.1);

    const mvt = regimeMass(runScenario('mvt'));
    const mvtTotal = Object.values(mvt).reduce((s, x) => s + x, 0);
    expect(mvtTotal).toBeGreaterThan(0);
    expect((mvt.spiral_smooth || 0) / mvtTotal).toBeGreaterThan(0.9);
  });
});

describe('calcite morphology instruments (Phase 1)', () => {

  it('zone tags carry regime + form + surf_sigma, and ride the collection record', () => {
    const sim = runScenario('stalactite_demo');
    const cal = sim.crystals.find((c: any) => c.mineral === 'calcite' && !c.dissolved && c.zones.some((z: any) => z.morph_regime));
    expect(cal).toBeTruthy();
    const tagged = cal.zones.filter((z: any) => z.morph_regime);
    for (const z of tagged) {
      expect(CALCITE_MORPH_REGIMES).toContain(z.morph_regime);
      expect(['rhombohedral', 'scalenohedral']).toContain(z.morph_form);
      expect(z.morph_surf_sigma).toBeGreaterThan(0);
    }
    // Collection record carries the tags (93-ui-collection whitelist).
    const rec = (globalThis as any).buildCrystalRecord
      ? (globalThis as any).buildCrystalRecord(cal, { mode: 'test', scenario: 'stalactite_demo', seed: 42 })
      : null;
    if (rec) {
      const recTagged = rec.zones.filter((z: any) => z.morph_regime);
      expect(recTagged.length).toBe(tagged.length);
      expect(recTagged[0].morph_surf_sigma).toBeGreaterThan(0);
    }
  });

  it('Phase 2: habit strings follow the recorded regime (one-step lag is physical)', () => {
    // stalactite_demo is STEPPED-dominant (74% macro at seed 42): its
    // calcite must end the run wearing a stepped_* habit with terraced
    // dominant_forms.
    const stal = runScenario('stalactite_demo');
    const steppedCal = stal.crystals.filter((c: any) =>
      c.mineral === 'calcite' && !c.dissolved && String(c.habit).startsWith('stepped_'));
    expect(steppedCal.length).toBeGreaterThan(0);
    for (const c of steppedCal) {
      expect(['stepped_rhombohedral', 'stepped_scalenohedral']).toContain(c.habit);
      const forms = (c.dominant_forms || []).join(' ');
      expect(/macrostep|growth steps/.test(forms)).toBe(true);
    }

    // sabkha is hopper/skeletal 100%: its calcite ends hoppered.
    const sabkha = runScenario('sabkha_dolomitization');
    const sabkhaCal = sabkha.crystals.filter((c: any) => c.mineral === 'calcite' && !c.dissolved && c._morphology);
    expect(sabkhaCal.length).toBeGreaterThan(0);
    for (const c of sabkhaCal) {
      expect(String(c.habit).startsWith('hopper_')).toBe(true);
      expect((c.dominant_forms || []).join(' ')).toContain('hopper');
    }

    // mvt is smooth-spar (98%, and the stepped sliver is the tiny CORE,
    // not the rim): its calcite keeps the plain parent-form habit — the
    // no-regression hook (research §6.4).
    const mvt = runScenario('mvt');
    const mvtCal = mvt.crystals.filter((c: any) => c.mineral === 'calcite' && !c.dissolved && c._morphology);
    expect(mvtCal.length).toBeGreaterThan(0);
    for (const c of mvtCal) {
      expect(['rhombohedral', 'scalenohedral']).toContain(c.habit);
    }

    // The general lag contract: a crystal's habit family matches the
    // regime of its last or second-to-last tagged zone (habit was set
    // DURING the final growth step, reading the state recorded at the
    // END of the step before it).
    const familyOf = (habit: string) =>
      habit.startsWith('stepped_') ? ['stepped_mild', 'stepped_macro']
      : habit.startsWith('hopper_') ? ['hopper_skeletal']
      : habit.startsWith('dendritic_') ? ['dendritic']
      : ['spiral_smooth'];
    for (const sim of [stal, sabkha, mvt]) {
      for (const c of sim.crystals) {
        if (c.mineral !== 'calcite' || c.dissolved || c._variety === 'manganocalcite') continue;
        const tagged = (c.zones || []).filter((z: any) => z.morph_regime);
        if (tagged.length < 2) continue;
        const recent = [tagged[tagged.length - 1].morph_regime, tagged[tagged.length - 2].morph_regime];
        const fam = familyOf(String(c.habit));
        expect(recent.some((r: string) => fam.includes(r))).toBe(true);
      }
    }
  });

  it('Phase 3: calciteTerraceBands — relief crystals get knots, smooth stays null, replay truncates', () => {
    // ultramafic_supergene is STEPPED 100% at seed 42 — every calcite
    // carries terraces.
    const ultra = runScenario('ultramafic_supergene');
    const ultraCal = ultra.crystals.filter((c: any) => c.mineral === 'calcite' && !c.dissolved && c.total_growth_um > 0);
    expect(ultraCal.length).toBeGreaterThan(0);
    let sawTerraces = 0;
    for (const c of ultraCal) {
      const terr = calciteTerraceBands(c);
      if (!terr) continue;
      sawTerraces++;
      expect(['scalene', 'rhomb']).toContain(terr.form);
      // knots ascending, closing exactly at 1.0
      let last = 0;
      for (const k of terr.knots) {
        expect(k.frac).toBeGreaterThan(last);
        last = k.frac;
      }
      expect(terr.knots[terr.knots.length - 1].frac).toBe(1.0);
      // replay truncation: an early cut yields a prefix-sized stack —
      // the watch-it-grow contract (terraces accumulate, never pre-exist)
      const early = calciteTerraceBands(c, c.nucleation_step + 5);
      if (early) expect(early.knots.length).toBeLessThanOrEqual(terr.knots.length);
    }
    expect(sawTerraces).toBeGreaterThan(0);

    // mvt's calcite: smooth-DOMINANT dogtooth with at most a small
    // stepped CORE. v192 re-pin (pK(T) correction): the corrected
    // early-σ trajectory can tag the first zones stepped while the
    // crystal is still small (damping is weak at small size) — a
    // stepped core under glassy outer faces, which is the PHANTOM
    // read Tri-State calcite is collector-famous for. The contract:
    // terraces may exist, but any relief is confined to the early
    // stack (≤15% of the walk) and the crystal FINISHES smooth — the
    // hand-specimen faces are glassy (the boss-verified dogtooth).
    const mvt = runScenario('mvt');
    const mvtCal = mvt.crystals.find((c: any) => c.mineral === 'calcite' && !c.dissolved);
    expect(mvtCal).toBeTruthy();
    const mvtTerr = calciteTerraceBands(mvtCal);
    if (mvtTerr) {
      const lastKnot = mvtTerr.knots[mvtTerr.knots.length - 1];
      expect(lastKnot.regime).toBe('spiral_smooth');             // glassy finish
      let reliefSpan = 0, prev = 0;
      for (const k of mvtTerr.knots) {
        if (k.regime !== 'spiral_smooth') reliefSpan += k.frac - prev;
        prev = k.frac;
      }
      expect(reliefSpan).toBeLessThanOrEqual(0.15);              // phantom core, not a stepped rim
    }

    // sabkha is hopper/skeletal 100%: the apex hollows into a funnel.
    const sabkha = runScenario('sabkha_dolomitization');
    const sabCal = sabkha.crystals.find((c: any) => c.mineral === 'calcite' && !c.dissolved && c.total_growth_um > 0);
    expect(sabCal).toBeTruthy();
    const sabTerr = calciteTerraceBands(sabCal);
    expect(sabTerr).toBeTruthy();
    expect(sabTerr.hopperTip).toBe(true);
  });

  it('Phase 4 (SIM 187): the Mg axis — form elongation + bunching bias', () => {
    // Form: Mg:Ca > 0.15 elongates toward scalenohedral at any T
    // (GCA 2015); T > 200 elongates at any Mg (the original ladder).
    expect(calciteMorphForm(0.2, 25)).toBe('scalenohedral');
    expect(calciteMorphForm(0.05, 25)).toBe('rhombohedral');
    expect(calciteMorphForm(0.05, 250)).toBe('scalenohedral');
    // Bunching factor pinned to the calibrated k (the k∈{0,0.4,0.8}
    // sweep — 0.8 over-steepened the dripstone family, rejected).
    expect(CALCITE_MORPH_TH.MG_BUNCH).toBe(0.4);

    // Fleet: the Mg-dominated waters wear scalenohedral-family habits.
    const sabkha = runScenario('sabkha_dolomitization');   // Mg:Ca ≈ 3.3
    const sabCal = sabkha.crystals.find((c: any) => c.mineral === 'calcite' && !c.dissolved && c._morphology);
    expect(sabCal.habit).toBe('hopper_scalenohedral');

    const ultra = runScenario('ultramafic_supergene');     // Mg:Ca ≈ 10
    const ultraCal = ultra.crystals.filter((c: any) => c.mineral === 'calcite' && !c.dissolved && c._morphology);
    expect(ultraCal.length).toBeGreaterThan(0);
    for (const c of ultraCal) expect(c.habit).toBe('stepped_scalenohedral');
    // mvt: CORRECTED 2026-06-12 (boss hand-verification, first catch) —
    // the v187 claim "Tri-State spar is rhombs, not dogtooth" was
    // backwards: Joplin's iconic calcite IS the golden dogtooth, and
    // MVT brines are DOLOMITIZING (Mg-rich) fluids. Broth Mg 30→65
    // (live ratio 0.163 after the fluid-mixing event holds Ca at 400)
    // → smooth SCALENOHEDRAL: the glassy Joplin dogtooth.
    const mvtSim = runScenario('mvt');
    const mvtDogtooth = mvtSim.crystals.filter((c: any) => c.mineral === 'calcite' && !c.dissolved && c.total_growth_um > 0);
    expect(mvtDogtooth.length).toBeGreaterThan(0);
    for (const c of mvtDogtooth) expect(c.habit).toBe('scalenohedral');
  });

  it('Phase 5: elmwood — the stepped-calcite showcase contract', () => {
    // The movements are DECLARED: the cooling trend + the fault-valve
    // pulse train as TWO coupled signatures (CO3 brine slug + pH degas
    // spike) sharing five centers — one geological event each.
    const { conditions } = SCENARIOS.elmwood();
    const ms = conditions._scenario.movements;
    expect(Array.isArray(ms)).toBe(true);
    const co3 = ms.find((m: any) => m.field === 'fluid.CO3');
    const ph = ms.find((m: any) => m.field === 'fluid.pH');
    const temp = ms.find((m: any) => m.field === 'temperature');
    expect(co3 && ph && temp).toBeTruthy();
    expect(co3.ops.length).toBe(5);
    expect(ph.ops.length).toBe(5);
    expect(co3.ops.map((o: any) => o.center)).toEqual(ph.ops.map((o: any) => o.center));
    // deterministic — no OU texture (re-rolls marginals; 16th-catch era rule)
    expect(co3.texture).toBeUndefined();
    expect(ph.texture).toBeUndefined();

    // Seed 42: the full MVT assemblage + the headline golden dogtooth
    // ending the run MID-PULSE, wearing its stepped habit, with the
    // pulse train written into its zone stack as renderable terraces.
    const sim = runScenario('elmwood');
    for (const sp of ['sphalerite', 'fluorite', 'barite', 'calcite']) {
      expect(sim.crystals.some((c: any) => c.mineral === sp && !c.dissolved)).toBe(true);
    }
    const cals = sim.crystals.filter((c: any) => c.mineral === 'calcite' && !c.dissolved && c.total_growth_um > 0);
    let head: any = null;
    for (const c of cals) if (!head || c.total_growth_um > head.total_growth_um) head = c;
    expect(head).toBeTruthy();
    expect(head.total_growth_um).toBeGreaterThan(8000);          // a cabinet crystal, not a crust
    expect(head.habit).toBe('stepped_scalenohedral');            // golden dogtooth, stepped finish
    const terr = calciteTerraceBands(head);
    expect(terr).toBeTruthy();                                    // relief above the 5% floor → terraces render
    expect(terr.form).toBe('scalene');
    // The pulse train is in the stone: the raw zone walk shows ~8 regime
    // runs; the renderable knot list merges same-regime neighbors and
    // sub-1.5% slivers down to ~4 bands — at least 2 of them relief.
    expect(terr.knots.length).toBeGreaterThanOrEqual(4);
    const reliefKnots = terr.knots.filter((k: any) => k.regime.startsWith('stepped') || k.regime === 'hopper_skeletal');
    expect(reliefKnots.length).toBeGreaterThanOrEqual(2);
    // The narrator tells the same story the geometry shows.
    const prose = sim._narrate_calcite(head);
    expect(/terraced|macrostep/.test(prose)).toBe(true);
  });

  it('calcite_morph strip chip: Sunagawa ordinal at the anchor, null in empty rock', () => {
    const chip = _HELIX_CHEM_PARAMS.find((p: any) => p.id === 'calcite_morph');
    expect(chip).toBeTruthy();
    expect(chip.system).toBe('carbonate');
    expect(chip.min).toBe(0);
    expect(chip.max).toBe(4);

    const sim = runScenario('mvt');
    const wall = sim.wall_state || sim.conditions.wall;
    const cal = sim.crystals.find((c: any) => c.mineral === 'calcite' && !c.dissolved && c._morphology);
    expect(cal).toBeTruthy();
    const a = cal.wall_anchor;
    const atAnchor = chip.read(sim, wall, a.ringIdx, a.cellIdx);
    expect(atAnchor).toBe(CALCITE_MORPH_REGIMES.indexOf(cal._morphology.regime));
    // Empty rock: a cell far from any calcite anchor on a different ring.
    const farRing = (a.ringIdx + 7) % (wall.ring_count || 16);
    const hasCalThere = sim.crystals.some((c: any) => c.mineral === 'calcite' && !c.dissolved
      && c.wall_anchor && c.wall_anchor.ringIdx === farRing);
    if (!hasCalThere) {
      expect(chip.read(sim, wall, farRing, 0)).toBeNull();
    }
  });
});
