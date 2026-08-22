// tests-js/pararealgar.test.ts — light-induced isomerization pins
// (2026-05-19, v84).
//
// Pararealgar (As4S4, Cs symmetry) is the structural isomer of
// realgar (As4S4, D2d symmetry). Forms EXCLUSIVELY as a post-
// formation transformation of realgar after sufficient visible-
// light exposure (>500 nm). Per research-meta-minerals-pararealgar.md
// (Bonazzi et al. 1996 Mineralogical Magazine 60:401-409; Roberts
// et al. 1980).
//
// The ONLY light-induced transformation modeled in the simulator.
// Distinct from PARAMORPH_TRANSITIONS (T-driven) and
// DEHYDRATION_TRANSITIONS (humidity-driven).
//
// What this catches:
//   * The transformation actually fires when realgar exists in a
//     lit cavity for sufficient steps.
//   * The is_lit=false opt-out preserves realgar indefinitely
//     (sealed-rock or museum-dark-storage scenarios).
//   * Cap conservation: a transformed realgar still counts toward
//     realgar's nucleation cap (transformed crystals don't open
//     the cap for fresh realgar to nucleate).
//   * The paramorph_origin field is set correctly so the renderer
//     + downstream consumers can distinguish realgar-derived
//     pararealgar from any future direct-nucleated pararealgar.

import { describe, expect, it } from 'vitest';

declare const VugSimulator: any;
declare const VugConditions: any;
declare const FluidChemistry: any;
declare const VugWall: any;
declare const Crystal: any;
declare const SCENARIOS: any;
declare const setSeed: any;

function runSulphurBank(seed: number, opts: any = {}) {
  setSeed(seed);
  const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
  if (opts.darkVug) {
    conditions.wall.is_lit = false;
    conditions.wall.light_exposure = 'dark';
  }
  const sim = new VugSimulator(conditions, events);
  const steps = defaultSteps ?? 200;
  for (let i = 0; i < steps; i++) sim.run_step();
  return sim;
}

describe('Pararealgar — light-induced realgar isomerization (v84)', () => {
  describe('transformation fires at Sulphur Bank (lit vug)', () => {
    it.each([42, 1, 7])('seed %d: pararealgar crystals exist after run', (seed) => {
      const sim = runSulphurBank(seed);
      const para = sim.crystals.filter((c: any) => c.mineral === 'pararealgar');
      expect(para.length, `seed ${seed}: no pararealgar formed`).toBeGreaterThan(0);
    });

    it.each([42, 1, 7])('seed %d: all pararealgar have paramorph_origin = "realgar"', (seed) => {
      const sim = runSulphurBank(seed);
      const para = sim.crystals.filter((c: any) => c.mineral === 'pararealgar');
      for (const c of para) {
        expect(c.paramorph_origin,
          `seed ${seed}: pararealgar #${c.crystal_id} paramorph_origin = ${c.paramorph_origin}`)
          .toBe('realgar');
      }
    });

    it.each([42, 1, 7])('seed %d: pararealgar crystals have light_exposure_steps >= 60 threshold', (seed) => {
      const sim = runSulphurBank(seed);
      const para = sim.crystals.filter((c: any) => c.mineral === 'pararealgar');
      for (const c of para) {
        expect(c.light_exposure_steps,
          `seed ${seed}: pararealgar #${c.crystal_id} light_exposure = ${c.light_exposure_steps}`)
          .toBeGreaterThanOrEqual(60);
      }
    });
  });

  describe('is_lit=false opt-out preserves realgar (sealed-cavity / dark-storage)', () => {
    it.each([42, 1, 7])('seed %d: dark vug has zero pararealgar', (seed) => {
      const sim = runSulphurBank(seed, { darkVug: true });
      const para = sim.crystals.filter((c: any) => c.mineral === 'pararealgar');
      expect(para.length,
        `seed ${seed} (dark): unexpected ${para.length} pararealgar — light exposure should be blocked`)
        .toBe(0);
    });

    it.each([42, 1, 7])('seed %d: dark vug preserves realgar', (seed) => {
      const sim = runSulphurBank(seed, { darkVug: true });
      const realgar = sim.crystals.filter((c: any) =>
        c.mineral === 'realgar' && c.active,
      );
      expect(realgar.length,
        `seed ${seed} (dark): expected at least 4 active realgar (cap=6); got ${realgar.length}`)
        .toBeGreaterThanOrEqual(4);
    });
  });

  describe('cap conservation (the load-bearing _atNucleationCap fix)', () => {
    // v84 added paramorph_origin to the cap accounting. Pre-fix,
    // a realgar transforming to pararealgar dropped realgar's
    // active count, reopening the cap for fresh realgar nucleations
    // — letting MORE realgar-origin crystals form than the spec
    // allowed (e.g. spec cap=6 but actual = 21 in the early test
    // runs because cap reopened on each transformation). Post-fix,
    // total realgar-origin crystals <= spec max_nucleation_count.
    it.each([42, 1, 7])('seed %d: realgar-origin count <= spec cap (6)', (seed) => {
      const sim = runSulphurBank(seed);
      const realgarOrigin = sim.crystals.filter((c: any) =>
        c.mineral === 'realgar' || c.paramorph_origin === 'realgar',
      );
      expect(realgarOrigin.length,
        `seed ${seed}: total realgar-origin count was ${realgarOrigin.length} (cap is 6)`)
        .toBeLessThanOrEqual(6);
    });
  });

  describe('LIGHT-INDUCED log line appears in run output', () => {
    it('seed 42: at least one transition is logged', () => {
      setSeed(42);
      const { conditions, events, defaultSteps } = SCENARIOS['sulphur_bank']();
      const sim = new VugSimulator(conditions, events);
      let logCount = 0;
      for (let i = 0; i < (defaultSteps ?? 200); i++) {
        sim.run_step();
        for (const line of sim.log) {
          if (line.includes('LIGHT-INDUCED')) logCount++;
        }
      }
      expect(logCount, `expected at least 1 LIGHT-INDUCED log; got ${logCount}`)
        .toBeGreaterThan(0);
    });
  });

  describe('explicit geological light boundary', () => {
    it('VugWall defaults dark and cannot infer exposure from omission', () => {
      const w = new VugWall({});
      expect(w.is_lit).toBe(false);
      expect(w.light_exposure).toBe('dark');
    });

    it('WallState.is_lit honors explicit false', () => {
      const w = new VugWall({ is_lit: false });
      expect(w.is_lit).toBe(false);
    });

    it('Sulphur Bank explicitly authors a surface exposure route', () => {
      const { conditions } = SCENARIOS['sulphur_bank']();
      expect(conditions.wall.is_lit).toBe(true);
      expect(conditions.wall.light_exposure).toBe('surface');
    });

    it('records the exact route on altered pararealgar', () => {
      const sim = runSulphurBank(42);
      const para = sim.crystals.find((c: any) => c.mineral === 'pararealgar');
      expect(para?.light_exposure_route).toBe('surface');
    });
  });
});
