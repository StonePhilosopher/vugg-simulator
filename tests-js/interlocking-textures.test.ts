// tests-js/interlocking-textures.test.ts — Proposal D (2026-05).
//
// Pins the two fixes in the growth loop:
//   1. Per-iteration dampener recomputation (drops gem_pegmatite peak
//      slightly; the bulk of its overshoot is a pre-existing habit-
//      oscillation bug — see v75 history note in js/15-version.ts).
//   2. Single-zone volume clamp: no single crystal's zone can push
//      vugFill past 1.0. Searles remains the high-fill positive control.
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
  describe('sabkha_dolomitization: corrected sulfate replacement does not invent a seal', () => {
    it('peak vugFill remains finite and far below the cavity ceiling', () => {
      const { peakFill } = runFull('sabkha_dolomitization');
      expect(Number.isFinite(peakFill)).toBe(true);
      expect(peakFill).toBeGreaterThan(0);
      expect(peakFill, `authoritative sabkha fill ${peakFill.toFixed(4)}`).toBeLessThan(0.05);
    });

    it('does not seal or falsely tag low-fill crystals as late-interlocking', () => {
      const { sim, sealedStep } = runFull('sabkha_dolomitization');
      expect(sealedStep).toBeNull();
      const interlocking = sim.crystals.filter((c: any) => c.late_interlocking);
      expect(interlocking.length).toBe(0);
      const replaced = sim.crystals.filter((c: any) =>
        c.mineral === 'anhydrite'
        && c.phase_transition_history?.some((row: any) => row.from === 'selenite' && row.to === 'anhydrite'));
      expect(replaced.length).toBeGreaterThan(0);
    });
  });

  describe('naica_geothermal: Cave of Crystals remains an open cavity', () => {
    it('grows gypsum without falsely sealing the cave', () => {
      const { sim, peakFill, sealedStep } = runFull('naica_geothermal');
      expect(peakFill).toBeGreaterThan(0);
      expect(peakFill, `naica peak ${peakFill.toFixed(6)}`).toBeLessThan(0.05);
      expect(sealedStep).toBeNull();
      expect(sim.crystals.some((c: any) => c.mineral === 'selenite' && !c.dissolved)).toBe(true);
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
    it('the high-fill Searles control produces late_interlocking-tagged crystals', () => {
      // The flag goes on crystals
      // whose growth was either clamped at the cavity ceiling OR happened
      // under the high-fill boundary-layer regime (≥0.85 with dampener<1).
      const { sim } = runFull('searles_lake');
      const tagged = sim.crystals.filter((c: any) => c.late_interlocking).length;
      expect(tagged).toBeGreaterThanOrEqual(1);
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
