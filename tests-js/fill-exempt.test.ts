// tests-js/fill-exempt.test.ts — Backlog K (2026-05).
//
// Pins the per-mineral fill-cap exemption that lets paragenetically-late
// efflorescent / interstitial crusts continue to nucleate after the
// cavity hits >=95% fill.
//
// What this asserts:
//   * The four authored fill-exempt minerals (borax, mirabilite,
//     thenardite, sylvite) carry fill_exempt:true + a _retune_note in
//     MINERAL_SPEC. The set is small + intentional — the test is a
//     guard against silently bumping random minerals into exemption.
//   * Every fill-exempt mineral also carries the _retune_note field
//     (audit-trail discipline; matches the Tier 2 F twin-retune pattern).
//   * _atNucleationCap blocks a non-exempt mineral when _fillCapped is
//     set, regardless of per-mineral count. _atNucleationCap allows a
//     fill-exempt mineral through the same gate.
//   * End-to-end: in a fixture sim with high vugFill (synthesized by
//     pre-populating sim.crystals), check_nucleation can still let
//     borax/mirabilite engines fire while halite/calcite engines are
//     locked out.
//
// What this is NOT testing:
//   * That borax/mirabilite actually nucleate in searles_lake's 300-step
//     run. That's a coverage-tool concern (tools/mineral_coverage_check.mjs)
//     and depends on σ-gates lining up — orthogonal to the fill-cap fix.
//     A future test could pin that searles_lake's expects_species clears
//     fully, but it'd be a brittle calibration check that drifts whenever
//     evaporite chemistry is re-tuned.

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const VugWall: any;
declare const FluidChemistry: any;
declare const MINERAL_SPEC: any;
declare const SCENARIOS: any;
declare const setSeed: any;

// The canonical fill-exempt set (Backlog K). If a future agent adds a
// fifth, update this list AND the _retune_note on the new entry.
const AUTHORED_FILL_EXEMPT = ['borax', 'mirabilite', 'thenardite', 'sylvite'];

// Read the authored spec straight from data/minerals.json for the
// data-discipline checks. The bundle's globalThis.MINERAL_SPEC was
// captured at IIFE-return time — before the async _loadSpec() resolved —
// so it still points at MINERAL_SPEC_FALLBACK from the test's vantage.
// The engine code reads the live spec through closure (a single
// `MINERAL_SPEC = doc.minerals;` reassign inside the IIFE scope), so
// _atNucleationCap sees the truth; the test's globalThis view is stale
// only for the static discipline assertions, where the JSON is the
// source of truth anyway.
//
// Same pattern as tools/twin_rate_check.mjs + tools/mineral_coverage_check.mjs.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTHORED_SPEC = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8'),
).minerals;

function makeBareConditions(wallOpts: any = {}) {
  return new VugConditions({
    fluid: new FluidChemistry({
      Ca: 100, CO3: 100, Na: 100, S: 50, B: 50,
      pH: 8.0, concentration: 1.0,
    }),
    wall: new VugWall(wallOpts),
    temperature: 25,
    pressure_bars: 1,
  });
}

describe('Backlog K — fill-cap exemption', () => {
  describe('authored data discipline', () => {
    it('the canonical four minerals all carry fill_exempt:true', () => {
      for (const m of AUTHORED_FILL_EXEMPT) {
        const entry = AUTHORED_SPEC[m];
        expect(entry, `data/minerals.json[${m}] missing`).toBeTruthy();
        expect(entry.fill_exempt, `${m}.fill_exempt should be true`).toBe(true);
      }
    });

    it('every fill_exempt mineral carries a _retune_note_fill_exempt audit trail', () => {
      for (const m of AUTHORED_FILL_EXEMPT) {
        const note = AUTHORED_SPEC[m]._retune_note_fill_exempt;
        expect(typeof note, `${m} should have a _retune_note_fill_exempt`).toBe('string');
        expect(note.length, `${m}._retune_note_fill_exempt should be substantive`).toBeGreaterThan(60);
        expect(note, `${m}._retune_note_fill_exempt should be dated`).toMatch(/2026-05/);
      }
    });

    it('the set stays small — guard against accidental sprawl', () => {
      const all = Object.keys(AUTHORED_SPEC).filter(m => AUTHORED_SPEC[m]?.fill_exempt === true);
      // If we ever legitimately add a 5th, bump this. The point is: adding
      // a mineral to the exempt set is a deliberate calibration decision,
      // not something to slip in unnoticed.
      expect(all.length).toBeLessThanOrEqual(6);
      // And every member of the live set should be in the canonical list
      // we audit-trail tested above (otherwise we have an undocumented
      // exemption).
      for (const m of all) {
        expect(AUTHORED_FILL_EXEMPT, `${m} is fill_exempt but not in canonical list`)
          .toContain(m);
      }
    });
  });

  describe('_atNucleationCap honors the fill dampener state', () => {
    // Proposal A (2026-05) replaced the binary _fillCapped flag with a
    // continuous _fillDampener (sigmoid 1.0 → 0 across vugFill 0.7–1.0).
    // Tests below pin the new probabilistic API: when dampener < 1.0,
    // _atNucleationCap rolls one RNG number per call; fill_exempt
    // minerals bypass the roll entirely.

    it('a dampener of 1.0 (or absent) never blocks on fill grounds', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      // No dampener stashed → no fill-based blocking.
      expect(sim._atNucleationCap('calcite')).toBe(false);
      sim._fillDampener = 1.0;
      expect(sim._atNucleationCap('calcite')).toBe(false);
    });

    it('a dampener of 0.0 always blocks non-exempt minerals (and consumes one RNG)', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim._fillDampener = 0.0;
      // rng.random() >= 0.0 is always true → blocked.
      expect(sim._atNucleationCap('calcite')).toBe(true);
      expect(sim._atNucleationCap('quartz')).toBe(true);
      expect(sim._atNucleationCap('halite')).toBe(true);
    });

    it('fill_exempt minerals bypass the dampener entirely', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim._fillDampener = 0.0;
      // The four authored fill-exempt minerals — none should be capped
      // even at dampener=0 (they only respect max_nucleation_count).
      for (const m of AUTHORED_FILL_EXEMPT) {
        expect(sim._atNucleationCap(m), `${m} should NOT be capped under fill dampener`).toBe(false);
      }
    });

    it('still respects the per-mineral max_nucleation_count even when fill-exempt', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim._fillDampener = 0.0;
      // borax has max_nucleation_count: 8. Stuff 8 exposed borax crystals
      // into sim.crystals and the cap should now fire.
      for (let i = 0; i < 8; i++) {
        sim.crystals.push({ mineral: 'borax', enclosed_by: null, dissolved: false });
      }
      expect(sim._atNucleationCap('borax')).toBe(true);
    });

    it('a missing/unknown mineral name returns true when dampener is 0', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim._fillDampener = 0.0;
      // No spec entry → not fill_exempt → dampener gate blocks.
      expect(sim._atNucleationCap('nonexistent_mineral_xyz')).toBe(true);
    });

    it('partial dampener gates probabilistically — over many rolls, blocked ≈ 1-dampener', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim._fillDampener = 0.5;
      // With dampener=0.5 and propensity=0, blocked ≈ 50%. Over 1000
      // rolls expect 400-600 blocks (very loose CI to avoid flakes on
      // RNG fluctuation). Use 'galena' as the vanilla-bulk anchor —
      // Proposal C (2026-05) gave calcite/quartz/many minerals non-zero
      // late_stage_propensity, so they no longer behave as "vanilla"
      // dampener subjects. Galena is the canonical bulk MVT sulfide
      // with no propensity (defaults to 0).
      let blocked = 0;
      for (let i = 0; i < 1000; i++) {
        if (sim._atNucleationCap('galena')) blocked++;
      }
      expect(blocked).toBeGreaterThan(400);
      expect(blocked).toBeLessThan(600);
    });
  });

  describe('check_nucleation sets _fillDampener', () => {
    it('dampener = 1.0 below vugFill 0.7', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim.check_nucleation(0.5);
      expect(sim._fillDampener).toBe(1.0);
      sim.check_nucleation(0.7);
      expect(sim._fillDampener).toBe(1.0);
    });

    it('dampener ≈ 0.5 at vugFill 0.85 (the sigmoid midpoint)', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim.check_nucleation(0.85);
      expect(sim._fillDampener).toBeCloseTo(0.5, 2);
    });

    it('dampener ≈ 0.12 at vugFill 0.95 (matches the proposal anchor)', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim.check_nucleation(0.95);
      expect(sim._fillDampener).toBeGreaterThan(0.08);
      expect(sim._fillDampener).toBeLessThan(0.15);
    });

    it('dampener = 0.0 at vugFill >= 1.0 (hard floor)', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim.check_nucleation(1.0);
      expect(sim._fillDampener).toBe(0.0);
      sim.check_nucleation(1.5);
      expect(sim._fillDampener).toBe(0.0);
    });

    it('undefined vugFill means dampener = 1.0 (legacy single-arg callers)', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      sim._fillDampener = 0.5; // poison
      sim.check_nucleation(undefined);
      expect(sim._fillDampener).toBe(1.0);
    });

    it('dampener is monotonically non-increasing in vugFill', () => {
      setSeed(42);
      const sim = new VugSimulator(makeBareConditions(), []);
      const samples = [0.0, 0.3, 0.5, 0.7, 0.75, 0.80, 0.85, 0.90, 0.95, 0.99, 1.0, 1.5];
      let prev = Infinity;
      for (const f of samples) {
        sim.check_nucleation(f);
        expect(sim._fillDampener, `dampener at ${f} should be ≤ previous`).toBeLessThanOrEqual(prev);
        prev = sim._fillDampener;
      }
    });
  });

  describe('searles_lake scenario end-to-end (smoke)', () => {
    // The point of Backlog K is for searles_lake to clear its remaining
    // 2 stale minerals (borax + mirabilite). The full coverage check
    // lives in tools/mineral_coverage_check.mjs (~10s sweep across
    // 10 seeds × 24 scenarios). This smoke test asserts the cheap
    // end of the spectrum: that at least one of borax / mirabilite
    // shows up in a 300-step searles_lake run on at least one seed in
    // a tight 5-seed band. If this fails, the fix has regressed even
    // before the broader sweep runs.
    it('borax/mirabilite or their dehydration products nucleate in at least one searles_lake run', { timeout: 60000 }, () => {
      // v161: explicit 60s timeout. The v160 per-voxel diffusion added
      // ~4-6 ms/step; this multi-seed searles_lake sweep runs comfortably
      // in isolation (~12s) but tips past the 30s default under parallel
      // suite CPU contention. Coverage assertion is unaffected — sim
      // output is byte-identical; purely the heavier per-step cost.
      //
      // v84 (2026-05-19): the cap-conservation fix
      // (_atNucleationCap now counts paramorph_origin) means a borax
      // that nucleates then dehydrates to tincalconite still consumes
      // the borax cap budget; the cap doesn't reopen for fresh borax.
      // With searles_lake's dry-ring conditions, most borax/mirabilite
      // crystals DO transform to their dehydration products by run-
      // end. The pin now counts crystals where mineral OR
      // paramorph_origin is borax / mirabilite — capturing the full
      // late-evaporite-crust assemblage including post-dehydration
      // tincalconite + thenardite. Same semantic as the realgar-
      // origin pin in realgar-orpiment.test.ts.
      const seeds = [42, 1, 7, 13, 23];
      let anyEvaporiteCrust = 0;
      for (const seed of seeds) {
        setSeed(seed);
        const scen = SCENARIOS['searles_lake'];
        if (!scen) continue; // scenario gated/disabled — skip rather than fail
        const { conditions, events, defaultSteps } = scen();
        const sim = new VugSimulator(conditions, events);
        const steps = defaultSteps ?? 300;
        for (let i = 0; i < steps; i++) sim.run_step();
        const hasBorax = sim.crystals.some((c: any) =>
          c.mineral === 'borax' || c.paramorph_origin === 'borax',
        );
        const hasMirab = sim.crystals.some((c: any) =>
          c.mineral === 'mirabilite' || c.paramorph_origin === 'mirabilite',
        );
        if (hasBorax || hasMirab) anyEvaporiteCrust++;
      }
      // At least 1 of 5 seeds should produce the evaporite crust
      // (borax/mirabilite-origin) now that fill-exempt unlocks the
      // path. Was 0/5 before Backlog K (handoff §4: "halite fills
      // cavity > 95% before borax's rare-event 12% gate fires").
      expect(anyEvaporiteCrust,
        'no seed produced borax/mirabilite-origin crystals — Backlog K regressed').toBeGreaterThanOrEqual(1);
    });
  });
});
