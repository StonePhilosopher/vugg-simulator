// tests-js/habit-fill-transitions.test.ts — Proposal B (2026-05).
//
// Habit transition triggers on fill × σ. Pins:
//   * selectHabitVariant accepts a localFill parameter (5th argument)
//   * Variants with "high fill" / "drusy" / "post-seal" trigger keywords
//     score higher when localFill > 0.75 (or > 0.95 for post-seal)
//   * Variants with "low fill" trigger keywords score higher when
//     localFill < 0.7
//   * NEW variants added for calcite + quartz + aragonite carry the
//     expected high-fill keywords
//   * End-to-end: in a high-fill bias environment, halite hopper_growth
//     fires more often than cubic
//
// See proposals/RESEARCH-GROWTH-AT-HIGH-FILL.md §5 (Proposal B) and §6
// (Recommended path — Tier 2).

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

declare const selectHabitVariant: any;
declare const setSeed: any;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUTHORED_SPEC = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'data', 'minerals.json'), 'utf8'),
).minerals;

describe('Proposal B — habit transitions on fill × σ', () => {
  describe('data discipline — new variants and updated triggers', () => {
    it('calcite has a druzy_crust variant with high-fill trigger', () => {
      const v = AUTHORED_SPEC.calcite.habit_variants.find(
        (x: any) => x.name === 'druzy_crust'
      );
      expect(v, 'calcite should have a druzy_crust variant').toBeDefined();
      expect(v.trigger.toLowerCase()).toMatch(/high fill|drusy/);
      expect(v.vector).toBe('coating');
    });

    it('quartz has a microcrystalline variant with high-fill trigger', () => {
      const v = AUTHORED_SPEC.quartz.habit_variants.find(
        (x: any) => x.name === 'microcrystalline'
      );
      expect(v, 'quartz should have a microcrystalline variant').toBeDefined();
      expect(v.trigger.toLowerCase()).toMatch(/high fill|drusy/);
      expect(v.vector).toBe('coating');
    });

    it('aragonite has a botryoidal_crust variant with high-fill trigger', () => {
      const v = AUTHORED_SPEC.aragonite.habit_variants.find(
        (x: any) => x.name === 'botryoidal_crust'
      );
      expect(v, 'aragonite should have a botryoidal_crust variant').toBeDefined();
      expect(v.trigger.toLowerCase()).toMatch(/high fill/);
      expect(v.vector).toBe('coating');
    });

    it('halite hopper_growth + cottonball/borax + sylvite hopper_cube triggers updated for high-fill', () => {
      const halite_hopper = AUTHORED_SPEC.halite.habit_variants.find(
        (x: any) => x.name === 'hopper_growth'
      );
      expect(halite_hopper.trigger.toLowerCase()).toMatch(/high fill/);

      const borax_cotton = AUTHORED_SPEC.borax.habit_variants.find(
        (x: any) => x.name === 'cottonball'
      );
      expect(borax_cotton.trigger.toLowerCase()).toMatch(/high fill/);

      const sylvite_hopper = AUTHORED_SPEC.sylvite.habit_variants.find(
        (x: any) => x.name === 'hopper_cube'
      );
      expect(sylvite_hopper.trigger.toLowerCase()).toMatch(/high fill/);
    });
  });

  describe('selectHabitVariant — accepts localFill and biases selection', () => {
    it('calcite at high fill (0.9) picks druzy_crust more often than at low fill (0.3)', () => {
      // 1000 trials each, same σ + T + spaceConstrained — only fill differs.
      setSeed(42);
      let drusy_at_high = 0;
      for (let i = 0; i < 1000; i++) {
        const v = selectHabitVariant('calcite', 1.5, 100, false, 0.9);
        if (v && v.name === 'druzy_crust') drusy_at_high++;
      }
      setSeed(42);
      let drusy_at_low = 0;
      for (let i = 0; i < 1000; i++) {
        const v = selectHabitVariant('calcite', 1.5, 100, false, 0.3);
        if (v && v.name === 'druzy_crust') drusy_at_low++;
      }
      expect(drusy_at_high, `druzy_crust at fill=0.9: ${drusy_at_high}, at fill=0.3: ${drusy_at_low}`)
        .toBeGreaterThan(drusy_at_low * 2);
    });

    it('halite at high fill (0.9) picks hopper_growth or fibrous_coating more often than cubic', () => {
      setSeed(42);
      let cubic_at_high = 0;
      let high_fill_variants = 0;
      for (let i = 0; i < 1000; i++) {
        const v = selectHabitVariant('halite', 1.5, 30, false, 0.9);
        if (v?.name === 'cubic') cubic_at_high++;
        else if (v?.name === 'hopper_growth' || v?.name === 'fibrous_coating') high_fill_variants++;
      }
      expect(high_fill_variants, `high-fill variants at fill=0.9: ${high_fill_variants}, cubic: ${cubic_at_high}`)
        .toBeGreaterThan(cubic_at_high);
    });

    it('quartz at high fill (0.9) with low σ picks microcrystalline more often than at low fill (0.3)', () => {
      setSeed(42);
      let micro_at_high = 0;
      for (let i = 0; i < 1000; i++) {
        const v = selectHabitVariant('quartz', 1.2, 100, false, 0.9);
        if (v?.name === 'microcrystalline') micro_at_high++;
      }
      setSeed(42);
      let micro_at_low = 0;
      for (let i = 0; i < 1000; i++) {
        const v = selectHabitVariant('quartz', 1.2, 100, false, 0.3);
        if (v?.name === 'microcrystalline') micro_at_low++;
      }
      expect(micro_at_high, `microcrystalline at fill=0.9: ${micro_at_high}, at fill=0.3: ${micro_at_low}`)
        .toBeGreaterThan(micro_at_low * 2);
    });

    it('legacy callers without localFill still get sensible variant selection (backward compat)', () => {
      // Pre-Proposal-B call signature with 4 args. Should still work; the
      // fill scoring branch is skipped when localFill is undefined.
      setSeed(42);
      const v = selectHabitVariant('calcite', 1.5, 100, false);
      expect(v, 'should still return a valid variant').toBeTruthy();
      expect(['scalenohedral_dogtooth', 'rhombohedral_nailhead', 'prismatic',
              'botryoidal', 'flos-ferri_acicular', 'druzy_crust'])
        .toContain(v.name);
    });
  });

  describe('selectHabitVariant source has localFill in its signature + scoring branch', () => {
    it('function signature includes localFill parameter', () => {
      const src = selectHabitVariant.toString();
      expect(src, 'signature should accept localFill').toMatch(/localFill/);
      expect(src, 'should have high fill scoring branch').toMatch(/high fill|high-fill|drusy/);
    });
  });
});
