// tests-js/nuc-seed-isolation.test.ts — THE KEYSTONE contracts (2026-06-16).
//
// PROPOSAL-PER-MINERAL-NUC-SEEDS. Nucleation draws used to thread through ONE
// continuous shared `rng` for the whole run, so any change in a mineral's
// draw-count re-phased every later (mineral, step) pair — gating sphalerite
// displaced mottramite 96→47% though they share no ion. The fix: each mineral
// nucleates from its OWN derived per-(mineral, step) stream (_makeNucRng in 85j,
// run-seed lineage + scramble, mirroring v181 _makeThermalRng), routed through
// _runNuc. These tests pin the guarantees that make the keystone real:
//
//   1. DETERMINISM — same (base, mineral, step) → identical stream.
//   2. INDEPENDENCE — distinct mineral OR step OR base → distinct stream.
//   3. SCRAMBLE — nearby keys/steps spread (the 15th-catch requirement;
//      bare folds leave correlated early outputs).
//   4. THE KEYSTONE PROPERTY (integration) — with seeds ON, perturbing one
//      mineral's nucleation draw-count changes NOTHING else in the run; with
//      seeds OFF (legacy shared stream) it DOES (the test has teeth).

import { afterEach, describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const _liveRng: any;             // live handle to the bundle's `let rng`
declare const _makeNucRng: any;          // 85j
declare const _setNucDerivedSeeds: any;  // 85j flag setter (returns prev)

function seq(rng: any, n = 8): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(rng.next());
  return out;
}

describe('per-mineral nucleation seeds (the keystone)', () => {
  // The flag is a bundle-global shared across every test in this worker. Leaving
  // it OFF would run the legacy cascade for later test files and fail their
  // (ON-realization) baselines. Always restore to the ON default.
  afterEach(() => { _setNucDerivedSeeds(true); });

  it('determinism: same (base, mineral, step) → identical stream', () => {
    const a = seq(_makeNucRng(12345, '_nuc_galena', 7));
    const b = seq(_makeNucRng(12345, '_nuc_galena', 7));
    expect(a).toEqual(b);
  });

  it('independence: distinct mineral, step, or base → distinct stream', () => {
    const base = seq(_makeNucRng(999, '_nuc_galena', 3));
    expect(seq(_makeNucRng(999, '_nuc_sphalerite', 3))).not.toEqual(base); // mineral
    expect(seq(_makeNucRng(999, '_nuc_galena', 4))).not.toEqual(base);     // step
    expect(seq(_makeNucRng(1000, '_nuc_galena', 3))).not.toEqual(base);    // base (run seed)
  });

  it('scramble: nearby steps + nearby minerals spread the first output (>0.3)', () => {
    // The 15th catch — a bare fold leaves nearby seeds correlated. The throwaway
    // scramble draw must avalanche them: first outputs across adjacent steps and
    // across mineral keys differing by one char must actually spread.
    const stepFirsts: number[] = [];
    for (let s = 0; s < 12; s++) stepFirsts.push(_makeNucRng(4242, '_nuc_quartz', s).next());
    expect(Math.max(...stepFirsts) - Math.min(...stepFirsts)).toBeGreaterThan(0.3);

    const keyFirsts = ['_nuc_a', '_nuc_b', '_nuc_c', '_nuc_d', '_nuc_e', '_nuc_f']
      .map(k => _makeNucRng(4242, k, 5).next());
    expect(Math.max(...keyFirsts) - Math.min(...keyFirsts)).toBeGreaterThan(0.3);
  });

  // ---- The keystone property, end-to-end ----
  //
  // Perturb ONE mineral by consuming extra rng draws AFTER its crystal is built
  // (post-decision, so the mineral's own realization is unchanged — and each step
  // re-seeds, so even its next-step draws are untouched). Under ON those draws
  // come from that mineral's private stream and vanish on restore → the rest of
  // the run is byte-identical. Under OFF they advance the shared stream → the
  // cascade shifts. We assert BOTH (the OFF case proves the test can detect drift).
  const SCEN = 'supergene_oxidation';
  const TARGET = 'sphalerite';

  function signature(seed: number, perturbDraws: number, on: boolean): string {
    const prev = _setNucDerivedSeeds(on);
    const orig = VugSimulator.prototype.nucleate;
    try {
      VugSimulator.prototype.nucleate = function (mineral: string, position: string, sigma: number) {
        const c = orig.call(this, mineral, position, sigma);
        if (mineral === TARGET && perturbDraws > 0) {
          const r = _liveRng();             // the live stream — TARGET's own under ON
          for (let i = 0; i < perturbDraws; i++) r.random();
        }
        return c;
      };
      setSeed(seed);
      const spec = SCENARIOS[SCEN]();
      const sim = new VugSimulator(spec.conditions, spec.events);
      const steps = spec.defaultSteps ?? 200;
      for (let i = 0; i < steps; i++) sim.run_step();
      return sim.crystals
        .map((c: any) => `${c.mineral}:${c.nucleation_step}:${c.position}:${Math.round(c.total_growth_um)}`)
        .sort()
        .join('|');
    } finally {
      VugSimulator.prototype.nucleate = orig;
      _setNucDerivedSeeds(prev);
    }
  }

  it('ON: perturbing one mineral changes NOTHING else in the run', () => {
    const clean = signature(42, 0, true);
    const perturbed = signature(42, 5, true);
    expect(perturbed).toBe(clean);
  });

  it('OFF (legacy shared stream): the same perturbation DOES shift the cascade (teeth)', () => {
    const clean = signature(42, 0, false);
    const perturbed = signature(42, 5, false);
    expect(perturbed).not.toBe(clean);
  });
});
