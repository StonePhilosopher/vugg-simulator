// tests-js/movements.test.ts — geological MOVEMENTS engine (js/85j), Phase 0.
//
// Pins the PURE pieces: the seed-derived movement PRNG (reproducibility — the
// load-bearing property for baselines AND the crystal-cipher sub-project), the
// primitive shape operators (trend/pulse/step/mixing), and the controller's
// two contracts: (1) an EMPTY controller is a total no-op (the dark-scaffold
// sim-neutrality guarantee), (2) an active movement drives its field
// deterministically from the seed with bounded, mean-reverting texture.

import { describe, expect, it } from 'vitest';

declare const _makeMovementRng: any;
declare const _mvTrend: any;
declare const _mvPulse: any;
declare const _mvStep: any;
declare const _mvMixFraction: any;
declare const _evalMovementOps: any;
declare const MovementController: any;
declare const _createMovementController: any;

const conds = () => ({ temperature: 200, fluid: { pH: 6, Eh: 200 } });

describe('movements — seed-derived PRNG (reproducible randomness)', () => {
  it('same vugg seed → identical sequence; different seed → different', () => {
    const a = _makeMovementRng(58);
    const b = _makeMovementRng(58);
    const seqA = Array.from({ length: 8 }, () => a());
    const seqB = Array.from({ length: 8 }, () => b());
    expect(seqA).toEqual(seqB);                       // reproducible
    const c = _makeMovementRng(59);
    const seqC = Array.from({ length: 8 }, () => c());
    expect(seqC).not.toEqual(seqA);                   // seed actually matters
    for (const x of seqA) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(1); }
  });

  it('the salt makes the movement stream independent of same-seeded streams', () => {
    const moves = _makeMovementRng(58);                       // default 'MOVE' salt
    const other = _makeMovementRng(58, 0x700aa517);           // a different sub-stream
    expect(Array.from({ length: 6 }, () => moves()))
      .not.toEqual(Array.from({ length: 6 }, () => other()));
  });
});

describe('movements — primitive shape operators (pure)', () => {
  it('TREND is a monotonic 0→1 smoothstep', () => {
    expect(_mvTrend(0)).toBeCloseTo(0, 6);
    expect(_mvTrend(1)).toBeCloseTo(1, 6);
    expect(_mvTrend(0.5)).toBeCloseTo(0.5, 6);
    let prev = -1;
    for (let u = 0; u <= 1.0001; u += 0.1) { const v = _mvTrend(u); expect(v).toBeGreaterThanOrEqual(prev); prev = v; }
    expect(_mvTrend(0.5, false)).toBeCloseTo(0.5, 6);   // linear variant
    expect(_mvTrend(-1)).toBe(0); expect(_mvTrend(2)).toBe(1);   // clamped
  });

  it('PULSE peaks at its center and decays symmetrically', () => {
    expect(_mvPulse(0.5, 0.5, 0.1)).toBeCloseTo(1, 6);
    expect(_mvPulse(0.4, 0.5, 0.1)).toBeCloseTo(_mvPulse(0.6, 0.5, 0.1), 6); // symmetric
    expect(_mvPulse(0.5, 0.5, 0.1)).toBeGreaterThan(_mvPulse(0.7, 0.5, 0.1)); // decays
  });

  it('STEP is ~0 before the threshold and ~1 after', () => {
    expect(_mvStep(0.2, 0.5)).toBeCloseTo(0, 6);
    expect(_mvStep(0.8, 0.5)).toBeCloseTo(1, 6);
    expect(_mvStep(0.5, 0.5)).toBeCloseTo(0.5, 6);   // half at the threshold
  });

  it('_evalMovementOps sums operators; empty → 0', () => {
    expect(_evalMovementOps(undefined, 0.5)).toBe(0);
    expect(_evalMovementOps([], 0.5)).toBe(0);
    const d = _evalMovementOps([{ kind: 'trend', amp: -50 }, { kind: 'pulse', amp: 10, center: 0.5, width: 0.1 }], 0.5);
    expect(d).toBeCloseTo(-50 * 0.5 + 10 * 1, 6);     // -25 + 10 = -15
  });
});

describe('movements — controller: EMPTY is a total no-op (sim-neutral guarantee)', () => {
  it('isEmpty, and applyStep mutates nothing across many steps', () => {
    const ctl = new MovementController(undefined, 58);
    expect(ctl.isEmpty).toBe(true);
    const c = conds();
    const before = JSON.stringify(c);
    for (let s = 0; s < 50; s++) ctl.applyStep(c, s);
    expect(JSON.stringify(c)).toBe(before);            // byte-identical conditions
  });

  it('_createMovementController yields an empty controller when no scenario opts in', () => {
    const simNoMoves = { _seed: 42, conditions: { wall: { shape_seed: 58 }, _scenario: {} } };
    expect(_createMovementController(simNoMoves).isEmpty).toBe(true);
    const simMoves = { _seed: 42, conditions: { wall: { shape_seed: 58 }, _scenario: { movements: [{ field: 'temperature', startStep: 0, endStep: 5, ops: [{ kind: 'trend', amp: -10 }] }] } } };
    expect(_createMovementController(simMoves).isEmpty).toBe(false);
  });
});

describe('movements — controller: active movement drives its field', () => {
  const coolingSpec = [{ field: 'temperature', startStep: 0, endStep: 10, ops: [{ kind: 'trend', amp: -50 }] }];

  it('a cooling TREND lowers temperature monotonically over its window, then stops', () => {
    const ctl = new MovementController(coolingSpec, 58);
    const c = conds();
    const temps: number[] = [];
    for (let s = 0; s < 15; s++) { ctl.applyStep(c, s); temps.push(c.temperature); }
    expect(temps[0]).toBeCloseTo(200, 6);              // base at u=0
    expect(temps[9]).toBeLessThan(temps[0]);           // cooled by end of window
    expect(temps[9]).toBeGreaterThan(150 - 1);         // approaches base-50
    for (let i = 1; i < 10; i++) expect(temps[i]).toBeLessThanOrEqual(temps[i - 1] + 1e-9);
    expect(temps[14]).toBeCloseTo(temps[9], 6);        // inactive after endStep → held
  });

  it('drives a NESTED field path (fluid.pH)', () => {
    const ctl = new MovementController([{ field: 'fluid.pH', startStep: 0, endStep: 4, ops: [{ kind: 'trend', amp: -2 }] }], 58);
    const c = conds();
    for (let s = 0; s < 4; s++) ctl.applyStep(c, s);
    expect(c.fluid.pH).toBeLessThan(6);                // acidified
    expect(c.temperature).toBe(200);                   // untouched
  });

  it('is REPRODUCIBLE from the seed and seed-SENSITIVE under texture', () => {
    const spec = [{ field: 'fluid.Eh', startStep: 0, endStep: 30, ops: [{ kind: 'trend', amp: 100 }], texture: { theta: 0.4, sigma: 6 } }];
    const run = (seed: number) => {
      const ctl = new MovementController(spec, seed); const c = conds(); const out: number[] = [];
      for (let s = 0; s < 30; s++) { ctl.applyStep(c, s); out.push(c.fluid.Eh); }
      return out;
    };
    expect(run(58)).toEqual(run(58));                  // same seed → identical (bit-reproducible)
    expect(run(59)).not.toEqual(run(58));              // different seed → different texture
  });

  it('texture is mean-reverting (bounded), not a wandering random walk', () => {
    const ctl = new MovementController([{ field: 'fluid.Eh', startStep: 0, endStep: 400, base: 200, texture: { theta: 0.4, sigma: 6 } }], 58);
    const c = conds();
    let maxDev = 0;
    for (let s = 0; s < 400; s++) { ctl.applyStep(c, s); maxDev = Math.max(maxDev, Math.abs(c.fluid.Eh - 200)); }
    expect(maxDev).toBeGreaterThan(0);                 // it actually moves
    expect(maxDev).toBeLessThan(60);                   // but reverts — never wanders far (OU, not a walk)
  });

  it('respects clampMin / clampMax', () => {
    const ctl = new MovementController([{ field: 'temperature', startStep: 0, endStep: 5, ops: [{ kind: 'trend', amp: -500 }], clampMin: 25 }], 58);
    const c = conds();
    for (let s = 0; s < 5; s++) ctl.applyStep(c, s);
    expect(c.temperature).toBeGreaterThanOrEqual(25);  // floored
  });
});
