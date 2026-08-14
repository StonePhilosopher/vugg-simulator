// tests-js/interlocking-textures.test.ts — Proposal D (2026-05).
//
// Pins the two fixes in the growth loop:
//   1. Per-iteration dampener recomputation (drops gem_pegmatite peak
//      slightly; the bulk of its overshoot is a pre-existing habit-
//      oscillation bug — see v75 history note in js/15-version.ts).
//   2. Single-zone volume clamp: no single crystal's zone can push
//      vugFill past 1.0. Fixes sabkha's 2.5× single-step overshoot.
//
// Tag: crystal.late_interlocking = true when the clamp engages OR when
// growth happens at currentFill ≥ 0.85 under the Proposal A sigmoid
// dampener. Renderer can use this for granular / massive texture.
//
// See proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md §5 (Proposal D spec)
// and the v75 history note for the design rationale + verification
// numbers.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runFull(scenarioName: string) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[scenarioName]();
  const sim = new VugSimulator(conditions, events);
  let peakFill = 0;
  let sealedStep: number | null = null;
  for (let i = 0; i < (defaultSteps ?? 100); i++) {
    sim.run_step();
    const fill = sim.get_vug_fill();
    if (fill > peakFill) peakFill = fill;
    if (fill >= 1.0 && sealedStep === null) sealedStep = i + 1;
  }
  return { sim, peakFill, sealedStep };
}

describe('Proposal D — interlocking textures + single-zone volume clamp', () => {
  describe('sabkha_dolomitization: pre-D single-step 2.5× overshoot is fixed', () => {
    it('peak vugFill stays at ~1.0 (was 2.517 pre-D)', () => {
      const { peakFill } = runFull('sabkha_dolomitization');
      // Pre-D: 2.517 (step 1 single-zone overshoot)
      // Post-D: should be 1.0 (clamped at seal)
      expect(peakFill, `expected ~1.0 (was 2.517 pre-D), got ${peakFill.toFixed(3)}`)
        .toBeLessThan(1.05);
      // Sanity floor: scenario should still reach seal — otherwise the
      // clamp would have over-clamped and prevented legitimate growth.
      expect(peakFill, `should still reach seal, got ${peakFill.toFixed(3)}`)
        .toBeGreaterThan(0.95);
    });

    it('seals early (still saturates quickly) with crystals tagged late_interlocking', () => {
      const { sim, sealedStep } = runFull('sabkha_dolomitization');
      // Pre-D: sealed at step 1 (via single-zone overshoot).
      // Post-D: seals at step 2 (clamp lets step 1 reach 1.0 but not past;
      //         step 2 still has chemistry that consolidates at seal).
      // Either way it's "early" — the scenario is meant to saturate
      // immediately.
      expect(sealedStep, `sabkha should still seal early, got step ${sealedStep}`)
        .not.toBeNull();
      // v228: ≤5 → ≤8. The three step-0-4 quartz crystals that used to bulk
      // sabkha's opening fill were 23.6°C macro-quartz — the unenforced
      // quartz-T_min leak (hostile-review rung 2). With them honestly gone,
      // the brine seals at step 6. "Early" is the claim (a 300-step scenario
      // saturating in its opening beats); the clamp mechanics are unchanged.
      expect(sealedStep!, `sabkha sealedStep ${sealedStep}`).toBeLessThanOrEqual(8);
      // After clamping kicked in, at least one crystal should be tagged
      // late_interlocking (the one whose growth was clamped at seal).
      const interlocking = sim.crystals.filter((c: any) => c.late_interlocking);
      expect(interlocking.length,
        `expected ≥1 late_interlocking crystal in sabkha, got ${interlocking.length}`)
        .toBeGreaterThanOrEqual(1);
    });
  });

  describe('naica_geothermal: clean seal behavior', () => {
    it('peak vugFill stays near 1.0', () => {
      const { peakFill } = runFull('naica_geothermal');
      // Pre-D: 1.004; post-D: 1.000. Small but the principle matters.
      expect(peakFill, `naica peak ${peakFill.toFixed(3)}`).toBeLessThan(1.05);
      expect(peakFill, `naica should reach seal`).toBeGreaterThan(0.95);
    });
  });

  describe('searles_lake: clean seal behavior', () => {
    it('peak vugFill stays near 1.0', () => {
      const { peakFill } = runFull('searles_lake');
      // Pre-D: 1.008; post-D: 1.001.
      expect(peakFill, `searles peak ${peakFill.toFixed(3)}`).toBeLessThan(1.05);
      expect(peakFill, `searles should reach seal`).toBeGreaterThan(0.95);
    });
  });

  describe('late_interlocking tagging', () => {
    it('high-fill scenarios produce late_interlocking-tagged crystals', () => {
      // Of the scenarios that reach seal, sabkha + naica + searles should
      // all have at least one crystal tagged. The flag goes on crystals
      // whose growth was either clamped at the cavity ceiling OR happened
      // under the high-fill boundary-layer regime (≥0.85 with dampener<1).
      const scenarios = ['sabkha_dolomitization', 'naica_geothermal', 'searles_lake'];
      const tagged: Record<string, number> = {};
      for (const sc of scenarios) {
        const { sim } = runFull(sc);
        tagged[sc] = sim.crystals.filter((c: any) => c.late_interlocking).length;
      }
      for (const [sc, count] of Object.entries(tagged)) {
        expect(count, `${sc} should have ≥1 late_interlocking crystal, got ${count}`)
          .toBeGreaterThanOrEqual(1);
      }
    });

    it('low-fill scenarios (mvt, porphyry) produce NO late_interlocking crystals', () => {
      // Negative space — these scenarios stay well below 0.85 fill, so
      // the flag should never fire.
      for (const sc of ['mvt', 'porphyry']) {
        const { sim } = runFull(sc);
        const tagged = sim.crystals.filter((c: any) => c.late_interlocking).length;
        expect(tagged, `${sc} should have 0 late_interlocking crystals, got ${tagged}`)
          .toBe(0);
      }
    });
  });
});
