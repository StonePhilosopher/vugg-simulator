// tests-js/c0-calcite-sigma-lever.test.ts — C0, the calcite σ lever (boss
// stone #1, SIM 217, 2026-07-06). calciteMorphForm gains an Ω branch: sustained
// textbook-Ω > OMEGA_SCALENO in SUBAQUEOUS growth → scalenohedral, independent
// of Mg/T. The render rider retires calcite's id-hash: Wulff biasC = B(Ω̄) from
// a growth-weighted integral (_wulffCalInt), the wulfenite-4a.7 idiom.
//
// Science: González, Carpenter & Lohmann 1992 (natural spar — near-equilibrium
// rhombs, high-σ scalenohedra); García-Carmona 2003; Weremeichik et al. 2024
// (Sci Rep 14 — SUBAQUEOUS applicability → the air gate). Kirov 1972 + Stack &
// Grantham 2010 (Ca:CO₃) are RECORDED-not-gated (B5-era, pre-registered).
// Threshold + biasC magnitudes are sim-scale calibration from
// tools/c0-calcite-form-probe.mjs — never transcribed from papers.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const calciteMorphForm: any;
declare const wulffCalciteOmegaBias: any;
declare const MORPH_TH: any;
declare const CALCITE_OMEGA_BIAS: any;

function runScenario(name: string, seed = 42) {
  setSeed(seed);
  const scen = SCENARIOS[name];
  expect(scen, `scenario ${name} missing`).toBeTruthy();
  const { conditions, events, defaultSteps } = scen();
  const sim = new VugSimulator(conditions, events);
  for (let i = 0; i < (defaultSteps ?? 120); i++) sim.run_step();
  return sim;
}
const calcitesOf = (sim: any) => sim.crystals.filter((c: any) => c.mineral === 'calcite' && !(c.dissolved && !c.perimorph_eligible));

// ============================================================
// The fence law — pure function table
// ============================================================

describe('C0 — calciteMorphForm Ω branch (the law)', () => {
  it('legacy branches are byte-untouched (omega omitted → Mg/T-only fence)', () => {
    expect(calciteMorphForm(0.2, 25)).toBe('scalenohedral');    // Mg branch
    expect(calciteMorphForm(0.05, 25)).toBe('rhombohedral');
    expect(calciteMorphForm(0.05, 250)).toBe('scalenohedral');  // T branch
  });

  it('the σ branch: high sustained Ω makes scalenohedra in Mg-poor low-T water', () => {
    const th = MORPH_TH.calcite.OMEGA_SCALENO;
    expect(calciteMorphForm(0.05, 25, th + 1, true)).toBe('scalenohedral');
    expect(calciteMorphForm(0.05, 25, th - 0.1, true)).toBe('rhombohedral');   // below threshold
  });

  it('ELMWOOD ROBUSTNESS (word level): elmwood-class water clears the fence on σ ALONE', () => {
    // elmwood today: Mg:Ca 0.165 (a 10% margin over the 0.15 fence) + cell Ω̄ 28.6.
    // The stone's point: with the σ branch, an Mg dip below the fence no longer
    // flips the showcase — 0.14 Mg (sub-fence) + Ω 28.6 still reads dogtooth.
    expect(calciteMorphForm(0.14, 106, 28.6, true)).toBe('scalenohedral');
  });

  it('the SUBAQUEOUS gate: air-mode growth ignores the σ branch (Weremeichik applicability)', () => {
    expect(calciteMorphForm(0.005, 25, 1500, false)).toBe('rhombohedral');   // stalactite-class Ω, air → gated
    expect(calciteMorphForm(0.2, 25, 1500, false)).toBe('scalenohedral');    // Mg branch unaffected by the gate
  });

  it('degrades to Mg/T when omega is NaN/undefined (callers without σ keep the old contract)', () => {
    expect(calciteMorphForm(0.05, 25, NaN, true)).toBe('rhombohedral');
    expect(calciteMorphForm(0.05, 25, undefined, true)).toBe('rhombohedral');
  });

  it('CALIBRATION PIN: OMEGA_SCALENO sits at 12 (the fleet gap — moves only with a re-probe)', () => {
    expect(MORPH_TH.calcite.OMEGA_SCALENO).toBe(12.0);
  });
});

// ============================================================
// The biasC law — B(Ω̄) inside the eye-checked bands
// ============================================================

describe('C0 — wulffCalciteOmegaBias (the render rider law)', () => {
  it('dogtooth: steeper at higher Ω̄, band ends held', () => {
    expect(wulffCalciteOmegaBias(1.0, true)).toBeCloseTo(0.26, 3);     // bluntest
    expect(wulffCalciteOmegaBias(30.0, true)).toBeCloseTo(0.15, 3);    // steepest
    expect(wulffCalciteOmegaBias(100, true)).toBeCloseTo(0.15, 3);     // clamps
    expect(wulffCalciteOmegaBias(0.2, true)).toBeCloseTo(0.26, 3);     // clamps
    const mvt = wulffCalciteOmegaBias(4.1, true);                      // the verified seed-42 consumer
    expect(mvt).toBeGreaterThan(0.24); expect(mvt).toBeLessThan(0.26); // blunt slow spar
    const steep = wulffCalciteOmegaBias(28.6, true);                   // elmwood-class water
    expect(steep).toBeLessThan(0.16);                                  // the steep end is reachable
  });

  it('nailhead: rhomb sharpens toward the acute end as Ω̄ rises sub-threshold', () => {
    expect(wulffCalciteOmegaBias(1.0, false)).toBeCloseTo(2.20, 3);
    expect(wulffCalciteOmegaBias(12.0, false)).toBeCloseTo(1.30, 3);
    expect(wulffCalciteOmegaBias(50, false)).toBeCloseTo(1.30, 3);     // clamps
    const wittichen = wulffCalciteOmegaBias(5.0, false);
    expect(wittichen).toBeGreaterThan(1.8); expect(wittichen).toBeLessThan(1.95);
  });

  it('fallback (Ω̄ unavailable at tag time) reads a mid-blunt body inside the band', () => {
    const dog = wulffCalciteOmegaBias(NaN, true);
    expect(dog).toBeGreaterThanOrEqual(0.15); expect(dog).toBeLessThanOrEqual(0.26);
    const nail = wulffCalciteOmegaBias(NaN, false);
    expect(nail).toBeGreaterThanOrEqual(1.30); expect(nail).toBeLessThanOrEqual(2.20);
    expect(CALCITE_OMEGA_BIAS.FALLBACK_OMEGA).toBe(8.0);
  });
});

// ============================================================
// The sweep's genre outcomes, regression-locked at seed 42
// ============================================================

describe('C0 — fleet genre outcomes (seed 42, the sweep census)', () => {
  it('THE ONE FLIP: deccan calcite is now the iconic Deccan golden dogtooth', () => {
    // The sweep found exactly one form flip fleet-wide: deccan id 8, rhomb →
    // scalenohedral (late-step Ω > 12 after T fell below 200). Deccan trap
    // cavities are one of Earth's classic dogtooth-calcite localities — the
    // flip is a genre IMPROVEMENT, locked here.
    const sim = runScenario('deccan_zeolite');
    const cals = calcitesOf(sim);
    expect(cals.length).toBeGreaterThan(0);
    expect(cals.some((c: any) => String(c.habit).indexOf('scaleno') >= 0),
      'deccan lost its dogtooth').toBe(true);
  });

  it('nailhead genres HOLD: the Pennine-style vein + wittichen + travertine stay rhombohedral', () => {
    for (const name of ['reactivated_fluorite_vein', 'wittichen', 'tutorial_travertine']) {
      const cals = calcitesOf(runScenario(name));
      expect(cals.length, `${name} grew no calcite`).toBeGreaterThan(0);
      for (const c of cals) {
        expect(String(c.habit).indexOf('scaleno'), `${name} id${c.crystal_id} flipped to dogtooth`).toBe(-1);
      }
    }
  });

  it('the air gate HOLDS in the field: stalactites at drip-film Ω (~1500) stay rhombohedral', () => {
    const cals = calcitesOf(runScenario('stalactite_demo'));
    expect(cals.length).toBeGreaterThan(0);
    for (const c of cals) {
      expect(String(c.habit).indexOf('scaleno'), `air-mode id${c.crystal_id} took the σ branch`).toBe(-1);
      // and the zone ANNOTATIONS carry the same gate (formPerCrystal wiring)
      for (const z of c.zones) {
        if (z.morph_form) expect(z.morph_form, 'zone annotation escaped the subaqueous gate').toBe('rhombohedral');
      }
    }
  });

  it('dogtooth genres HOLD: elmwood + mvt calcite keep the scalenohedral word', () => {
    for (const name of ['elmwood', 'mvt']) {
      const cals = calcitesOf(runScenario(name));
      expect(cals.some((c: any) => String(c.habit).indexOf('scaleno') >= 0),
        `${name} lost its dogtooth`).toBe(true);
    }
  });

  it('the integral + earned biasC: mvt tagged dogtooth reads B(Ω̄), hash retired', () => {
    const sim = runScenario('mvt');
    const tagged = calcitesOf(sim).filter((c: any) => c._wulffForm && c._wulffForm.scaleno);
    expect(tagged.length, 'mvt lost its Wulff calcite tag').toBeGreaterThan(0);
    for (const c of tagged) {
      const acc = c._wulffCalInt;
      expect(acc, 'no Ω integral accumulated').toBeTruthy();
      expect(acc.G).toBeGreaterThan(0);
      expect(acc.rW, 'the Ca:CO₃ record (B5-era lever) is missing').toBeGreaterThan(0);
      // biasC equals the law applied to the accumulated Ω̄ — chemically exact
      expect(c._wulffForm.biasC).toBeCloseTo(wulffCalciteOmegaBias(acc.oG / acc.G, true), 6);
      // and the verified seed-42 placement: blunt slow spar near the band's blunt end
      expect(c._wulffForm.biasC).toBeGreaterThan(0.24);
      expect(c._wulffForm.biasC).toBeLessThanOrEqual(0.26);
    }
  });

  it('the σ-earned narrator annotation exists on the deccan flip', () => {
    // deccan id 8 is the first crystal whose scalenohedral word came from the σ
    // branch alone (Mg 0.044, final-step T < 200) — its dominant_forms must say
    // so instead of mislabeling the reason as Mg.
    const sim = runScenario('deccan_zeolite');
    const dog = calcitesOf(sim).filter((c: any) => c.habit === 'scalenohedral');
    expect(dog.length).toBeGreaterThan(0);
    for (const c of dog) {
      const forms = (c.dominant_forms || []).join('|');
      expect(forms.indexOf('Mg-elongated'), `id${c.crystal_id} mislabels the fence branch`).toBe(-1);
      expect(forms.indexOf('σ-grown'), `id${c.crystal_id} missing the σ-grown annotation`).toBeGreaterThanOrEqual(0);
    }
  });
});
