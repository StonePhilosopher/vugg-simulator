// tests-js/cascade-gate-audit.test.ts — Path C cascade-gate audit (2026-05).
//
// Pins both arcs of the 2026-05-18 cascade-gate audit. Companion to
// tests-js/stale-mineral-retunes.test.ts but specifically about
// structural unreachability of hard upper-cation gates.
//
// Arc 1 — Activity-correction copy-paste fix. Four supersaturation
// methods had accidental extra activityCorrectionFactor calls landed
// by the Phase 2b sweep (eff8ec1, 2026-05-05):
//
//   adamite   × erythrite + annabergite (Co/Ni arsenate factors on a Zn arsenate)
//   borax     × tincalconite (paramorph, identical numerical factor,
//                             γ² · m² double-count)
//   galena    × pyrite + marcasite + sphalerite + wurtzite + chalcopyrite
//                             (six factors on a PbS mineral)
//   stibnite  × tetrahedrite + tennantite (Cu-As/Sb sulfosalt factors on Sb2S3)
//
// Arc 2 — Soft-cation-suppressor pattern applied to native_arsenic +
// native_bismuth. The hard upper gates (S>10 / S>12) were structurally
// unreachable under bulk-view chemistry; soft-suppressor pattern from
// native_tellurium retune extended.
//
// What this asserts:
//   * The four sigma methods now only contain ONE activityCorrectionFactor
//     call (for the mineral's own name).
//   * Galena nucleates in mvt at seed 42 (regression catch — pre-fix,
//     the canonical Pb-sulfide mineral was not firing in its canonical
//     scenario).
//   * native_arsenic + native_bismuth no longer have hard S>N gates
//     blocking σ in schneeberg (source inspection).
//   * Both natives nucleate in schneeberg across 3 seeds.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runSeeds(scenarioName: string, mineralName: string, seeds: number[]) {
  let everNucleated = false;
  let maxSigma = 0;
  for (const seed of seeds) {
    setSeed(seed);
    const scen = SCENARIOS[scenarioName];
    if (!scen) return { everNucleated: null, maxSigma: 0, missingScenario: true };
    const { conditions, events, defaultSteps } = scen();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;
    const sigmaFn = sim.conditions[`supersaturation_${mineralName}`];
    for (let i = 0; i < steps; i++) {
      sim.run_step();
      if (typeof sigmaFn === 'function') {
        let s = 0;
        try { s = sigmaFn.call(sim.conditions); } catch { s = 0; }
        if (Number.isFinite(s) && s > maxSigma) maxSigma = s;
      }
    }
    if (sim.crystals.some((c: any) => c.mineral === mineralName)) {
      everNucleated = true;
    }
  }
  return { everNucleated, maxSigma };
}

function getSigmaSource(mineral: string): string {
  setSeed(42);
  const scen = SCENARIOS['mvt'] ?? Object.values(SCENARIOS)[0];
  // @ts-expect-error - dynamic scenario callable
  const { conditions } = scen();
  const sim = new VugSimulator(conditions, []);
  const fn = sim.conditions[`supersaturation_${mineral}`];
  if (typeof fn !== 'function') throw new Error(`no supersaturation_${mineral}`);
  return fn.toString();
}

function countActivityCalls(src: string, mineral: string): { own: number; foreign: string[] } {
  const matches = [...src.matchAll(/activityCorrectionFactor\(this\.fluid,\s*'(\w+)'\)/g)];
  const own = matches.filter(m => m[1] === mineral).length;
  const foreign = matches.filter(m => m[1] !== mineral).map(m => m[1]);
  return { own, foreign };
}

describe('Arc 1 — activity-correction copy-paste fix (2026-05)', () => {
  describe('each affected sigma method calls activityCorrectionFactor only once, for its own mineral', () => {
    for (const mineral of ['adamite', 'borax', 'galena', 'stibnite']) {
      it(`supersaturation_${mineral} has exactly one activity correction (for '${mineral}')`, () => {
        const src = getSigmaSource(mineral);
        const { own, foreign } = countActivityCalls(src, mineral);
        expect(own, `expected exactly one activityCorrectionFactor(${mineral})`).toBe(1);
        expect(foreign, `unexpected foreign activity corrections`).toEqual([]);
      });
    }
  });

  it('galena nucleates in mvt at seed 42 (pre-fix regression: PbS missing from canonical Pb-sulfide scenario)', () => {
    setSeed(42);
    const scen = SCENARIOS['mvt'];
    expect(scen).toBeTruthy();
    const { conditions, events, defaultSteps } = scen();
    const sim = new VugSimulator(conditions, events);
    const steps = defaultSteps ?? 100;
    for (let i = 0; i < steps; i++) sim.run_step();
    const galenaCount = sim.crystals.filter((c: any) => c.mineral === 'galena').length;
    expect(galenaCount, 'mvt at seed 42 should produce galena (pre-fix: 0 crystals)').toBeGreaterThan(0);
  });

  it('galena fires in at least 4 of the 6 canonical Pb scenarios at seed 42', () => {
    // Pre-fix: galena fired in 2 of 24 scenarios at seed 42 (the 6× activity
    // stack suppressed it out of mvt + schneeberg + radioactive_pegmatite +
    // reactive_wall, leaving only porphyry + supergene_oxidation). Post-fix
    // it fires in all 6. Test asserts the floor — 4/6 — to allow chemistry
    // tweaks to redistribute slot competition without failing the test.
    const candidates = ['mvt', 'porphyry', 'radioactive_pegmatite', 'reactive_wall', 'schneeberg', 'supergene_oxidation'];
    let firing = 0;
    for (const sc of candidates) {
      setSeed(42);
      const scen = SCENARIOS[sc];
      if (!scen) continue;
      const { conditions, events, defaultSteps } = scen();
      const sim = new VugSimulator(conditions, events);
      const steps = defaultSteps ?? 100;
      for (let i = 0; i < steps; i++) sim.run_step();
      if (sim.crystals.some((c: any) => c.mineral === 'galena')) firing++;
    }
    expect(firing, 'galena should fire in at least 4 of 6 canonical Pb scenarios at seed 42').toBeGreaterThanOrEqual(4);
  });
});

describe('Arc 2 — native_arsenic + native_bismuth soft-cation-suppressor', () => {
  describe('engines have soft suppressors instead of hard S>N gates', () => {
    it('supersaturation_native_arsenic uses s_suppr/fe_suppr factors, no `S > 10` hard return', () => {
      const src = getSigmaSource('native_arsenic');
      expect(src, 'engine should use s_suppr soft factor').toContain('s_suppr');
      expect(src, 'engine should use fe_suppr soft factor').toContain('fe_suppr');
      expect(src, 'engine should NOT have the old hard S>10 gate')
        .not.toMatch(/fluid\.S\s*>\s*10\.0\s*\)\s*return 0/s);
      expect(src, 'engine should NOT have the old hard Fe>50 gate')
        .not.toMatch(/fluid\.Fe\s*>\s*50\.0\s*\)\s*return 0/s);
    });

    it('supersaturation_native_bismuth uses s_mask soft factor, no `S > 12` hard return, lower Bi gate is 5 not 15', () => {
      const src = getSigmaSource('native_bismuth');
      expect(src, 'engine should use s_mask soft factor').toContain('s_mask');
      expect(src, 'engine should NOT have the old hard S>12 gate')
        .not.toMatch(/fluid\.S\s*>\s*12\s*[|)]/);
      // v127 refactor: the literal `fluid.Bi < 5` moved into
      // MINERAL_GATES_native_bismuth.fluid_min.Bi (registry); engine now
      // dereferences `g.fluid_min!.Bi`. Assert the registry value, not
      // the source-code literal — that's the point of the refactor.
      const gates = (globalThis as any).MINERAL_GATES_REGISTRY?.native_bismuth
        ?? (globalThis as any).MINERAL_GATES_native_bismuth;
      expect(gates?.fluid_min?.Bi, 'native_bismuth lower Bi gate should be 5 (paragenetic step-down from bismuthinite)').toBe(5);
      expect(src, 'engine should dereference the gates-registry Bi minimum')
        .toMatch(/fluid\.Bi\s*<\s*g\.fluid_min!?\.Bi\b/);
    });
  });

  describe('both natives nucleate in schneeberg across 3 seeds', () => {
    it('native_arsenic nucleates in schneeberg', () => {
      const r = runSeeds('schneeberg', 'native_arsenic', [42, 1, 7]);
      expect(r.everNucleated, `native_arsenic σ peaked at ${r.maxSigma.toFixed(2)}`).toBe(true);
    });

    it('native_bismuth nucleates in schneeberg', () => {
      const r = runSeeds('schneeberg', 'native_bismuth', [42, 1, 7]);
      expect(r.everNucleated, `native_bismuth σ peaked at ${r.maxSigma.toFixed(2)}`).toBe(true);
    });
  });

  describe('porphyry stays gated out (S=60 is geologically too rich for these natives)', () => {
    // Verifies the soft suppressor still works as a gate at high S — porphyry
    // brines should not produce native_arsenic or native_bismuth even with
    // the structural gate softening.
    it('native_arsenic stays at σ=0 in porphyry (s_suppr → 0 at S=60)', () => {
      setSeed(42);
      const scen = SCENARIOS['porphyry'];
      const { conditions } = scen();
      const sim = new VugSimulator(conditions, []);
      const sigmaFn = sim.conditions.supersaturation_native_arsenic;
      // Sample once at the initial broth — S=60 should drive s_suppr to 0
      // so σ = 0 immediately.
      const sigma = sigmaFn.call(sim.conditions);
      expect(sigma, 'native_arsenic σ should be 0 in porphyry initial broth (S=60)').toBe(0);
    });
  });

  describe('native_bismuth nucleation threshold is 1.0 (matched sibling natives, was outlier 1.4)', () => {
    it('threshold check `sigma_nbi > 1.0` present in _nuc_native_bismuth', () => {
      // The nucleator source isn't easy to access via the API, so we go
      // through end-to-end behavior. With σ > 1.0 (achievable in schneeberg)
      // and threshold = 1.0, native_bismuth should fire. With the old 1.4
      // threshold, it would not.
      const r = runSeeds('schneeberg', 'native_bismuth', [42, 1, 7]);
      // The structurally-failing case would be: σ reaches 1.0-1.4 but never
      // nucleates. The probe shows post-Arc-2 σ_max = 1.35 — between the
      // old and new thresholds. If `ever_nucleated` is true, the threshold
      // was lowered.
      expect(r.everNucleated, 'with σ_max ~1.35, only the lowered threshold 1.0 enables nucleation').toBe(true);
    });
  });
});
