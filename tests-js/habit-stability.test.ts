// tests-js/habit-stability.test.ts — habit-stability fix (2026-05-18).
//
// Closes the residual gem_pegmatite (5.75×) and radioactive_pegmatite
// (4.07×) overshoots from Proposal D. Root cause: get_vug_fill computed
// each crystal's ellipsoid volume from (total_growth_um, current
// crystal.habit) — reinterpreting the same stored growth through whatever
// habit happened to be set this step. A growth engine that flips habit
// between 'tabular' (aRatio=1.5, vol coeff 1.178) and 'prismatic' (aRatio=
// 0.4, vol coeff 0.0838) caused a 14× swing for that one crystal.
//
// Fix: zone-integrated volume. Crystal._volume_mm3 accumulates shell
// volumes from each positive zone at the habit aRatio AS-OF-THAT-ZONE.
// get_vug_fill sums _volume_mm3 — no more reinterpretation.
//
// See js/15-version.ts v76 history note for the full design rationale.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const SCENARIOS: any;
declare const setSeed: any;
declare const Crystal: any;
declare const GrowthZone: any;

function runFull(scenarioName: string) {
  setSeed(42);
  const { conditions, events, defaultSteps } = SCENARIOS[scenarioName]();
  const sim = new VugSimulator(conditions, events);
  let peakFill = 0;
  for (let i = 0; i < (defaultSteps ?? 100); i++) {
    sim.run_step();
    const fill = sim.get_vug_fill();
    if (fill > peakFill) peakFill = fill;
  }
  return { sim, peakFill };
}

describe('habit-stability fix — zone-integrated volume (2026-05-18)', () => {
  describe('overshoot elimination across all high-fill scenarios', () => {
    // Pre-fix peak vugFill (from RESEARCH-GROWTH-AT-HIGH-FILL.md §2 + the
    // tools/high_fill_probe.mjs output history):
    //   sabkha_dolomitization: 2.517 (pre-Prop-D), 1.000 (post-Prop-D)
    //   naica_geothermal:      1.004 (pre-Prop-D), 1.000 (post-Prop-D)
    //   searles_lake:          1.008 (pre-Prop-D), 1.001 (post-Prop-D)
    //   supergene_oxidation:   1.000 (pre-Prop-D), 1.000 (post-Prop-D)
    //   gem_pegmatite:         7.462 → 5.751 (post-Prop-D, residual)
    //   radioactive_pegmatite: 4.117 → 4.066 (post-Prop-D, residual)
    //
    // After habit-stability fix: ALL six should be ≤ 1.0 + small float
    // wobble tolerance. The simulator can no longer report fill > 1.0
    // because _volume_mm3 is incrementally cap-clamped by Proposal D.
    it.each([
      'sabkha_dolomitization',
      'naica_geothermal',
      'searles_lake',
      'supergene_oxidation',
      'gem_pegmatite',
      'radioactive_pegmatite',
    ])('%s peak vugFill ≤ 1.001 (cleanly sealed)', (scenarioName) => {
      const { peakFill } = runFull(scenarioName);
      expect(peakFill, `${scenarioName} peak ${peakFill.toFixed(4)}`).toBeLessThan(1.001);
    });
  });

  describe('zone-integrated _volume_mm3 is stable under habit oscillation', () => {
    it('switching crystal.habit between tabular and prismatic does NOT change accumulated volume', () => {
      // Reproduce the bug: a crystal whose habit flips each zone. Pre-fix,
      // get_vug_fill would reinterpret the WHOLE crystal through the latest
      // habit's aRatio (volume coefficient 14× different between the two).
      // Post-fix, each zone's contribution is locked in at deposition.
      const crystal = new Crystal({ mineral: 'adamite', crystal_id: 1 });
      crystal.habit = 'tabular';
      crystal.add_zone(new GrowthZone({ step: 1, thickness_um: 1000, growth_rate: 1000 }));
      const v_after_tabular = crystal._volume_mm3;
      expect(v_after_tabular, 'tabular zone should contribute non-zero volume')
        .toBeGreaterThan(0);

      // Now flip habit and add a same-size zone. Pre-fix: the WHOLE volume
      // would be reinterpreted as prismatic (14× smaller for that crystal).
      // Post-fix: only the new zone uses prismatic aRatio; the existing
      // tabular zone's contribution stays in _volume_mm3.
      crystal.habit = 'prismatic';
      crystal.add_zone(new GrowthZone({ step: 2, thickness_um: 1000, growth_rate: 1000 }));
      const v_after_both = crystal._volume_mm3;

      // v_after_both should be GREATER than v_after_tabular (the prismatic
      // zone added some volume on top). Crucially, it should NOT have
      // dropped to ~v_after_tabular / 14 (which is what the pre-fix
      // reinterpretation would have produced).
      expect(v_after_both,
        `volume should grow when adding a zone, not shrink (was ${v_after_tabular.toFixed(2)}, now ${v_after_both.toFixed(2)})`)
        .toBeGreaterThan(v_after_tabular);
      // Specifically: the prismatic zone contributes (π/6) × 0.4² × (c_new³ - c_old³)
      // with timeScale=5: c_old = 5mm, c_new = 10mm. Δ = (π/6) × 0.16 × (1000 - 125) ≈ 73.3
      // The tabular zone contributed (π/6) × 1.5² × (125 - 0) ≈ 147.3.
      // Total ≈ 220 (give or take timeScale). Sanity: v_after_both should be ≈ 1.5× v_after_tabular.
      expect(v_after_both / v_after_tabular,
        `growth ratio should be in [1.2, 2.0] range, was ${(v_after_both/v_after_tabular).toFixed(2)}`)
        .toBeGreaterThan(1.2);
      expect(v_after_both / v_after_tabular).toBeLessThan(2.0);
    });

    it('each zone stamps its own aspect_ratio for snapshot/replay fidelity', () => {
      const crystal = new Crystal({ mineral: 'adamite', crystal_id: 1 });
      crystal.habit = 'tabular';
      crystal.add_zone(new GrowthZone({ step: 1, thickness_um: 500, growth_rate: 500 }));
      crystal.habit = 'prismatic';
      crystal.add_zone(new GrowthZone({ step: 2, thickness_um: 500, growth_rate: 500 }));
      expect(crystal.zones[0].aspect_ratio,
        `zone 0 (tabular at deposition) should have aspect_ratio = 1.5`)
        .toBeCloseTo(1.5, 5);
      expect(crystal.zones[1].aspect_ratio,
        `zone 1 (prismatic at deposition) should have aspect_ratio = 0.4`)
        .toBeCloseTo(0.4, 5);
    });

    it('dissolution scales _volume_mm3 proportionally (cube of c shrinkage)', () => {
      const crystal = new Crystal({ mineral: 'adamite', crystal_id: 1 });
      crystal.habit = 'prismatic';
      crystal.add_zone(new GrowthZone({ step: 1, thickness_um: 1000, growth_rate: 1000 }));
      const v_before = crystal._volume_mm3;
      const c_before = crystal.c_length_mm;
      expect(v_before).toBeGreaterThan(0);

      // Dissolve half the crystal (in linear c terms). Volume should drop by 7/8.
      crystal.add_zone(new GrowthZone({ step: 2, thickness_um: -c_before * 1000 / 2 / 5, growth_rate: 0 }));
      // (note: zone.thickness_um gets * timeScale=5 in add_zone, so we pre-divide by 5)
      const v_after = crystal._volume_mm3;
      const c_after = crystal.c_length_mm;
      // Volume ratio should equal (c_after/c_before)³
      const expectedRatio = Math.pow(c_after / c_before, 3);
      const actualRatio = v_after / v_before;
      expect(actualRatio,
        `dissolution volume ratio ${actualRatio.toFixed(3)} should ≈ (c ratio)³ = ${expectedRatio.toFixed(3)}`)
        .toBeCloseTo(expectedRatio, 3);
    });
  });

  describe('a_width_mm derives from _volume_mm3 for renderer stability', () => {
    it('crystal width is consistent with growth history, not flipping with habit', () => {
      const crystal = new Crystal({ mineral: 'adamite', crystal_id: 1 });
      crystal.habit = 'tabular';
      crystal.add_zone(new GrowthZone({ step: 1, thickness_um: 1000, growth_rate: 1000 }));
      const aw_tab = crystal.a_width_mm;
      // Flip habit but don't add growth. a_width_mm should stay essentially
      // unchanged (the underlying _volume_mm3 didn't change).
      // (We can't actually test "no zone added" because the rederivation
      //  happens in add_zone — so test by adding a no-thickness zone.)
      crystal.habit = 'prismatic';
      crystal.add_zone(new GrowthZone({ step: 2, thickness_um: 0, growth_rate: 0 }));
      const aw_prism = crystal.a_width_mm;
      // Width shouldn't have changed since the crystal didn't grow.
      // (Pre-fix, habit='prismatic' would have made a_width_mm = c × 0.4 →
      //  dramatically narrower than habit='tabular' = c × 1.5.)
      expect(aw_prism, `a_width post-habit-flip ${aw_prism.toFixed(3)} vs pre ${aw_tab.toFixed(3)}`)
        .toBeCloseTo(aw_tab, 3);
    });
  });
});
